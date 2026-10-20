import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { env, type Env } from '../../../server/env';

const GEMINI_ON_OPENROUTER = 'google/gemini-3.5-flash-lite';
const OPENROUTER_ZDR_FALLBACK = 'openai/gpt-4o-mini';
const GEMINI_DIRECT = 'gemini-3.5-flash';

export const quizDraftSchema = z.object({
	title: z.string().min(1),
	questions: z
		.array(
			z.object({
				prompt: z.string().min(1),
				options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
				correctIndex: z.number().int().min(0).max(3),
				explanation: z.string().min(1)
			})
		)
		.min(1)
});

export type QuizDraft = z.infer<typeof quizDraftSchema>;

export class DraftError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DraftError';
	}
}

/** Output cap. A four-option question with a one-sentence explanation fits in ~160 tokens. */
export const maxOutputTokens = (count: number) => 256 + count * 160;

const SYSTEM_PROMPT = `You write SSC, Railways, Police, Defence, and Agniveer multiple-choice questions.
One concept each. Four short options. correctIndex is the correct option.
One-sentence explanation. No option letters in the text. No preamble.`;

function clip(value: string, max: number) {
	const text = value.trim().replace(/\s+/g, ' ');
	return text.length <= max ? text : text.slice(0, max);
}

/** Only the fields that change. The system prompt stays identical so the provider can cache it. */
export function draftUserPrompt(input: {
	topic: string;
	subject: string;
	difficulty: string;
	questionCount: number;
}) {
	return [
		`subject: ${clip(input.subject, 80)}`,
		`topic: ${clip(input.topic, 240)}`,
		`difficulty: ${clip(input.difficulty, 40)}`,
		`count: ${input.questionCount}`
	].join('\n');
}

/** A transport or policy failure is worth the next model. A bad draft is not. */
export function shouldTryNextProvider(error: unknown) {
	const message = error instanceof Error ? error.message : '';
	return /404|429|500|502|503|504|ZDR|timeout|ECONN|fetch failed|unavailable/i.test(message);
}

type Provider = { name: string; chat: ChatOpenAI };

/** Direct Gemini first. OpenRouter runs only if that call fails. */
export function draftProviders(current: Env = env()): Provider[] {
	const providers: Provider[] = [];
	const gemini = current.GEMINI_API_KEY?.trim();
	if (gemini) {
		providers.push({
			name: `gemini:${GEMINI_DIRECT}`,
			chat: new ChatOpenAI({
				model: GEMINI_DIRECT,
				temperature: 0.2,
				maxTokens: maxOutputTokens(20),
				apiKey: gemini,
				configuration: {
					baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
				}
			})
		});
	}
	const openrouter = current.OPENROUTER_API_KEY?.trim();
	if (openrouter) {
		const fallback = current.OPENROUTER_MODEL?.trim() || OPENROUTER_ZDR_FALLBACK;
		const models = [GEMINI_ON_OPENROUTER];
		if (!models.includes(fallback)) models.push(fallback);
		if (!models.includes(OPENROUTER_ZDR_FALLBACK)) models.push(OPENROUTER_ZDR_FALLBACK);
		for (const model of models) {
			providers.push({
				name: `openrouter:${model}`,
				chat: new ChatOpenAI({
					model,
					temperature: 0.2,
					maxTokens: maxOutputTokens(20),
					apiKey: openrouter,
					configuration: {
						baseURL: 'https://openrouter.ai/api/v1',
						defaultHeaders: {
							'HTTP-Referer': current.ORIGIN ?? 'http://localhost:5174',
							'X-Title': 'Upendra Competition Institute'
						}
					}
				})
			});
		}
	}
	return providers;
}

export async function draftQuiz(
	input: { topic: string; subject: string; difficulty: string; questionCount: number },
	current: Env = env()
): Promise<QuizDraft> {
	const count = Math.min(20, Math.max(1, input.questionCount));
	const providers = draftProviders(current);
	if (providers.length === 0) {
		throw new DraftError('Question drafting is not configured.');
	}
	const messages = [
		{ role: 'system' as const, content: SYSTEM_PROMPT },
		{ role: 'user' as const, content: draftUserPrompt({ ...input, questionCount: count }) }
	];

	const failures: string[] = [];
	for (const provider of providers) {
		try {
			const structured = provider.chat.withStructuredOutput(quizDraftSchema);
			const draft = await structured.invoke(messages);
			const parsed = quizDraftSchema.parse(draft);
			if (parsed.questions.length < count) {
				throw new DraftError(`${provider.name} returned ${parsed.questions.length} of ${count} questions.`);
			}
			return { title: clip(parsed.title, 80), questions: parsed.questions.slice(0, count) };
		} catch (error) {
			const fromGemini = provider.name.startsWith('gemini:');
			if (!fromGemini && error instanceof DraftError) throw error;
			if (!fromGemini && !shouldTryNextProvider(error)) {
				throw new DraftError(error instanceof Error ? error.message : 'The draft could not be read.');
			}
			failures.push(provider.name);
		}
	}
	throw new DraftError(`Every model refused the draft (${failures.join(', ')}).`);
}
