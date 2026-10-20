import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { scoreAttempt } from '$lib/features/attempts/score';
import { db, type Tx } from '$lib/server/db';
import { answers, attempts, chapters, courses, purchases, questions, tests, unlocks } from '$lib/server/db/schema';

export class AttemptError extends Error {
	constructor(
		message: string,
		readonly code: 'not_found' | 'closed' | 'paid' | 'password' | 'window' | 'finished'
	) {
		super(message);
		this.name = 'AttemptError';
	}
}

export type TestIntro = {
	id: string;
	title: string;
	subject: string;
	topic: string;
	description: string;
	instructions: string;
	questionCount: number;
	durationMinutes: number;
	difficulty: string;
	testType: 'practice' | 'mock' | 'pyq' | 'scheduled';
	marksPerQuestionMilli: number;
	negativeMilli: number;
	language: string;
	needsPassword: boolean;
	needsPurchase: boolean;
	pricePaise: number;
	activeAttemptId: string | null;
	scheduledStartAt: number | null;
	scheduledEndAt: number | null;
	joinCode: string | null;
	/** Course module this paper belongs to, when one is attached. */
	place: string | null;
};

export type PlayerQuestion = {
	id: string;
	prompt: string;
	options: string[];
	selected: number | null;
};

export type Player =
	| { submitted: true; attemptId: string }
	| {
			submitted: false;
			attemptId: string;
			testId: string;
			title: string;
			instructions: string;
			deadline: number;
			serverNow: number;
			questions: PlayerQuestion[];
	  };

export type ResultQuestion = {
	prompt: string;
	options: string[];
	selected: number | null;
	correctIndex: number;
	explanation: string;
};

export type AttemptResult = {
	testId: string;
	title: string;
	scoreMilli: number;
	maxMilli: number;
	correct: number;
	wrong: number;
	unattempted: number;
	percentageTenths: number;
	accuracyTenths: number;
	timeTakenSeconds: number;
	questions: ResultQuestion[];
};

type VisibleTest = {
	id: string;
	published: boolean;
	status: 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';
	testType: 'practice' | 'mock' | 'pyq' | 'scheduled';
	accessType: 'free' | 'password' | 'paid';
	durationMinutes: number;
	scheduledStartAt: Date | null;
	scheduledEndAt: Date | null;
};

function isVisible(test: { published: boolean; status: string }) {
	return test.published && test.status !== 'draft' && test.status !== 'cancelled';
}

/** A sitting with one window and one submitted attempt. */
function isScheduled(test: { testType: string; status: string }) {
	return test.testType === 'scheduled' || test.status === 'scheduled';
}

