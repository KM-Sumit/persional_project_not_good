// Uses the local DB; the model is faked (no network).
import { afterAll, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { aiJobs, users } from '#lib/server/db/schema';
import type { GenerateResult } from '#lib/server/ai/generate';
import { makePdf } from '#lib/server/ai/make-pdf';
import { createJob, getJob, listJobs, markApplied } from './service';

const email = `ai-test-${crypto.randomUUID()}@example.com`;
const [user] = await db().insert(users).values({ email }).returning();
afterAll(async () => {
	await db().delete(aiJobs).where(eq(aiJobs.createdById, user.id));
	await db().delete(users).where(eq(users.id, user.id));
});

const result: GenerateResult = {
	questions: [{ prompt: 'Who wrote the Indian national anthem?', options: ['Tagore', 'Bankim', 'Iqbal', 'Naidu'], correctIndex: 0, explanation: '', topic: 'Anthem', difficulty: 'easy' }],
	requested: 1,
	dropped: 0,
	provider: 'gemini',
	model: 'gemini-x',
	inputTokens: 100,
	outputTokens: 50
};

async function settle(id: string) {
	for (let i = 0; i < 100; i++) {
		const j = await getJob(id);
		if (j.status !== 'queued' && j.status !== 'running') return j;
		await Bun.sleep(20);
	}
	throw new Error('job did not finish');
}

test('topic job runs to ready, lists, applies once', async () => {
	const job = await createJob({ mode: 'topic', topic: 'National symbols', count: 1 }, user.id, { generate: async () => result });
	expect(job.source).toBe('ai_topic');
	const done = await settle(job.id);
	expect(done).toMatchObject({ status: 'ready', provider: 'gemini', model: 'gemini-x', inputTokens: 100, outputTokens: 50 });
	expect(done.questions).toHaveLength(1);
	expect((await listJobs(user.id)).map((j) => j.id)).toContain(job.id);
	expect((await markApplied(job.id)).status).toBe('applied');
	await expect(markApplied(job.id)).rejects.toThrow('already applied');
});

test('failures are recorded, PDF bytes are not stored', async () => {
	const job = await createJob({ mode: 'pdf', bytes: new Uint8Array([1, 2, 3]), count: 5 }, user.id, { generate: async () => result });
	expect(job.input.bytes).toBeUndefined();
	expect(job.input.byteSize).toBe(3);
	const done = await settle(job.id);
	expect(done.status).toBe('failed');
	expect(done.error).toContain('Could not read this PDF');
	await expect(markApplied(job.id)).rejects.toThrow('finished job');
});

test('bad input and unknown ids', async () => {
	await expect(createJob({ mode: 'topic', topic: '' }, user.id, { generate: async () => result })).rejects.toThrow();
	await expect(getJob('nope')).rejects.toThrow('not found');
});

test('text PDF: only the chosen pages reach the generator', async () => {
	const page = (p: number) => Array.from({ length: 6 }, (_, i) => `Chapter ${p} line ${i}: the Preamble of the Constitution of India declares it sovereign.`);
	let seen = '';
	const job = await createJob({ mode: 'pdf', bytes: makePdf([1, 2, 3].map(page)), pageFrom: 2, pageTo: 2, count: 1 }, user.id, {
		generate: async (_i, pdf) => ((seen = pdf?.text ?? ''), result)
	});
	expect((await settle(job.id)).status).toBe('ready');
	expect(seen).toContain('Chapter 2');
	expect(seen).not.toContain('Chapter 1');
});
