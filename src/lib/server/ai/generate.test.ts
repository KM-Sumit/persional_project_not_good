import { describe, expect, test } from 'bun:test';
import { generateInput, type GenerateInput } from '../../features/ai/schema';
import {
	CHUNK_CHARS,
	arrangeOptions,
	askText,
	callWithFallback,
	chunkText,
	fingerprint,
	generate,
	outputCap,
	plan,
	splitCount,
	toQuestions,
	type CallRequest,
	type Provider
} from './generate';

const topic = generateInput.parse({ mode: 'topic', topic: 'Mughal Empire', count: 4 }) as GenerateInput;
const item = (q: string, o = ['Akbar', 'Babur', 'Humayun', 'Jahangir'], a = 1) => ({ q, o, a, e: 'Because.', t: 'Mughals', d: 'easy' });
const fake = (name: Provider['name'], fn: (r: CallRequest) => unknown, calls: CallRequest[] = []): Provider => ({
	name,
	model: `${name}-m`,
	call: async (r) => {
		calls.push(r);
		return { raw: await fn(r), inputTokens: 10, outputTokens: 20 };
	}
});

describe('validation', () => {
	test('keeps good questions and tracks the correct answer through the shuffle', () => {
		const { questions, dropped } = toQuestions({ questions: [item('Who founded the Mughal Empire in India?')] });
		expect(dropped).toBe(0);
		expect(questions[0].options[questions[0].correctIndex]).toBe('Babur');
	});
	test('drops bad index, wrong option count, duplicate options, empty prompt, junk', () => {
		const { questions, dropped } = toQuestions({
			questions: [
				item('Index out of range question?', undefined, 4),
				item('Three options only question?', ['a', 'b', 'c'], 0),
				item('Duplicate options question?', ['Akbar', 'akbar.', 'Babur', 'Humayun'], 2),
				item('', undefined, 0),
				null,
				'text'
			]
		});
		expect(questions).toHaveLength(0);
		expect(dropped).toBe(6);
		expect(toQuestions('nonsense').questions).toHaveLength(0);
	});
	test('fingerprint ignores case, punctuation and spacing', () => {
		expect(fingerprint('Who founded the  Mughal Empire?')).toBe(fingerprint('who founded the mughal empire'));
		expect(fingerprint('भारत की राजधानी?')).toBe(fingerprint('भारत की राजधानी'));
		expect(fingerprint('a')).not.toBe(fingerprint('b'));
	});
	test('arrangeOptions keeps "none of the above" last and sorts numbers', () => {
		expect(arrangeOptions(['None of the above', 'x', 'y', 'z'], () => 0).at(-1)).toBe('None of the above');
		expect(arrangeOptions(['30', '10', '40', '20'])).toEqual(['10', '20', '30', '40']);
	});
});

describe('context', () => {
	test('topic plan is one call; the ask comes last and is short', () => {
		const jobs = plan(topic);
		expect(jobs).toHaveLength(1);
		expect(askText(topic, 4)).toContain('exactly 4');
		expect(askText({ ...topic, language: 'Bilingual' }, 4)).toContain('Hindi');
	});
	test('large text PDFs are chunked and the count is split', () => {
		const para = 'The Constitution of India came into force on 26 January 1950 and is the supreme law. ';
		const text = Array.from({ length: 900 }, (_, i) => `${i} ${para.repeat(2)}`).join('\n\n');
		const input = generateInput.parse({ mode: 'pdf', bytes: new Uint8Array(1), count: 20 }) as GenerateInput;
		const jobs = plan(input, { bytes: new Uint8Array(), pages: 50, text });
		expect(jobs.length).toBeGreaterThan(1);
		expect(jobs.reduce((n, j) => n + j.n, 0)).toBe(20);
		for (const j of jobs) expect((j.source[0] as { text: string }).text.length).toBeLessThan(CHUNK_CHARS * 2);
	});
	test('a scan goes natively as one PDF file part', () => {
		const input = generateInput.parse({ mode: 'pdf', bytes: new Uint8Array(1), count: 5, pageFrom: 2, pageTo: 3 }) as GenerateInput;
		const [j] = plan(input, { bytes: new Uint8Array([37, 80, 68, 70]), pages: 4, text: null });
		expect(j.source[0].type).toBe('file');
		expect(j.pages).toBe('2-3');
	});
	test('helpers', () => {
		expect(splitCount(10, 3)).toEqual([4, 3, 3]);
		expect(chunkText('a'.repeat(10) + '\n\n' + 'b'.repeat(10), 12)).toEqual(['a'.repeat(10), 'b'.repeat(10)]);
		expect(outputCap(10, 'Hindi')).toBeGreaterThan(outputCap(10, 'English'));
	});
	test('pdf input needs exactly one source', () => {
		expect(generateInput.safeParse({ mode: 'pdf' }).success).toBe(false);
		expect(generateInput.safeParse({ mode: 'pdf', bytes: new Uint8Array(1), pageFrom: 5, pageTo: 2 }).success).toBe(false);
	});
});

describe('providers', () => {
	test('falls back to OpenRouter when Gemini errors or returns nothing valid', async () => {
		const a = await callWithFallback(
			[fake('gemini', () => Promise.reject(new Error('timeout'))), fake('openrouter', () => ({ questions: [item('Who founded the Mughal Empire?')] }))],
			{ system: '', parts: [], maxTokens: 1 }
		);
		expect(a.provider.name).toBe('openrouter');
		const b = await callWithFallback(
			[fake('gemini', () => ({ questions: [item('Bad?', ['a'], 0)] })), fake('openrouter', () => ({ questions: [item('Who founded the Mughal Empire?')] }))],
			{ system: '', parts: [], maxTokens: 1 }
		);
		expect(b.provider.name).toBe('openrouter');
	});
	test('fails loudly when every provider fails (no invented questions)', async () => {
		await expect(generate(topic, undefined, [fake('gemini', () => ({ questions: [] }))])).rejects.toThrow('AI generation failed');
		await expect(generate(topic, undefined, [])).rejects.toThrow('not configured');
	});
	test('dedupes, tops up once when short, records usage', async () => {
		const calls: CallRequest[] = [];
		const p = fake(
			'gemini',
			(r) =>
				calls.length === 1
					? { questions: [item('Who founded the Mughal Empire?'), item('who founded the mughal empire'), item('Who built the Taj Mahal?', ['Shah Jahan', 'Akbar', 'Babur', 'Aurangzeb'], 0)] }
					: { questions: [item('Who was the last Mughal emperor?', ['Bahadur Shah Zafar', 'Akbar II', 'Babur', 'Aurangzeb'], 0), item('Which Mughal ruler started the Din-i-Ilahi?', undefined, 0)] },
			calls
		);
		const r = await generate(topic, undefined, [p]);
		expect(r.questions).toHaveLength(4);
		expect(r.dropped).toBe(1);
		expect(calls).toHaveLength(2);
		expect((calls[1].parts.at(-1) as { text: string }).text).toContain('Do not repeat');
		expect(calls[0].system).toBe(calls[1].system);
		expect(r).toMatchObject({ provider: 'gemini', model: 'gemini-m', inputTokens: 20, outputTokens: 40 });
	});
});