/** hashtext is int4; pg_advisory_xact_lock takes bigint. */
function lockKey(tx: Tx, key: string) {
	return tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key})::bigint)`);
}

async function loadVisibleTest(tx: Tx, testId: string): Promise<VisibleTest | null> {
	const [test] = await tx
		.select({
			id: tests.id,
			published: tests.published,
			status: tests.status,
			testType: tests.testType,
			accessType: tests.accessType,
			durationMinutes: tests.durationMinutes,
			scheduledStartAt: tests.scheduledStartAt,
			scheduledEndAt: tests.scheduledEndAt
		})
		.from(tests)
		.where(eq(tests.id, testId))
		.limit(1);
	if (!test || !isVisible(test)) return null;
	return test;
}

export async function testIntro(userId: string, testId: string): Promise<TestIntro | null> {
	const [test] = await db()
		.select({
			id: tests.id,
			title: tests.title,
			subject: tests.subject,
			topic: tests.topic,
			description: tests.description,
			instructions: tests.instructions,
			durationMinutes: tests.durationMinutes,
			difficulty: tests.difficulty,
			testType: tests.testType,
			marksPerQuestionMilli: tests.marksPerQuestionMilli,
			negativeMilli: tests.negativeMilli,
			language: tests.language,
			accessType: tests.accessType,
			pricePaise: tests.pricePaise,
			published: tests.published,
			status: tests.status,
			scheduledStartAt: tests.scheduledStartAt,
			scheduledEndAt: tests.scheduledEndAt,
			joinCode: tests.joinCode,
			chapterTitle: chapters.title,
			courseTitle: courses.title
		})
		.from(tests)
		.leftJoin(chapters, eq(chapters.id, tests.chapterId))
		.leftJoin(courses, eq(courses.id, chapters.courseId))
		.where(eq(tests.id, testId))
		.limit(1);
	if (!test || !isVisible(test)) return null;

	const [countRow] = await db()
		.select({ n: sql<number>`count(*)::int` })
		.from(questions)
		.where(eq(questions.testId, testId));
	const [unlock] = await db()
		.select({ userId: unlocks.userId })
		.from(unlocks)
		.where(and(eq(unlocks.userId, userId), eq(unlocks.testId, testId)))
		.limit(1);
	const [purchase] = await db()
		.select({ id: purchases.id })
		.from(purchases)
		.where(and(eq(purchases.userId, userId), eq(purchases.testId, testId)))
		.limit(1);
	const [active] = await db()
		.select({ id: attempts.id })
		.from(attempts)
		.where(and(eq(attempts.userId, userId), eq(attempts.testId, testId), eq(attempts.status, 'in_progress')))
		.limit(1);

	return {
		id: test.id,
		title: test.title,
		subject: test.subject,
		topic: test.topic,
		description: test.description,
		instructions: test.instructions,
		questionCount: Number(countRow?.n ?? 0),
		durationMinutes: test.durationMinutes,
		difficulty: test.difficulty,
		testType: test.testType,
		marksPerQuestionMilli: test.marksPerQuestionMilli,
		negativeMilli: test.negativeMilli,
		language: test.language,
		needsPassword: test.accessType === 'password' && !unlock,
		needsPurchase: test.accessType === 'paid' && !purchase,
		pricePaise: test.pricePaise,
		activeAttemptId: active?.id ?? null,
		scheduledStartAt: test.scheduledStartAt?.getTime() ?? null,
		scheduledEndAt: test.scheduledEndAt?.getTime() ?? null,
		joinCode: test.joinCode,
		place: [test.chapterTitle, test.courseTitle].filter(Boolean).join(' · ') || null
	};
}

export async function unlockTest(userId: string, testId: string, password: string) {
	const [test] = await db()
		.select({
			accessType: tests.accessType,
			accessPasswordHash: tests.accessPasswordHash
		})
		.from(tests)
		.where(eq(tests.id, testId))
		.limit(1);
	if (!test) throw new AttemptError('This test is not available.', 'not_found');
	if (test.accessType !== 'password' || !test.accessPasswordHash) {
		throw new AttemptError('This test does not use a password.', 'closed');
	}
	const matches = await Bun.password.verify(password, test.accessPasswordHash);
	if (!matches) throw new AttemptError('That password is wrong.', 'password');
	await db().insert(unlocks).values({ userId, testId }).onConflictDoNothing();
}

export async function startAttempt(userId: string, testId: string): Promise<string> {
	return db().transaction(async (tx) => {
		await lockKey(tx, `${testId}${userId}`);
		const test = await loadVisibleTest(tx, testId);
		if (!test) throw new AttemptError('This test is not available.', 'not_found');

		if (test.accessType === 'password') {
			const [unlock] = await tx
				.select({ userId: unlocks.userId })
				.from(unlocks)
				.where(and(eq(unlocks.userId, userId), eq(unlocks.testId, testId)))
				.limit(1);
			if (!unlock) throw new AttemptError('Enter the test password first.', 'password');
		}

		if (test.accessType === 'paid') {
			const [purchase] = await tx
				.select({ id: purchases.id })
				.from(purchases)
				.where(and(eq(purchases.userId, userId), eq(purchases.testId, testId)))
				.limit(1);
			if (!purchase) throw new AttemptError('This test is locked. Ask an admin to grant access.', 'paid');
		}

		const nowMs = Date.now();
		if (isScheduled(test)) {
			if (test.scheduledStartAt && nowMs < test.scheduledStartAt.getTime()) {
				throw new AttemptError('This test has not opened yet.', 'window');
			}
			if (test.scheduledEndAt && nowMs >= test.scheduledEndAt.getTime()) {
				throw new AttemptError('This test has closed.', 'window');
			}
		}

		const [active] = await tx
			.select({ id: attempts.id })
			.from(attempts)
			.where(and(eq(attempts.userId, userId), eq(attempts.testId, testId), eq(attempts.status, 'in_progress')))
			.orderBy(sql`${attempts.startedAt} desc`)
			.limit(1);
		if (active) return active.id;

		if (isScheduled(test)) {
			const [previous] = await tx
				.select({ id: attempts.id })
				.from(attempts)
				.where(and(eq(attempts.userId, userId), eq(attempts.testId, testId), eq(attempts.status, 'submitted')))
				.limit(1);
			if (previous) throw new AttemptError('You have already taken this test.', 'finished');
		}

		const now = new Date(nowMs);
		let deadlineAt = new Date(nowMs + test.durationMinutes * 60_000);
		if (test.scheduledEndAt && test.scheduledEndAt.getTime() < deadlineAt.getTime()) {
			deadlineAt = test.scheduledEndAt;
		}
		const [created] = await tx
			.insert(attempts)
			.values({ userId, testId, startedAt: now, deadlineAt, status: 'in_progress' })
			.returning({ id: attempts.id });
		if (!created) throw new Error('Could not start the test.');
		return created.id;
	});
}

export async function loadPlayer(userId: string, attemptId: string): Promise<Player | null> {
	const [attempt] = await db()
		.select({
			id: attempts.id,
			status: attempts.status,
			deadlineAt: attempts.deadlineAt,
			testId: attempts.testId,
			title: tests.title,
			instructions: tests.instructions
		})
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
		.limit(1);
	if (!attempt) return null;
	if (attempt.status === 'submitted') return { submitted: true, attemptId: attempt.id };

	const rows = await db()
		.select({
			id: questions.id,
			prompt: questions.prompt,
			options: questions.options,
			selected: answers.selectedIndex
		})
		.from(questions)
		.leftJoin(answers, and(eq(answers.questionId, questions.id), eq(answers.attemptId, attempt.id)))
		.where(eq(questions.testId, attempt.testId))
		.orderBy(asc(questions.sortOrder), asc(questions.id));

	return {
		submitted: false,
		attemptId: attempt.id,
		testId: attempt.testId,
		title: attempt.title,
		instructions: attempt.instructions,
		deadline: attempt.deadlineAt.getTime(),
		serverNow: Date.now(),
		questions: rows.map((row) => ({
			id: row.id,
			prompt: row.prompt,
			options: row.options,
			selected: row.selected
		}))
	};
}

export async function saveAnswer(userId: string, attemptId: string, questionId: string, selectedIndex: number) {
	await db().transaction(async (tx) => {
		await lockKey(tx, attemptId);
		const [attempt] = await tx
			.select({
				id: attempts.id,
				status: attempts.status,
				deadlineAt: attempts.deadlineAt,
				testId: attempts.testId
			})
			.from(attempts)
			.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
			.limit(1);
		if (!attempt) throw new AttemptError('Attempt not found.', 'not_found');
		if (attempt.status !== 'in_progress' || Date.now() > attempt.deadlineAt.getTime()) {
			throw new AttemptError('This attempt is closed.', 'closed');
		}
		const [question] = await tx
			.select({ id: questions.id })
			.from(questions)
			.where(and(eq(questions.id, questionId), eq(questions.testId, attempt.testId)))
			.limit(1);
		if (!question) throw new AttemptError('This attempt is closed.', 'closed');
		await tx
			.insert(answers)
			.values({ attemptId, questionId, selectedIndex })
			.onConflictDoUpdate({
				target: [answers.attemptId, answers.questionId],
				set: { selectedIndex }
			});
	});
}

export async function submitAttempt(userId: string, attemptId: string, posted: Record<string, number | null>) {
	return db().transaction(async (tx) => {
		await lockKey(tx, attemptId);
		const [attempt] = await tx
			.select({
				id: attempts.id,
				status: attempts.status,
				testId: attempts.testId,
				startedAt: attempts.startedAt,
				deadlineAt: attempts.deadlineAt
			})
			.from(attempts)
			.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
			.limit(1);
		if (!attempt) throw new AttemptError('Attempt not found.', 'not_found');
		if (attempt.status === 'submitted') return attempt.id;

		const questionRows = await tx
			.select({
				id: questions.id,
				marksMilli: questions.marksMilli,
				negativeMilli: questions.negativeMilli,
				correctIndex: questions.correctIndex
			})
			.from(questions)
			.where(eq(questions.testId, attempt.testId))
			.orderBy(asc(questions.sortOrder), asc(questions.id));
		const savedRows = await tx
			.select({ questionId: answers.questionId, selectedIndex: answers.selectedIndex })
			.from(answers)
			.where(eq(answers.attemptId, attemptId));
		const saved = new Map(savedRows.map((row) => [row.questionId, row.selectedIndex]));
		const merged = new Map<string, number | null>();
		for (const question of questionRows) merged.set(question.id, saved.get(question.id) ?? null);
		for (const [questionId, selected] of Object.entries(posted)) {
			if (!merged.has(questionId)) continue;
			merged.set(questionId, selected);
		}

		const writes = questionRows.filter((question) => merged.get(question.id) != null);
		if (writes.length > 0) {
			await tx
				.insert(answers)
				.values(
					writes.map((question) => ({
						attemptId,
						questionId: question.id,
						selectedIndex: merged.get(question.id) ?? null
					}))
				)
				.onConflictDoUpdate({
					target: [answers.attemptId, answers.questionId],
					set: { selectedIndex: sql`excluded.selected_index` }
				});
		}
		const clearIds = questionRows
			.filter((question) => merged.get(question.id) == null && saved.has(question.id))
			.map((question) => question.id);
		if (clearIds.length > 0) {
			await tx
				.update(answers)
				.set({ selectedIndex: null })
				.where(and(eq(answers.attemptId, attemptId), inArray(answers.questionId, clearIds)));
		}

		const score = scoreAttempt(
			questionRows.map((question) => ({
				marksMilli: question.marksMilli,
				negativeMilli: question.negativeMilli,
				correctIndex: question.correctIndex,
				selected: merged.get(question.id) ?? null
			}))
		);
		const now = Date.now();
		const end = Math.min(now, attempt.deadlineAt.getTime());
		const timeTakenSeconds = Math.max(0, Math.round((end - attempt.startedAt.getTime()) / 1000));
		await tx
			.update(attempts)
			.set({
				status: 'submitted',
				submittedAt: new Date(now),
				scoreMilli: score.awarded,
				maxMilli: score.max,
				correctCount: score.correct,
				wrongCount: score.wrong,
				unattemptedCount: score.unattempted,
				percentageTenths: score.percentageTenths,
				accuracyTenths: score.accuracyTenths,
				timeTakenSeconds
			})
			.where(eq(attempts.id, attemptId));
		return attempt.id;
	});
}

export async function loadResult(userId: string, attemptId: string): Promise<AttemptResult | null> {
	const [attempt] = await db()
		.select({
			testId: attempts.testId,
			status: attempts.status,
			title: tests.title,
			scoreMilli: attempts.scoreMilli,
			maxMilli: attempts.maxMilli,
			correct: attempts.correctCount,
			wrong: attempts.wrongCount,
			unattempted: attempts.unattemptedCount,
			percentageTenths: attempts.percentageTenths,
			accuracyTenths: attempts.accuracyTenths,
			timeTakenSeconds: attempts.timeTakenSeconds
		})
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId), eq(attempts.status, 'submitted')))
		.limit(1);
	if (!attempt) return null;

	const rows = await db()
		.select({
			prompt: questions.prompt,
			options: questions.options,
			selected: answers.selectedIndex,
			correctIndex: questions.correctIndex,
			explanation: questions.explanation
		})
		.from(questions)
		.leftJoin(answers, and(eq(answers.questionId, questions.id), eq(answers.attemptId, attemptId)))
		.where(eq(questions.testId, attempt.testId))
		.orderBy(asc(questions.sortOrder), asc(questions.id));

	return {
		testId: attempt.testId,
		title: attempt.title,
		scoreMilli: attempt.scoreMilli ?? 0,
		maxMilli: attempt.maxMilli ?? 0,
		correct: attempt.correct ?? 0,
		wrong: attempt.wrong ?? 0,
		unattempted: attempt.unattempted ?? 0,
		percentageTenths: attempt.percentageTenths ?? 0,
		accuracyTenths: attempt.accuracyTenths ?? 0,
		timeTakenSeconds: attempt.timeTakenSeconds ?? 0,
		questions: rows.map((row) => ({
			prompt: row.prompt,
			options: row.options,
			selected: row.selected,
			correctIndex: row.correctIndex,
			explanation: row.explanation
		}))
	};
}
