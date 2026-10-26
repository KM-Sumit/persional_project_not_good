// Student side: catalog, detail, attempt engine (start/resume, autosave, submit, expiry), results, history.
// Port of campusquiz attempt.ts, extended with windows, access, retakes and marks/negatives.
import { and, asc, count, desc, eq, inArray, lt, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { accessScope, hasAccess } from '#lib/features/billing/server/service';
import { courseAccess } from '#lib/features/billing/server/paywall';
import { attemptAnswers, attempts, batchMembers, products, questions, testAccessFailures, testGrants, testQuestions, testSets, tests } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { cached, cacheKeys } from '#lib/server/cache';
import { parse } from '../../bank/server/service';
import { afterCursor, pageOf, tsText } from '../../bank/server/util';
import {
	saveAnswerInput,
	type AttemptScreen,
	type CatalogCard,
	type HistoryItem,
	type ResultDTO,
	type SaveAnswerInput,
	type TestDetail
} from '../schema';
import { questionCountSql, totalMarksSql } from './service';

function hindiOptions(en: { text: string }[], hi: { text: string }[] | null) {
	if (!hi || hi.length !== en.length || hi.every((o) => !o.text.trim())) return null;
	return hi.map((o) => o.text);
}
import {
	GRACE_MS,
	afterFailure,
	attemptDeadline,
	effectiveMaxAttempts,
	outcomeOf,
	pastHardDeadline,
	pct,
	rankFrom,
	round2,
	scoreAttempt,
	shuffle,
	windowState
} from './scoring';

type TestRow = typeof tests.$inferSelect;
type AttemptRow = typeof attempts.$inferSelect;

// ---------- catalog ----------

/** Published test cards without per-user state: what the cache holds. */
type PublishedCard = Omit<CatalogCard, 'window' | 'maxAttempts' | 'attemptsUsed' | 'bestScore' | 'inProgressAttemptId' | 'lock' | 'canStart'> & {
	courseId: string | null;
	batchId: string | null;
	maxAttemptsRaw: number | null;
	instructions: string;
	sourceInfo: string;
	showSolutions: boolean;
};

const loadPublished = async (): Promise<PublishedCard[]> => {
	const rows = await db()
		.select({
			t: tests,
			setName: testSets.name,
			setAccess: testSets.access,
			setPriceInr: testSets.priceInr,
			setProductId: sql<string | null>`(select ${products.id} from ${products} where ${products.setId} = ${testSets.id} and ${products.active} = true order by ${products.createdAt} desc limit 1)`,
			questionCount: questionCountSql,
			totalMarks: totalMarksSql
		})
		.from(tests)
		.leftJoin(testSets, eq(testSets.id, tests.setId))
		.where(eq(tests.status, 'published'))
		.orderBy(desc(tests.createdAt));
	return rows.map(({ t, setName, setAccess, setPriceInr, setProductId, questionCount, totalMarks }) => ({
		id: t.id,
		title: t.title,
		description: t.description,
		instructions: t.instructions,
		sourceInfo: t.sourceInfo,
		showSolutions: t.showSolutions,
		kind: t.kind,
		access: t.access,
		examId: t.examId,
		setId: t.setId,
		setName: setName ?? null,
		setAccess: setAccess ?? null,
		setPriceInr: setPriceInr ?? null,
		setProductId: setProductId ?? null,
		subjectId: t.subjectId,
		courseId: t.courseId,
		batchId: t.batchId,
		difficulty: t.difficulty,
		durationMin: t.durationMin,
		marksPerQuestion: t.marksPerQuestion,
		negativeMarks: t.negativeMarks,
		priceInr: t.priceInr,
		startsAt: t.startsAt?.toISOString() ?? null,
		endsAt: t.endsAt?.toISOString() ?? null,
		year: t.year,
		shift: t.shift,
		language: t.language,
		verifiedPyq: t.verifiedPyq,
		questionCount,
		totalMarks: round2(totalMarks),
		maxAttemptsRaw: t.maxAttempts
	}));
};

const publishedCards = () => cached(cacheKeys.testsIndex, 300, loadPublished);

async function userBatchIds(userId: string) {
	const rows = await db().select({ id: batchMembers.batchId }).from(batchMembers).where(eq(batchMembers.userId, userId));
	return new Set(rows.map((r) => r.id));
}

async function personalise(cards: PublishedCard[], userId: string, now = new Date()): Promise<(CatalogCard & { _c: PublishedCard })[]> {
	if (!cards.length) return [];
	const ids = cards.map((c) => c.id);
	const [mine, grants] = await Promise.all([
		db()
			.select({
				testId: attempts.testId,
				used: count(),
				best: sql<number | null>`max(${attempts.score}) filter (where ${attempts.status} <> 'in_progress')`,
				open: sql<string | null>`(array_agg(${attempts.id}) filter (where ${attempts.status} = 'in_progress' and ${attempts.deadlineAt} > ${new Date(now.getTime() - GRACE_MS).toISOString()}::timestamptz))[1]`
			})
			.from(attempts)
			.where(and(eq(attempts.userId, userId), inArray(attempts.testId, ids)))
			.groupBy(attempts.testId),
		accessScope(userId) // exam passes, test products and manual grants
	]);
	const byTest = new Map(mine.map((m) => [m.testId, m]));
	const unlocked = (c: { id: string; examId: string | null; setId: string | null }) =>
		grants.testIds.has(c.id) || (!!c.setId && grants.setIds.has(c.setId)) || (!!c.examId && grants.examIds.has(c.examId));
	return cards.map((c) => {
		const m = byTest.get(c.id);
		const window = windowState(c, now);
		const maxAttempts = effectiveMaxAttempts(c.kind, c.maxAttemptsRaw);
		const attemptsUsed = m?.used ?? 0;
		const inProgressAttemptId = m?.open ?? null;
		const lock = c.setId
			? c.setAccess === 'paid' && !unlocked(c)
				? 'paid'
				: c.setAccess === 'password'
					? 'password'
					: null
			: c.access === 'paid' && !unlocked(c)
				? 'paid'
				: c.access === 'password'
					? 'password'
					: null;
		const { batchId: _b, maxAttemptsRaw: _m, instructions: _i, sourceInfo: _s, showSolutions: _sh, ...card } = c;
		return {
			...card,
			_c: c,
			window,
			maxAttempts,
			attemptsUsed,
			bestScore: m?.best == null ? null : Number(m.best),
			inProgressAttemptId,
			lock: inProgressAttemptId ? null : lock,
			canStart:
				!!inProgressAttemptId ||
				(window === 'live' && lock !== 'paid' && (maxAttempts == null || attemptsUsed < maxAttempts) && c.questionCount > 0)
		};
	});
}

/** Published tests this user can see (open to all, or one of their batches), with their own state. */
export async function catalog(userId: string): Promise<CatalogCard[]> {
	await expireOverdue({ userId });
	const batchIds = await userBatchIds(userId);
	const visible = (await publishedCards()).filter((c) => !c.courseId && (!c.batchId || batchIds.has(c.batchId)));
	return (await personalise(visible, userId)).map(({ _c, ...card }) => card);
}

export async function testDetail(testId: string, userId: string): Promise<TestDetail> {
	await expireOverdue({ userId, testId });
	const c = (await publishedCards()).find((x) => x.id === testId);
	if (!c || (c.batchId && !(await userBatchIds(userId)).has(c.batchId))) throw new DomainError(404, 'Test not found.');
	if (c.courseId && !(await courseAccess(userId, c.courseId))) throw new DomainError(403, 'Open this test from its course.');
	const [{ _c, ...card }] = await personalise([c], userId);
	const mine = await db()
		.select({ a: attempts })
		.from(attempts)
		.where(and(eq(attempts.testId, testId), eq(attempts.userId, userId)))
		.orderBy(desc(attempts.startedAt));
	return {
		...card,
		instructions: c.instructions,
		sourceInfo: c.sourceInfo,
		showSolutions: c.showSolutions,
		attempts: mine.map(({ a }) => toHistory(a, c))
	};
}

const toHistory = (a: AttemptRow, t: { id: string; title: string; kind: CatalogCard['kind'] }): HistoryItem => ({
	attemptId: a.id,
	testId: t.id,
	testTitle: t.title,
	kind: t.kind,
	number: a.number,
	status: a.status,
	score: a.score,
	maxScore: a.maxScore,
	percentage: a.score != null && a.maxScore ? pct(a.score, a.maxScore) : null,
	startedAt: a.startedAt.toISOString(),
	submittedAt: a.submittedAt?.toISOString() ?? null,
	timeTakenSec: a.timeTakenSec
});

// ---------- start ----------

async function loadVisibleTest(testId: string, userId: string): Promise<TestRow> {
	const [t] = await db().select().from(tests).where(eq(tests.id, testId)).limit(1);
	if (!t || t.status === 'draft' || t.status === 'archived') throw new DomainError(404, 'Test not found.');
	if (t.batchId && !(await userBatchIds(userId)).has(t.batchId)) throw new DomainError(404, 'Test not found.');
	if (t.courseId && !(await courseAccess(userId, t.courseId))) throw new DomainError(403, 'Open this test from its course.');
	return t;
}

/** Password check with a per (test, user) lockout: 5 wrong -> locked 15 min. Failures persist even though we throw. */
async function checkPassword(t: TestRow, userId: string, password: string | undefined, now = new Date()) {
	const where = and(eq(testAccessFailures.testId, t.id), eq(testAccessFailures.userId, userId));
	const [f] = await db().select().from(testAccessFailures).where(where).limit(1);
	if (f?.lockedUntil && f.lockedUntil > now) {
		const min = Math.ceil((f.lockedUntil.getTime() - now.getTime()) / 60_000);
		throw new DomainError(423, `Too many wrong passwords. Try again in ${min} minute${min === 1 ? '' : 's'}.`);
	}
	if (!password) throw new DomainError(403, 'Enter the test password.');
	const ok = !!t.passwordHash && (await Bun.password.verify(password, t.passwordHash).catch(() => false));
	if (ok) {
		if (f) await db().delete(testAccessFailures).where(where);
		return;
	}
	const next = afterFailure(f?.lockedUntil && f.lockedUntil <= now ? undefined : f, now);
	await db()
		.insert(testAccessFailures)
		.values({ testId: t.id, userId, failures: next.failures, lockedUntil: next.lockedUntil })
		.onConflictDoUpdate({
			target: [testAccessFailures.testId, testAccessFailures.userId],
			set: { failures: next.failures, lockedUntil: next.lockedUntil }
		});
	if (next.locked) throw new DomainError(423, 'Too many wrong passwords. Try again in 15 minutes.');
	throw new DomainError(403, `Wrong password. ${next.left} ${next.left === 1 ? 'try' : 'tries'} left.`);
}

const openAttemptOf = async (testId: string, userId: string) =>
	(
		await db()
			.select({ id: attempts.id, deadlineAt: attempts.deadlineAt })
			.from(attempts)
			.where(and(eq(attempts.testId, testId), eq(attempts.userId, userId), eq(attempts.status, 'in_progress')))
			.limit(1)
	)[0];

/**
 * Starts (or resumes) an attempt. Resume needs no password and ignores the window: the clock keeps running.
 * New attempt: published, window live, paid -> grant, password -> verified, attempts left (live = 1), has questions.
 */
export async function startAttempt(testId: string, userId: string, password?: string): Promise<{ attemptId: string; resumed: boolean }> {
	await expireOverdue({ testId, userId });
	const t = await loadVisibleTest(testId, userId);
	const open = await openAttemptOf(testId, userId);
	if (open) return { attemptId: open.id, resumed: true };

	if (t.status === 'cancelled') throw new DomainError(410, 'This test was cancelled.');
	const now = new Date();
	const w = windowState(t, now);
	if (w === 'upcoming') throw new DomainError(403, 'This test has not opened yet.');
	if (w === 'ended') throw new DomainError(410, 'This test has ended.');
	if (t.setId) {
		const [set] = await db().select().from(testSets).where(eq(testSets.id, t.setId)).limit(1);
		if (set?.access === 'paid') {
			const scope = await accessScope(userId);
			const ok = scope.setIds.has(set.id) || scope.testIds.has(testId) || (!!set.examId && scope.examIds.has(set.examId));
			if (!ok) throw new DomainError(403, 'This set is paid. One payment opens every test in it.');
		} else if (set?.access === 'password') {
			await checkPassword({ ...t, passwordHash: set.passwordHash }, userId, password, now);
		}
	} else {
		if (t.access === 'paid' && !(await hasAccess(userId, { examId: t.examId, testId })))
			throw new DomainError(403, 'This is a paid test. Get the exam pass or ask the institute to unlock it.');
		if (t.access === 'password') await checkPassword(t, userId, password, now);
	}

	return db().transaction(async (tx) => {
		// Serialise double-taps on Start so one student never gets two attempts.
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${testId + ':' + userId}))`);
		const [again] = await tx
			.select({ id: attempts.id })
			.from(attempts)
			.where(and(eq(attempts.testId, testId), eq(attempts.userId, userId), eq(attempts.status, 'in_progress')))
			.limit(1);
		if (again) return { attemptId: again.id, resumed: true };
		const [{ used }] = await tx
			.select({ used: sql<number>`coalesce(max(${attempts.number}), 0)`.mapWith(Number) })
			.from(attempts)
			.where(and(eq(attempts.testId, testId), eq(attempts.userId, userId)));
		const max = effectiveMaxAttempts(t.kind, t.maxAttempts);
		if (max != null && used >= max)
			throw new DomainError(409, max === 1 ? 'You have already taken this test.' : `You have used all ${max} attempts.`);
		const qs = await tx
			.select({ id: testQuestions.questionId })
			.from(testQuestions)
			.where(eq(testQuestions.testId, testId))
			.orderBy(asc(testQuestions.sortOrder));
		if (!qs.length) throw new DomainError(422, 'This test has no questions yet.');
		const ids = qs.map((q) => q.id);
		const startedAt = new Date();
		const [a] = await tx
			.insert(attempts)
			.values({
				testId,
				userId,
				number: used + 1,
				questionOrder: t.shuffleQuestions ? shuffle(ids) : ids,
				startedAt,
				deadlineAt: attemptDeadline(startedAt, t.durationMin, t.endsAt)
			})
			.returning({ id: attempts.id });
		return { attemptId: a.id, resumed: false };
	});
}

// ---------- attempt screen + autosave ----------

async function ownAttempt(attemptId: string, userId: string) {
	const [r] = await db()
		.select({ a: attempts, t: tests })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
		.limit(1);
	if (!r) throw new DomainError(404, 'Attempt not found.');
	return r;
}

/** Questions as served in this attempt, with effective marks. Never includes the answer key unless asked. */
async function attemptQuestions(a: AttemptRow, t: TestRow) {
	if (!a.questionOrder.length) return [];
	const rows = await db()
		.select({ q: questions, marks: testQuestions.marks, neg: testQuestions.negativeMarks })
		.from(questions)
		.leftJoin(testQuestions, and(eq(testQuestions.questionId, questions.id), eq(testQuestions.testId, t.id)))
		.where(inArray(questions.id, a.questionOrder));
	const byId = new Map(rows.map((r) => [r.q.id, r]));
	return a.questionOrder.flatMap((id) => {
		const r = byId.get(id);
		return r ? [{ q: r.q, marks: r.marks ?? t.marksPerQuestion, negativeMarks: r.neg ?? t.negativeMarks }] : [];
	});
}

export async function getAttempt(attemptId: string, userId: string): Promise<AttemptScreen> {
	await expirePasswordAttempts(userId);
	await expireOverdue({ attemptId });
	const { a, t } = await ownAttempt(attemptId, userId);
	if (a.status !== 'in_progress') return { state: 'closed', attemptId };
	const [qs, saved] = await Promise.all([
		attemptQuestions(a, t),
		db().select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId))
	]);
	return {
		state: 'open',
		attemptId,
		test: { id: t.id, title: t.title, kind: t.kind, durationMin: t.durationMin, marksPerQuestion: t.marksPerQuestion, negativeMarks: t.negativeMarks },
		questions: qs.map(({ q, marks, negativeMarks }) => ({
			id: q.id,
			prompt: q.prompt,
			promptHi: q.promptHi,
			options: q.options.map((o) => o.text),
			optionsHi: hindiOptions(q.options, q.optionsHi),
			topic: q.topic,
			imageFileId: q.imageFileId,
			marks,
			negativeMarks
		})),
		answers: Object.fromEntries(saved.map((s) => [s.questionId, { selected: s.selected, marked: s.marked, timeSpentSec: s.timeSpentSec }])),
		startedAt: a.startedAt.toISOString(),
		deadlineAt: a.deadlineAt.toISOString(),
		serverNow: new Date().toISOString()
	};
}

/** Upserts one answer. Rejected once the attempt is closed or past deadline + grace (then it is graded on the spot). */
export async function saveAnswer(attemptId: string, userId: string, input: SaveAnswerInput): Promise<{ savedAt: string }> {
	const s = parse(saveAnswerInput, input);
	const closed = await db().transaction(async (tx) => {
		// FOR SHARE: waits for (and is excluded by) grading's FOR UPDATE, so no save lands after the score is computed.
		const [a] = await tx
			.select()
			.from(attempts)
			.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
			.for('share')
			.limit(1);
		if (!a) throw new DomainError(404, 'Attempt not found.');
		if (a.status !== 'in_progress') throw new DomainError(409, 'This attempt is already submitted.');
		if (pastHardDeadline(a.deadlineAt)) return true;
		if (!a.questionOrder.includes(s.questionId)) throw new DomainError(400, 'That question is not in this test.');
		if (s.selected != null) {
			const [q] = await tx.select({ options: questions.options }).from(questions).where(eq(questions.id, s.questionId)).limit(1);
			if (!q || s.selected >= q.options.length) throw new DomainError(400, 'Pick one of the options.');
		}
		await tx
			.insert(attemptAnswers)
			.values({ attemptId, questionId: s.questionId, selected: s.selected, marked: s.marked, timeSpentSec: s.timeSpentDelta })
			.onConflictDoUpdate({
				target: [attemptAnswers.attemptId, attemptAnswers.questionId],
				set: { selected: s.selected, marked: s.marked, timeSpentSec: sql`${attemptAnswers.timeSpentSec} + ${s.timeSpentDelta}` }
			});
		return false;
	});
	if (closed) {
		await grade(attemptId, 'expired');
		throw new DomainError(409, 'Time is up. Your saved answers were submitted.');
	}
	return { savedAt: new Date().toISOString() };
}

// ---------- grading ----------

/** Scores saved answers and closes the attempt. Idempotent: a closed attempt is left alone. */
async function grade(attemptId: string, status: 'submitted' | 'expired', now = new Date()) {
	await db().transaction(async (tx) => {
		const [a] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for('update').limit(1);
		if (!a || a.status !== 'in_progress') return;
		const [t] = await tx.select().from(tests).where(eq(tests.id, a.testId)).limit(1);
		const qs = await attemptQuestions(a, t);
		const saved = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
		const picks = new Map(saved.map((s) => [s.questionId, s.selected]));
		const r = scoreAttempt(qs.map(({ q, marks, negativeMarks }) => ({ marks, negativeMarks, correctIndex: q.correctIndex, selected: picks.get(q.id) })));
		await tx.execute(sql`update attempt_answers aa set is_correct = (aa.selected = q.correct_index)
			from questions q where q.id = aa.question_id and aa.attempt_id = ${attemptId}`);
		const end = Math.min(now.getTime(), a.deadlineAt.getTime());
		await tx
			.update(attempts)
			.set({
				...r,
				status,
				submittedAt: status === 'expired' ? new Date(end) : now,
				timeTakenSec: Math.max(0, Math.min(Math.round((end - a.startedAt.getTime()) / 1000), t.durationMin * 60))
			})
			.where(eq(attempts.id, attemptId));
	});
}

/** Submit from the attempt screen. Idempotent; past deadline + grace it closes as expired with what was saved. */
export async function submitAttempt(attemptId: string, userId: string): Promise<{ attemptId: string; status: 'submitted' | 'expired' }> {
	const { a } = await ownAttempt(attemptId, userId);
	if (a.status === 'in_progress') await grade(attemptId, pastHardDeadline(a.deadlineAt) ? 'expired' : 'submitted');
	const [after] = await db().select({ status: attempts.status }).from(attempts).where(eq(attempts.id, attemptId));
	return { attemptId, status: after.status as 'submitted' | 'expired' };
}

/**
 * PT tests (password access) close at the deadline itself. Saved answers are scored.
 * Other tests keep the short grace window for a slow phone.
 */
export async function expirePasswordAttempts(userId: string, now = new Date()): Promise<number> {
	const due = await db()
		.select({ id: attempts.id })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.userId, userId), eq(attempts.status, 'in_progress'), eq(tests.access, 'password'), lt(attempts.deadlineAt, now)))
		.limit(20);
	for (const d of due) await grade(d.id, 'expired', now);
	return due.length;
}

/** The student's open PT test, if one is still inside its time. Used to submit it when the clock hits zero. */
export async function openPasswordAttempt(userId: string): Promise<{ attemptId: string; testId: string; deadlineAt: string } | null> {
	await expirePasswordAttempts(userId);
	const [r] = await db()
		.select({ attemptId: attempts.id, testId: attempts.testId, deadlineAt: attempts.deadlineAt })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.userId, userId), eq(attempts.status, 'in_progress'), eq(tests.access, 'password')))
		.orderBy(asc(attempts.deadlineAt))
		.limit(1);
	return r ? { attemptId: r.attemptId, testId: r.testId, deadlineAt: r.deadlineAt.toISOString() } : null;
}

/** Grades every in-progress attempt past deadline + grace (optionally scoped). Called lazily on reads, and by a timer if wanted. */
export async function expireOverdue(scope: { userId?: string; testId?: string; attemptId?: string } = {}, now = new Date()): Promise<number> {
	const where: (SQL | undefined)[] = [
		eq(attempts.status, 'in_progress'),
		lt(attempts.deadlineAt, new Date(now.getTime() - GRACE_MS)),
		scope.userId ? eq(attempts.userId, scope.userId) : undefined,
		scope.testId ? eq(attempts.testId, scope.testId) : undefined,
		scope.attemptId ? eq(attempts.id, scope.attemptId) : undefined
	];
	const due = await db()
		.select({ id: attempts.id })
		.from(attempts)
		.where(and(...where))
		.limit(500);
	for (const d of due) await grade(d.id, 'expired', now);
	return due.length;
}

// ---------- results ----------

/** Full result for the attempt's owner (or staff). Solutions show when the test allows it or has ended; live tests only after the end. */
export async function getResult(attemptId: string, viewer: { userId: string; staff?: boolean }): Promise<ResultDTO> {
	await expireOverdue({ attemptId });
	const [r] = await db()
		.select({ a: attempts, t: tests })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(viewer.staff ? eq(attempts.id, attemptId) : and(eq(attempts.id, attemptId), eq(attempts.userId, viewer.userId)))
		.limit(1);
	if (!r) throw new DomainError(404, 'Result not found.');
	const { a, t } = r;
	if (a.status === 'in_progress') throw new DomainError(409, 'This attempt is still in progress.');

	const ended = windowState(t) === 'ended';
	const solutionsVisible = ended || (t.showSolutions && t.kind !== 'live');
	const graded = and(eq(attempts.testId, t.id), ne(attempts.status, 'in_progress'));
	const [qs, saved, [others], [{ n: gradedCount }], picks] = await Promise.all([
		attemptQuestions(a, t),
		db().select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
		db()
			.select({
				total: count(),
				higher: sql<number>`count(*) filter (where ${attempts.score} > ${a.score ?? 0})::int`.mapWith(Number)
			})
			.from(attempts)
			.where(and(graded, eq(attempts.number, 1), ne(attempts.userId, a.userId))),
		db().select({ n: count() }).from(attempts).where(graded),
		solutionsVisible
			? db()
					.select({ questionId: attemptAnswers.questionId, selected: attemptAnswers.selected, n: count() })
					.from(attemptAnswers)
					.innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
					.where(and(graded, sql`${attemptAnswers.selected} is not null`))
					.groupBy(attemptAnswers.questionId, attemptAnswers.selected)
			: Promise.resolve([])
	]);
	const pickCount = new Map(picks.map((p) => [`${p.questionId}:${p.selected}`, p.n]));
	const byQ = new Map(saved.map((s) => [s.questionId, s]));
	const topics = new Map<string, { topic: string; total: number; correct: number; wrong: number; skipped: number }>();
	const rows = qs.map(({ q, marks, negativeMarks }) => {
		const s = byQ.get(q.id);
		const outcome = outcomeOf({ correctIndex: q.correctIndex, selected: s?.selected });
		const topic = q.topic || 'General';
		const tp = topics.get(topic) ?? { topic, total: 0, correct: 0, wrong: 0, skipped: 0 };
		tp.total++;
		tp[outcome]++;
		topics.set(topic, tp);
		return {
			id: q.id,
			prompt: q.prompt,
			promptHi: q.promptHi,
			options: q.options.map((o) => o.text),
			optionsHi: hindiOptions(q.options, q.optionsHi),
			topic: q.topic,
			difficulty: q.difficulty,
			imageFileId: q.imageFileId,
			marks,
			negativeMarks,
			selected: s?.selected ?? null,
			marked: s?.marked ?? false,
			timeSpentSec: s?.timeSpentSec ?? 0,
			outcome,
			correctIndex: solutionsVisible ? q.correctIndex : null,
			explanation: solutionsVisible ? q.explanation : null,
			explanationHi: solutionsVisible ? q.explanationHi : null,
			optionPickPct: solutionsVisible ? q.options.map((_, i) => pct(pickCount.get(`${q.id}:${i}`) ?? 0, gradedCount)) : null
		};
	});
	const score = a.score ?? 0;
	const maxScore = a.maxScore ?? 0;
	const correct = a.correct ?? 0;
	const wrong = a.wrong ?? 0;
	return {
		attemptId,
		test: { id: t.id, title: t.title, kind: t.kind },
		userId: a.userId,
		status: a.status as 'submitted' | 'expired',
		number: a.number,
		score,
		maxScore,
		percentage: pct(score, maxScore),
		correct,
		wrong,
		skipped: a.skipped ?? 0,
		accuracy: pct(correct, correct + wrong),
		timeTakenSec: a.timeTakenSec ?? 0,
		startedAt: a.startedAt.toISOString(),
		submittedAt: a.submittedAt?.toISOString() ?? null,
		...rankFrom(others),
		solutionsVisible,
		questions: rows,
		topics: [...topics.values()].map((tp) => ({ ...tp, accuracy: pct(tp.correct, tp.correct + tp.wrong) }))
	};
}

/** The user's attempts across tests, newest first, keyset paged. */
export async function history(userId: string, opts: { cursor?: string | null; limit?: number } = {}) {
	await expireOverdue({ userId });
	const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
	const rows = await db()
		.select({ a: attempts, t: { id: tests.id, title: tests.title, kind: tests.kind }, cur: tsText(attempts.startedAt), id: attempts.id })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.userId, userId), afterCursor(attempts.startedAt, attempts.id, opts.cursor)))
		.orderBy(desc(attempts.startedAt), desc(attempts.id))
		.limit(limit + 1);
	const page = pageOf(rows, limit);
	return { items: page.items.map((r) => toHistory(r.a, r.t)), nextCursor: page.nextCursor };
}

