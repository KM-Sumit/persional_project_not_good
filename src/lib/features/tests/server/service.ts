// Staff side of tests: CRUD, lifecycle, password, grants, questions, build-from-modules, listing, results.
import { and, asc, count, desc, eq, ilike, inArray, isNull, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { attempts, modules, questions, testAccessFailures, testGrants, testQuestions, tests, users } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { cacheKeys, invalidate } from '#lib/server/cache';
import { createQuestion, escapeLike, parse } from '../../bank/server/service';
import { afterCursor, pageOf, toCsv, tsText } from '../../bank/server/util';
import {
	buildFromModulesInput,
	grantInput,
	inlineQuestionInput,
	questionMarksInput,
	testCreate,
	testListQuery,
	testPatch,
	type BuildReport,
	type GrantDTO,
	type ParticipantRow,
	type TestDTO,
	type TestList,
	type TestListQuery,
	type TestQuestionDTO,
	type TestSaved,
	type TestStats,
	type TestStatus
} from '../schema';
import { generatePassword, median, pct, round2, windowState } from './scoring';

type TestRow = typeof tests.$inferSelect;

// ---------- shared selects ----------
export const questionCountSql = sql<number>`(select count(*)::int from ${testQuestions} where ${testQuestions.testId} = ${tests.id})`.mapWith(Number);
export const totalMarksSql = sql<number>`(select coalesce(sum(coalesce(${testQuestions.marks}, ${tests.marksPerQuestion})), 0) from ${testQuestions} where ${testQuestions.testId} = ${tests.id})`.mapWith(Number);
const attemptCountSql = sql<number>`(select count(*)::int from ${attempts} where ${attempts.testId} = ${tests.id})`.mapWith(Number);
const testSelect = { t: tests, questionCount: questionCountSql, totalMarks: totalMarksSql, attemptCount: attemptCountSql };

const iso = (d: Date | null) => d?.toISOString() ?? null;

function toTestDTO(r: { t: TestRow; questionCount: number; totalMarks: number; attemptCount: number }): TestDTO {
	const { t } = r;
	return {
		id: t.id,
		title: t.title,
		description: t.description,
		instructions: t.instructions,
		kind: t.kind,
		access: t.access,
		status: t.status,
		examId: t.examId,
		courseId: t.courseId,
		subjectId: t.subjectId,
		sessionId: t.sessionId,
		batchId: t.batchId,
		difficulty: t.difficulty,
		durationMin: t.durationMin,
		marksPerQuestion: t.marksPerQuestion,
		negativeMarks: t.negativeMarks,
		priceInr: t.priceInr,
		startsAt: iso(t.startsAt),
		endsAt: iso(t.endsAt),
		maxAttempts: t.maxAttempts,
		shuffleQuestions: t.shuffleQuestions,
		showSolutions: t.showSolutions,
		year: t.year,
		shift: t.shift,
		language: t.language,
		sourceInfo: t.sourceInfo,
		verifiedPyq: t.verifiedPyq,
		hasPassword: !!t.passwordHash,
		questionCount: r.questionCount,
		totalMarks: round2(r.totalMarks),
		attemptCount: r.attemptCount,
		window: windowState(t),
		createdAt: t.createdAt.toISOString(),
		updatedAt: t.updatedAt.toISOString()
	};
}

/** The student catalog caches published cards; any staff change drops it. */
const bust = () => invalidate(cacheKeys.testsIndex);

async function loadTest(id: string): Promise<TestRow> {
	const [t] = await db().select().from(tests).where(eq(tests.id, id)).limit(1);
	if (!t) throw new DomainError(404, 'Test not found.');
	return t;
}

export async function getTest(id: string): Promise<TestDTO> {
	const [r] = await db().select(testSelect).from(tests).where(eq(tests.id, id)).limit(1);
	if (!r) throw new DomainError(404, 'Test not found.');
	return toTestDTO(r);
}

// ---------- create / update ----------

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** Window rules: end after start; a live test needs a start, and its end defaults to start + duration. */
function normaliseWindow(t: { kind: string; startsAt: Date | null; endsAt: Date | null; durationMin: number }) {
	if (t.kind === 'live' && !t.startsAt) throw new DomainError(400, 'A live test needs a start time.');
	const endsAt = t.kind === 'live' && t.startsAt && !t.endsAt ? new Date(t.startsAt.getTime() + t.durationMin * 60_000) : t.endsAt;
	if (t.startsAt && endsAt && endsAt <= t.startsAt) throw new DomainError(400, 'The end time must be after the start time.');
	return endsAt;
}

const hashPassword = (p: string) => Bun.password.hash(p);

export async function createTest(input: unknown, actorId: string | null): Promise<TestSaved> {
	const { password: custom, startsAt, endsAt, ...data } = parse(testCreate, input);
	const s = toDate(startsAt) ?? null;
	const e = normaliseWindow({ kind: data.kind, durationMin: data.durationMin, startsAt: s, endsAt: toDate(endsAt) ?? null });
	const password = data.access === 'password' ? (custom ?? generatePassword()) : null;
	const [t] = await db()
		.insert(tests)
		.values({ ...data, startsAt: s, endsAt: e, passwordHash: password ? await hashPassword(password) : null, createdById: actorId })
		.returning({ id: tests.id });
	await bust();
	return { test: await getTest(t.id), password };
}

/** Only keys present in the input change. Switching to password access without one generates it (returned once). */
export async function updateTest(id: string, input: unknown): Promise<TestSaved> {
	const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const parsed = parse(testPatch, raw);
	const patch = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as typeof parsed;
	const cur = await loadTest(id);
	const { password: custom, startsAt, endsAt, ...data } = patch;
	const s = startsAt === undefined ? cur.startsAt : toDate(startsAt)!;
	const e = normaliseWindow({
		kind: data.kind ?? cur.kind,
		durationMin: data.durationMin ?? cur.durationMin,
		startsAt: s,
		endsAt: endsAt === undefined ? cur.endsAt : toDate(endsAt)!
	});
	const access = data.access ?? cur.access;
	const password = access === 'password' && (custom || !cur.passwordHash) ? (custom ?? generatePassword()) : null;
	await db()
		.update(tests)
		.set({ ...data, startsAt: s, endsAt: e, ...(password ? { passwordHash: await hashPassword(password) } : {}) })
		.where(eq(tests.id, id));
	if (password) await db().delete(testAccessFailures).where(eq(testAccessFailures.testId, id));
	await bust();
	return { test: await getTest(id), password };
}

/** Sets (custom) or rotates (generated) the access password; plaintext is returned once and never stored. Clears lockouts. */
export async function setPassword(id: string, custom?: string | null): Promise<string> {
	if (custom != null && (custom.length < 4 || custom.length > 64)) throw new DomainError(400, 'Password must be 4 to 64 characters.');
	await loadTest(id);
	const password = custom || generatePassword();
	await db()
		.update(tests)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(tests.id, id));
	await db().delete(testAccessFailures).where(eq(testAccessFailures.testId, id));
	return password;
}

