import { describe, expect, test } from 'bun:test';
import { draftProviders, draftUserPrompt, maxOutputTokens, quizDraftSchema, shouldTryNextProvider } from './generate';

describe('draftProviders', () => {
	test('direct Gemini runs before OpenRouter', () => {
		const names = draftProviders({
			DATABASE_URL: 'postgres://local',
			OPENROUTER_API_KEY: 'or-test',
			OPENROUTER_MODEL: 'openai/gpt-4o-mini',
			GEMINI_API_KEY: 'gem-test',
			NODE_ENV: 'test'
		}).map((provider) => provider.name);
		expect(names).toEqual([
			'gemini:gemini-3.5-flash',
			'openrouter:google/gemini-3.5-flash-lite',
			'openrouter:openai/gpt-4o-mini'
		]);
	});

	test('the user message stays a few lines and a short reply is capped', () => {
		const prompt = draftUserPrompt({
			topic: 'percentages '.repeat(80),
			subject: 'Mathematics',
			difficulty: 'easy',
			questionCount: 10
		});
		expect(prompt.length).toBeLessThan(400);
		expect(prompt).toContain('count: 10');
		expect(maxOutputTokens(10)).toBe(1856);
	});

	test('a bad draft does not spend another model', () => {
		expect(shouldTryNextProvider(new Error('Expected object, received string'))).toBe(false);
		expect(shouldTryNextProvider(new Error('404 ZDR violation'))).toBe(true);
	});

	test('schema accepts a four-option question', () => {
		const parsed = quizDraftSchema.parse({
			title: 'Percentages',
			questions: [
				{
					prompt: 'What is 10% of 50?',
					options: ['5', '10', '15', '20'],
					correctIndex: 0,
					explanation: '10% of 50 is 5.'
				}
			]
		});
		expect(parsed.questions[0]?.correctIndex).toBe(0);
	});
});
