// DB tests against the local database. Every row is created with a run id and deleted in afterAll.
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { attempts, modules, questions, testAccessFailures, tests, users } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { createModule, createQuestion } from '../../bank/server/service';
import {
	addGrant,
	addQuestions,
	buildFromModules,
	createTest,
	deleteTest,
	duplicateTest,
	listTests,
	publishTest,
	resultsCsv,
	testStats
} from './service';
import { catalog, expireOverdue, getAttempt, getResult, history, saveAnswer, startAttempt, submitAttempt, testDetail } from './attempt';

setDefaultTimeout(30_000);
const rid = crypto.randomUUID().slice(0, 8);
const ids = { users: [] as string[], tests: [] as string[], questions: [] as string[], modules: [] as string[] };
let u1: string, u2: string, u3: string, staff: string;
let moduleId: string;
let qids: string[] = [];

const code = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		if (e instanceof DomainError) return e.status;
		throw e;
	}
	return 200;
};

async function mkTest(input: Record<string, unknown>, questionIds = qids) {
	const { test: t, password } = await createTest({ title: `a4 ${rid}`, ...input }, staff);
	ids.tests.push(t.id);
	if (questionIds.length) await addQuestions(t.id, questionIds);
	await publishTest(t.id);
	return { id: t.id, password };
}

beforeAll(async () => {
	const rows = await db()
		.insert(users)
		.values(['s1', 's2', 's3', 'staff'].map((n) => ({ email: `a4-${rid}-${n}@test.local`, name: `A4 ${n}` })))
		.returning({ id: users.id });
	[u1, u2, u3, staff] = rows.map((r) => r.id);
	ids.users.push(...rows.map((r) => r.id));
	const m = await createModule({ name: `a4 ${rid}` }, staff);
	moduleId = m.id;
	ids.modules.push(m.id);
	// 4 questions, correct option = index 1 everywhere.
	for (let i = 0; i < 4; i++) {
		const q = await createQuestion(
			{ prompt: `a4 ${rid} question ${i}`, options: ['w', 'right', 'x', 'y'], correctIndex: 1, topic: i < 2 ? 'Algebra' : '', difficulty: i % 2 ? 'hard' : 'easy' },
			{ moduleId, actorId: staff }
		);
		qids.push(q.id);
	}
	ids.questions.push(...qids);
});

afterAll(async () => {
	if (ids.tests.length) await db().delete(tests).where(inArray(tests.id, ids.tests));
	// Duplicates created by duplicateTest share the title prefix.
	await db().delete(tests).where(sql`${tests.title} like ${`a4 ${rid}%`}`);
	if (ids.questions.length) await db().delete(questions).where(inArray(questions.id, ids.questions));
	if (ids.modules.length) await db().delete(modules).where(inArray(modules.id, ids.modules));
	if (ids.users.length) await db().delete(users).where(inArray(users.id, ids.users));
});