// ---------- lifecycle ----------

async function setStatus(id: string, status: TestStatus) {
	await db().update(tests).set({ status }).where(eq(tests.id, id));
	await bust();
	return getTest(id);
}

export async function publishTest(id: string): Promise<TestDTO> {
	const t = await getTest(id);
	if (t.status === 'cancelled' || t.status === 'archived') throw new DomainError(409, `A ${t.status} test cannot be published. Duplicate it instead.`);
	if (!t.questionCount) throw new DomainError(422, 'Add at least one question before publishing.');
	if (t.kind === 'live' && (!t.endsAt || new Date(t.endsAt) <= new Date()))
		throw new DomainError(422, 'This live test’s window is already over. Set a future time.');
	if (t.access === 'password' && !t.hasPassword) throw new DomainError(422, 'Set an access password first.');
	return setStatus(id, 'published');
}

export async function unpublishTest(id: string) {
	const t = await loadTest(id);
	if (t.status !== 'published') throw new DomainError(409, 'Only published tests can be unpublished.');
	return setStatus(id, 'draft');
}
export async function cancelTest(id: string) {
	await loadTest(id);
	return setStatus(id, 'cancelled');
}
export async function archiveTest(id: string) {
	await loadTest(id);
	return setStatus(id, 'archived');
}

