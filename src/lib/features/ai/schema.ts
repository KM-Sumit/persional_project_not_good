// AI question generation: request input and the generated question shape. Client-safe (no server imports).
import { z } from 'zod';

export const LANGUAGES = ['English', 'Hindi', 'Bilingual'] as const;
export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
/** "mixed" asks for roughly 30% easy, 40% medium, 30% hard. */
export const DIFFICULTIES = [...QUESTION_DIFFICULTIES, 'mixed'] as const;
/** Hard ceiling of the form; the service clamps further to env AI_MAX_QUESTIONS. */
export const MAX_COUNT = 50;

const common = {
	count: z.coerce.number().int().min(1).max(MAX_COUNT).default(10),
	difficulty: z.enum(DIFFICULTIES).default('mixed'),
	language: z.enum(LANGUAGES).default('English'),
	subject: z.string().trim().max(100).default(''),
	examName: z.string().trim().max(100).default(''),
	instructions: z.string().trim().max(1000).default('')
};

export const topicInput = z.object({
	mode: z.literal('topic'),
	topic: z.string().trim().min(2, 'Enter a topic.').max(200),
	...common
});

const page = z.coerce.number().int().min(1).max(10_000).optional();
export const pdfInput = z.object({
	mode: z.literal('pdf'),
	/** An uploaded file (files feature) or the raw bytes of a PDF the route already holds. Exactly one. */
	fileId: z.uuid().optional(),
	bytes: z.instanceof(Uint8Array).optional(),
	pageFrom: page,
	pageTo: page,
	...common
});

export const generateInput = z.discriminatedUnion('mode', [topicInput, pdfInput]).superRefine((v, ctx) => {
	if (v.mode !== 'pdf') return;
	if (!v.fileId === !v.bytes) ctx.addIssue({ code: 'custom', message: 'Attach one PDF.', path: ['fileId'] });
	if (v.pageFrom && v.pageTo && v.pageFrom > v.pageTo)
		ctx.addIssue({ code: 'custom', message: 'The first page must come before the last page.', path: ['pageTo'] });
});
export type GenerateInput = z.infer<typeof generateInput>;
export type GenerateInputRaw = z.input<typeof generateInput>;

/** Comparison key for options and prompts: lower case, no punctuation/symbols, single spaces (keeps Devanagari). */
export const normalise = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}\s]/gu, '')
		.replace(/\s+/g, ' ')
		.trim();

export const generatedQuestion = z
	.object({
		prompt: z.string().trim().min(5).max(2000),
		options: z.array(z.string().trim().min(1).max(500)).length(4),
		correctIndex: z.number().int().min(0).max(3),
		explanation: z.string().trim().max(2000).default(''),
		topic: z.string().trim().max(120).default(''),
		difficulty: z.enum(QUESTION_DIFFICULTIES).catch('medium')
	})
	.refine((q) => new Set(q.options.map(normalise)).size === 4, { message: 'Options must be distinct.' });
export type GeneratedQuestion = z.infer<typeof generatedQuestion>;

export type AiJobStatus = 'queued' | 'running' | 'ready' | 'failed' | 'applied';
export type AiJobDto = {
	id: string;
	status: AiJobStatus;
	source: 'ai_topic' | 'ai_pdf';
	/** The request as stored (PDF bytes replaced by their size). */
	input: Record<string, unknown>;
	questions: GeneratedQuestion[];
	requested: number;
	/** Model answers dropped by validation or as duplicates. */
	dropped: number;
	provider: string | null;
	model: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	error: string | null;
	createdAt: string;
	updatedAt: string;
};