describe('attempt flow', () => {
	test('start, answers hidden, autosave, resume, submit with negatives, idempotent', async () => {
		const t = await mkTest({ marksPerQuestion: 2, negativeMarks: 0.5, maxAttempts: 2 });
		const { attemptId, resumed } = await startAttempt(t.id, u1);
		expect(resumed).toBe(false);
		const screen = await getAttempt(attemptId, u1);
		if (screen.state !== 'open') throw new Error('expected open');
		expect(screen.questions).toHaveLength(4);
		expect(JSON.stringify(screen.questions)).not.toContain('correctIndex');
		expect(JSON.stringify(screen.questions)).not.toContain('explanation');

		await saveAnswer(attemptId, u1, { questionId: qids[0], selected: 1, marked: false, timeSpentDelta: 5 });
		await saveAnswer(attemptId, u1, { questionId: qids[0], selected: 1, marked: true, timeSpentDelta: 7 });
		await saveAnswer(attemptId, u1, { questionId: qids[1], selected: 0 });
		expect(await code(saveAnswer(attemptId, u1, { questionId: qids[2], selected: 5 }))).toBe(400);
		expect(await code(saveAnswer(attemptId, u2, { questionId: qids[2], selected: 1 }))).toBe(404);

		expect(await startAttempt(t.id, u1)).toEqual({ attemptId, resumed: true });
		const again = await getAttempt(attemptId, u1);
		if (again.state !== 'open') throw new Error('expected open');
		expect(again.answers[qids[0]]).toEqual({ selected: 1, marked: true, timeSpentSec: 12 });

		expect(await submitAttempt(attemptId, u1)).toEqual({ attemptId, status: 'submitted' });
		expect(await submitAttempt(attemptId, u1)).toEqual({ attemptId, status: 'submitted' });
		expect(await code(saveAnswer(attemptId, u1, { questionId: qids[2], selected: 1 }))).toBe(409);

		const r = await getResult(attemptId, { userId: u1 });
		expect(r).toMatchObject({ score: 1.5, maxScore: 8, correct: 1, wrong: 1, skipped: 2, accuracy: 50, percentage: 18.8 });
		expect(r.questions[0].correctIndex).toBe(1);
		expect(r.topics.find((x) => x.topic === 'Algebra')).toMatchObject({ total: 2, correct: 1, wrong: 1 });
		expect(await code(getResult(attemptId, { userId: u2 }))).toBe(404);
		expect((await getAttempt(attemptId, u1)).state).toBe('closed');

		// maxAttempts 2: second allowed, third refused.
		const second = await startAttempt(t.id, u1);
		await submitAttempt(second.attemptId, u1);
		expect(await code(startAttempt(t.id, u1))).toBe(409);
		const h = await history(u1);
		expect(h.items.filter((x) => x.testId === t.id).map((x) => x.number)).toEqual([2, 1]);
	});

	test('live: one attempt, solutions hidden until the end, window states', async () => {
		const now = Date.now();
		const live = await mkTest({ kind: 'live', startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(), showSolutions: true });
		const a = await startAttempt(live.id, u1);
		await submitAttempt(a.attemptId, u1);
		expect(await code(startAttempt(live.id, u1))).toBe(409);
		const r = await getResult(a.attemptId, { userId: u1 });
		expect(r.solutionsVisible).toBe(false);
		expect(r.questions[0].correctIndex).toBeNull();

		const upcoming = await mkTest({ kind: 'live', startsAt: new Date(now + 3_600_000).toISOString(), durationMin: 30 });
		expect(await code(startAttempt(upcoming.id, u1))).toBe(403);
		// Window over: publish refuses, and starting a test whose window closed is 410.
		await db()
			.update(tests)
			.set({ startsAt: new Date(now - 7_200_000), endsAt: new Date(now - 3_600_000) })
			.where(eq(tests.id, upcoming.id));
		expect(await code(startAttempt(upcoming.id, u1))).toBe(410);
		expect(await code(publishTest(upcoming.id))).toBe(422);

		const cards = await catalog(u1);
		expect(cards.find((c) => c.id === live.id)).toMatchObject({ window: 'live', attemptsUsed: 1, maxAttempts: 1, canStart: false });
		expect(cards.find((c) => c.id === upcoming.id)?.window).toBe('ended');
	});

	test('late joiner deadline is capped at the window end', async () => {
		const now = Date.now();
		const t = await mkTest({ kind: 'live', startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 600_000).toISOString(), durationMin: 60 });
		const { attemptId } = await startAttempt(t.id, u2);
		const s = await getAttempt(attemptId, u2);
		if (s.state !== 'open') throw new Error('expected open');
		expect(Math.abs(new Date(s.deadlineAt).getTime() - (now + 600_000))).toBeLessThan(1000);
	});

	test('password lockout: 5 wrong -> 423, even the right one, until it lapses', async () => {
		const t = await mkTest({ access: 'password', password: 'open-sesame' });
		expect(t.password).toBe('open-sesame');
		expect(await code(startAttempt(t.id, u2))).toBe(403); // none given
		for (let i = 0; i < 4; i++) expect(await code(startAttempt(t.id, u2, 'nope'))).toBe(403);
		expect(await code(startAttempt(t.id, u2, 'nope'))).toBe(423);
		expect(await code(startAttempt(t.id, u2, 'open-sesame'))).toBe(423);
		// Another student is not affected.
		expect((await startAttempt(t.id, u3, 'open-sesame')).resumed).toBe(false);
		await db()
			.update(testAccessFailures)
			.set({ lockedUntil: new Date(Date.now() - 1000) })
			.where(eq(testAccessFailures.testId, t.id));
		expect((await startAttempt(t.id, u2, 'open-sesame')).resumed).toBe(false);
		// Generated password when none is given.
		const gen = await mkTest({ access: 'password' });
		expect(gen.password).toMatch(/^.{8}$/);
	});

	test('paid needs a grant', async () => {
		const t = await mkTest({ access: 'paid', priceInr: 99 });
		expect((await catalog(u3)).find((c) => c.id === t.id)?.lock).toBe('paid');
		expect(await code(startAttempt(t.id, u3))).toBe(403);
		await addGrant(t.id, { email: `a4-${rid}-s3@test.local` }, staff);
		expect((await testDetail(t.id, u3)).lock).toBeNull();
		expect((await startAttempt(t.id, u3)).resumed).toBe(false);
	});

	test('deadline + grace: saves inside grace, expiry grades saved answers after it', async () => {
		const t = await mkTest({ marksPerQuestion: 1 });
		const { attemptId } = await startAttempt(t.id, u2);
		await db()
			.update(attempts)
			.set({ deadlineAt: new Date(Date.now() - 60_000) })
			.where(eq(attempts.id, attemptId));
		await saveAnswer(attemptId, u2, { questionId: qids[0], selected: 1 }); // inside grace: accepted
		await saveAnswer(attemptId, u2, { questionId: qids[1], selected: 1 });
		await db()
			.update(attempts)
			.set({ deadlineAt: new Date(Date.now() - 4 * 60_000) })
			.where(eq(attempts.id, attemptId));
		expect(await code(saveAnswer(attemptId, u2, { questionId: qids[2], selected: 1 }))).toBe(409);
		const r = await getResult(attemptId, { userId: u2 });
		expect(r).toMatchObject({ status: 'expired', score: 2, correct: 2, skipped: 2 });

		// expireOverdue sweeps a forgotten attempt.
		const t2 = await mkTest({});
		const b = await startAttempt(t2.id, u2);
		await saveAnswer(b.attemptId, u2, { questionId: qids[3], selected: 1 });
		await db()
			.update(attempts)
			.set({ deadlineAt: new Date(Date.now() - 10 * 60_000) })
			.where(eq(attempts.id, b.attemptId));
		expect(await expireOverdue({ testId: t2.id })).toBe(1);
		const [row] = await db().select().from(attempts).where(eq(attempts.id, b.attemptId));
		expect(row).toMatchObject({ status: 'expired', score: 1, correct: 1 });
	});

	test('rank and percentile among first attempts, option pick %', async () => {
		const t = await mkTest({ marksPerQuestion: 1 });
		const play = async (u: string, right: number) => {
			const { attemptId } = await startAttempt(t.id, u);
			for (let i = 0; i < right; i++) await saveAnswer(attemptId, u, { questionId: qids[i], selected: 1 });
			await submitAttempt(attemptId, u);
			return attemptId;
		};
		const a1 = await play(u1, 3);
		const a2 = await play(u2, 1);
		const a3 = await play(u3, 1);
		expect(await getResult(a1, { userId: u1 })).toMatchObject({ rank: 1, participants: 3, percentile: 100 });
		const r2 = await getResult(a2, { userId: u2 });
		expect(r2).toMatchObject({ rank: 2, participants: 3, percentile: 50 });
		expect(r2.questions.find((q) => q.id === qids[0])?.optionPickPct).toEqual([0, 100, 0, 0]);
		expect(r2.questions.find((q) => q.id === qids[2])?.optionPickPct?.[1]).toBe(33.3);
		expect((await getResult(a3, { userId: staff, staff: true })).rank).toBe(2);

		const s = await testStats(t.id);
		expect(s).toMatchObject({ started: 3, submitted: 3, top: 3, median: 1, avg: 1.67 });
		expect(s.questions[0]).toMatchObject({ attempted: 3, correct: 3, accuracy: 100 });
		const csv = await resultsCsv(t.id);
		expect(csv.split('\r\n')[0]).toStartWith('Name,Email');
		expect(csv).toContain(`a4-${rid}-s1@test.local`);
		expect(await code(deleteTest(t.id))).toBe(409);
	});
});