/** Copy as a draft with the same questions; no password, grants or attempts. */
export async function duplicateTest(id: string, actorId: string | null): Promise<TestDTO> {
	const { id: _id, createdAt: _c, updatedAt: _u, passwordHash: _p, ...rest } = await loadTest(id);
	const copyId = await db().transaction(async (tx) => {
		const [copy] = await tx
			.insert(tests)
			.values({ ...rest, title: `${rest.title} (copy)`.slice(0, 200), status: 'draft', createdById: actorId })
			.returning({ id: tests.id });
		const qs = await tx.select().from(testQuestions).where(eq(testQuestions.testId, id));
		if (qs.length) await tx.insert(testQuestions).values(qs.map((q) => ({ ...q, testId: copy.id })));
		return copy.id;
	});
	await bust();
	return getTest(copyId);
}

export async function deleteTest(id: string) {
	const [{ n }] = await db().select({ n: count() }).from(attempts).where(eq(attempts.testId, id));
	if (n) throw new DomainError(409, 'Students have attempted this test. Archive it instead.');
	const [t] = await db().delete(tests).where(eq(tests.id, id)).returning({ id: tests.id });
	if (!t) throw new DomainError(404, 'Test not found.');
	await bust();
}

// ---------- grants (paid access, manual) ----------

export async function addGrant(testId: string, input: unknown, actorId: string | null): Promise<GrantDTO> {
	const g = parse(grantInput, input);
	await loadTest(testId);
	const [u] = await db()
		.select({ id: users.id })
		.from(users)
		.where(g.userId ? eq(users.id, g.userId) : eq(users.email, g.email!.toLowerCase()))
		.limit(1);
	if (!u) throw new DomainError(404, 'No student with that email.');
	await db()
		.insert(testGrants)
		.values({ testId, userId: u.id, grantedById: actorId, note: g.note })
		.onConflictDoUpdate({ target: [testGrants.testId, testGrants.userId], set: { note: g.note, grantedById: actorId } });
	return (await listGrants(testId)).find((x) => x.userId === u.id)!;
}

export async function removeGrant(testId: string, userId: string) {
	await db()
		.delete(testGrants)
		.where(and(eq(testGrants.testId, testId), eq(testGrants.userId, userId)));
}

export async function listGrants(testId: string): Promise<GrantDTO[]> {
	const rows = await db()
		.select({ userId: users.id, name: users.name, email: users.email, note: testGrants.note, createdAt: testGrants.createdAt })
		.from(testGrants)
		.innerJoin(users, eq(users.id, testGrants.userId))
		.where(eq(testGrants.testId, testId))
		.orderBy(desc(testGrants.createdAt));
	return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ---------- questions ----------

export async function listTestQuestions(testId: string): Promise<TestQuestionDTO[]> {
	const rows = await db()
		.select({ tq: testQuestions, q: questions })
		.from(testQuestions)
		.innerJoin(questions, eq(questions.id, testQuestions.questionId))
		.where(eq(testQuestions.testId, testId))
		.orderBy(asc(testQuestions.sortOrder), asc(questions.createdAt));
	return rows.map(({ tq, q }) => ({
		questionId: q.id,
		sortOrder: tq.sortOrder,
		marks: tq.marks,
		negativeMarks: tq.negativeMarks,
		prompt: q.prompt,
		options: q.options.map((o) => o.text),
		correctIndex: q.correctIndex,
		explanation: q.explanation,
		topic: q.topic,
		difficulty: q.difficulty,
		moduleId: q.moduleId
	}));
}

async function nextSortOrder(testId: string) {
	const [{ m }] = await db()
		.select({ m: sql<number>`coalesce(max(${testQuestions.sortOrder}), -1)`.mapWith(Number) })
		.from(testQuestions)
		.where(eq(testQuestions.testId, testId));
	return m + 1;
}

/** Appends bank questions (skips ones already in the test). Returns how many were added. */
export async function addQuestions(testId: string, questionIds: string[]): Promise<number> {
	await loadTest(testId);
	const ids = [...new Set(questionIds)];
	if (!ids.length) return 0;
	const found = await db().select({ id: questions.id }).from(questions).where(inArray(questions.id, ids));
	const known = new Set(found.map((f) => f.id));
	const start = await nextSortOrder(testId);
	const added = await db()
		.insert(testQuestions)
		.values(ids.filter((id) => known.has(id)).map((questionId, i) => ({ testId, questionId, sortOrder: start + i })))
		.onConflictDoNothing()
		.returning({ id: testQuestions.questionId });
	await bust();
	return added.length;
}

/** Writes a new question into the bank (optionally into a module) and appends it to the test. */
export async function createInlineQuestion(testId: string, input: unknown, actorId: string | null): Promise<TestQuestionDTO> {
	const { question, moduleId, marks, negativeMarks } = parse(inlineQuestionInput, input);
	await loadTest(testId);
	const q = await createQuestion(question, { moduleId, actorId });
	await db()
		.insert(testQuestions)
		.values({ testId, questionId: q.id, sortOrder: await nextSortOrder(testId), marks: marks ?? null, negativeMarks: negativeMarks ?? null });
	await bust();
	return (await listTestQuestions(testId)).find((x) => x.questionId === q.id)!;
}

/** Per-question marks override (null = test default). */
export async function setQuestionMarks(testId: string, questionId: string, input: unknown) {
	const m = parse(questionMarksInput, input);
	await db()
		.update(testQuestions)
		.set(m)
		.where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)));
	await bust();
}

export async function removeQuestion(testId: string, questionId: string) {
	await db()
		.delete(testQuestions)
		.where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)));
	await bust();
}

/** questionIds in the new order; ids not in the test are ignored, missing ones keep their place after. */
export async function reorderQuestions(testId: string, questionIds: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, questionId] of questionIds.entries())
			await tx
				.update(testQuestions)
				.set({ sortOrder: i })
				.where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)));
	});
}

/** Random pick of N per module (optionally one difficulty), never a question already in the test or picked earlier. */
export async function buildFromModules(testId: string, input: unknown): Promise<BuildReport> {
	const picks = parse(buildFromModulesInput, input);
	await loadTest(testId);
	const have = await db().select({ id: testQuestions.questionId }).from(testQuestions).where(eq(testQuestions.testId, testId));
	const taken = new Set(have.map((h) => h.id));
	const report: BuildReport = { added: 0, shortfalls: [] };
	const chosen: string[] = [];
	for (const p of picks) {
		const [m] = await db().select({ id: modules.id }).from(modules).where(eq(modules.id, p.moduleId)).limit(1);
		if (!m) throw new DomainError(404, 'Module not found.');
		const where: (SQL | undefined)[] = [eq(questions.moduleId, p.moduleId), p.difficulty ? eq(questions.difficulty, p.difficulty) : undefined];
		if (taken.size) where.push(notInArray(questions.id, [...taken]));
		// ponytail: order by random() scans the module; fine for pools of a few thousand questions.
		const rows = await db()
			.select({ id: questions.id })
			.from(questions)
			.where(and(...where))
			.orderBy(sql`random()`)
			.limit(p.count);
		for (const r of rows) taken.add(r.id), chosen.push(r.id);
		if (rows.length < p.count) report.shortfalls.push({ moduleId: p.moduleId, requested: p.count, added: rows.length });
	}
	report.added = await addQuestions(testId, chosen);
	return report;
}

// ---------- admin list ----------