describe('staff', () => {
	test('publish needs questions; build from modules picks without duplicates; duplicate; list', async () => {
		const { test: t } = await createTest({ title: `a4 ${rid} build` }, staff);
		ids.tests.push(t.id);
		expect(await code(publishTest(t.id))).toBe(422);
		await addQuestions(t.id, [qids[0]]);
		const rep = await buildFromModules(t.id, [{ moduleId, count: 2, difficulty: 'hard' }, { moduleId, count: 5 }]);
		expect(rep.added).toBe(3); // q0 already in: 2 hard (q1, q3) + the only easy left (q2)
		expect(rep.shortfalls).toEqual([{ moduleId, requested: 5, added: 1 }]);
		const dup = await duplicateTest(t.id, staff);
		ids.tests.push(dup.id);
		expect(dup).toMatchObject({ status: 'draft', questionCount: 4 });

		const list = await listTests({ q: `a4 ${rid} build`, limit: 1 });
		expect(list.items).toHaveLength(1);
		expect(list.counts.draft).toBe(2);
		const next = await listTests({ q: `a4 ${rid} build`, limit: 1, cursor: list.nextCursor });
		expect(next.items[0].id).not.toBe(list.items[0].id);
		expect(next.nextCursor).toBeNull();
		await deleteTest(dup.id);
	});
});