export async function listTests(input: TestListQuery): Promise<TestList> {
	const f = parse(testListQuery, input);
	const base: (SQL | undefined)[] = [
		f.sessionId ? eq(tests.sessionId, f.sessionId) : undefined,
		f.kind ? eq(tests.kind, f.kind) : undefined,
		f.access ? eq(tests.access, f.access) : undefined,
		f.examId ? eq(tests.examId, f.examId) : undefined,
		f.courseId ? eq(tests.courseId, f.courseId) : isNull(tests.courseId),
		f.q ? ilike(tests.title, `%${escapeLike(f.q)}%`) : undefined
	];
	const [rows, byStatus] = await Promise.all([
		db()
			.select({ ...testSelect, cur: tsText(tests.createdAt), id: tests.id })
			.from(tests)
			.where(and(...base, f.status ? eq(tests.status, f.status) : undefined, afterCursor(tests.createdAt, tests.id, f.cursor)))
			.orderBy(desc(tests.createdAt), desc(tests.id))
			.limit(f.limit + 1),
		db()
			.select({ status: tests.status, n: count() })
			.from(tests)
			.where(and(...base))
			.groupBy(tests.status)
	]);
	const counts = { all: 0, draft: 0, published: 0, cancelled: 0, archived: 0 };
	for (const r of byStatus) (counts[r.status] = r.n), (counts.all += r.n);
	const page = pageOf(rows, f.limit);
	return { items: page.items.map(toTestDTO), nextCursor: page.nextCursor, counts };
}

// ---------- results ----------

export async function participants(testId: string): Promise<ParticipantRow[]> {
	// ponytail: unpaged, capped at 5000 rows; page it when a single test passes that.
	const rows = await db()
		.select({ a: attempts, name: users.name, email: users.email, phone: users.phone })
		.from(attempts)
		.innerJoin(users, eq(users.id, attempts.userId))
		.where(eq(attempts.testId, testId))
		.orderBy(sql`${attempts.score} desc nulls last`, asc(attempts.timeTakenSec), asc(attempts.startedAt))
		.limit(5000);
	return rows.map(({ a, name, email, phone }) => ({
		attemptId: a.id,
		userId: a.userId,
		name,
		email,
		phone,
		number: a.number,
		status: a.status,
		score: a.score,
		maxScore: a.maxScore,
		percentage: a.score != null && a.maxScore ? pct(a.score, a.maxScore) : null,
		startedAt: a.startedAt.toISOString(),
		submittedAt: iso(a.submittedAt),
		timeTakenSec: a.timeTakenSec
	}));
}

/** Started/submitted/avg/top/median over first attempts (one per student); per-question accuracy over all graded attempts. */
export async function testStats(testId: string): Promise<TestStats> {
	const firsts = await db()
		.select({ status: attempts.status, score: attempts.score })
		.from(attempts)
		.where(and(eq(attempts.testId, testId), eq(attempts.number, 1)));
	const scores = firsts.filter((a) => a.status !== 'in_progress' && a.score != null).map((a) => a.score!);
	const perQ = await db()
		.select({
			questionId: testQuestions.questionId,
			prompt: questions.prompt,
			attempted: sql<number>`count(aa.selected)::int`.mapWith(Number),
			correct: sql<number>`count(*) filter (where aa.is_correct)::int`.mapWith(Number)
		})
		.from(testQuestions)
		.innerJoin(questions, eq(questions.id, testQuestions.questionId))
		.leftJoin(
			sql`(select aa.question_id, aa.selected, aa.is_correct from attempt_answers aa join attempts a on a.id = aa.attempt_id
				where a.test_id = ${testId} and a.status <> 'in_progress') aa`,
			sql`aa.question_id = ${testQuestions.questionId}`
		)
		.where(eq(testQuestions.testId, testId))
		.groupBy(testQuestions.questionId, questions.prompt, testQuestions.sortOrder)
		.orderBy(asc(testQuestions.sortOrder));
	return {
		started: firsts.length,
		submitted: scores.length,
		avg: scores.length ? round2(scores.reduce((s, x) => s + x, 0) / scores.length) : null,
		top: scores.length ? Math.max(...scores) : null,
		median: median(scores),
		questions: perQ.map((q) => ({ ...q, prompt: q.prompt.slice(0, 160), accuracy: pct(q.correct, q.attempted) }))
	};
}

export async function resultsCsv(testId: string): Promise<string> {
	const rows = await participants(testId);
	return toCsv([
		['Name', 'Email', 'Phone', 'Attempt', 'Status', 'Score', 'Max', 'Percent', 'Time (s)', 'Started', 'Submitted'],
		...rows.map((r) => [r.name, r.email, r.phone, r.number, r.status, r.score, r.maxScore, r.percentage, r.timeTakenSec, r.startedAt, r.submittedAt])
	]);
}

