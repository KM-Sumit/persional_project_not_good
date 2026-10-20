// Tests + attempts: Zod inputs and DTOs. Client-safe.
import { z } from 'zod';
import { boolish, cursorQuery, difficultyEnum, optStr, optUuid, questionInput, type Difficulty } from '../bank/schema';

export const testKindEnum = z.enum(['practice', 'mock', 'pyq', 'live', 'daily']); // daily: one-day quiz (current affairs), practice rules
export const testAccessEnum = z.enum(['open', 'password', 'paid']);
export const testStatusEnum = z.enum(['draft', 'published', 'cancelled', 'archived']);
export type TestKind = z.infer<typeof testKindEnum>;
export type TestAccess = z.infer<typeof testAccessEnum>;
export type TestStatus = z.infer<typeof testStatusEnum>;
export type WindowState = 'upcoming' | 'live' | 'ended';

const blankToNull = (v: unknown) => (v === '' ? null : v);
const optDate = () => z.preprocess(blankToNull, z.iso.datetime({ offset: true }).nullish());
const optInt = (min: number, max: number) => z.preprocess(blankToNull, z.coerce.number().int().min(min).max(max).nullish());

export const testFields = z.object({
	title: z.string().trim().min(1, 'Give the test a title.').max(200),
	description: optStr(2000),
	instructions: optStr(10000),
	kind: testKindEnum.default('practice'),
	access: testAccessEnum.default('open'),
	examId: optUuid(),
	subjectId: optUuid(),
	sessionId: optUuid(),
	batchId: optUuid(),
	difficulty: difficultyEnum.default('medium'),
	durationMin: z.coerce.number().int().min(1).max(600).default(30),
	marksPerQuestion: z.coerce.number().min(0.25).max(100).default(1),
	negativeMarks: z.coerce.number().min(0).max(100).default(0),
	priceInr: optInt(0, 1_000_000),
	startsAt: optDate(),
	endsAt: optDate(),
	maxAttempts: optInt(1, 100),
	shuffleQuestions: boolish().default(false),
	showSolutions: boolish().default(true),
	year: optInt(1950, 2100),
	shift: z.preprocess(blankToNull, z.string().trim().max(50).nullish()),
	language: z.string().trim().min(1).max(50).default('English'),
	sourceInfo: optStr(500),
	verifiedPyq: boolish().default(false),
	/** access=password: custom password; empty = generate one (returned once). */
	password: z.preprocess(blankToNull, z.string().min(4, 'Password needs at least 4 characters.').max(64).nullish())
});
export const testCreate = testFields;
export type TestCreate = z.input<typeof testCreate>;
/** Update: only keys present in the raw input are applied (partial() keeps defaults, so the service filters). */
export const testPatch = testFields.partial();
export type TestPatch = z.input<typeof testPatch>;

export const testListQuery = z.object({
	sessionId: z.uuid().optional(),
	kind: testKindEnum.optional(),
	status: testStatusEnum.optional(),
	access: testAccessEnum.optional(),
	examId: z.uuid().optional(),
	q: z.string().trim().max(200).optional(),
	...cursorQuery
});
export type TestListQuery = z.input<typeof testListQuery>;

export const grantInput = z
	.object({ userId: optUuid(), email: z.preprocess(blankToNull, z.email().nullish()), note: optStr(200) })
	.refine((g) => g.userId || g.email, { message: 'Pick a student or enter their email.' });

export const inlineQuestionInput = z.object({
	question: questionInput,
	moduleId: optUuid(),
	marks: z.preprocess(blankToNull, z.coerce.number().min(0).max(100).nullish()),
	negativeMarks: z.preprocess(blankToNull, z.coerce.number().min(0).max(100).nullish())
});
export const questionMarksInput = z.object({
	marks: z.preprocess(blankToNull, z.coerce.number().min(0).max(100).nullable()),
	negativeMarks: z.preprocess(blankToNull, z.coerce.number().min(0).max(100).nullable())
});

export const buildFromModulesInput = z
	.array(z.object({ moduleId: z.uuid(), count: z.coerce.number().int().min(1).max(500), difficulty: difficultyEnum.optional() }))
	.min(1)
	.max(50);

export const startInput = z.object({ password: z.string().max(64).optional() });
export const saveAnswerInput = z.object({
	questionId: z.uuid(),
	selected: z.number().int().min(0).max(5).nullable(),
	marked: z.boolean().default(false),
	timeSpentDelta: z.number().int().min(0).max(3600).default(0)
});
export type SaveAnswerInput = z.input<typeof saveAnswerInput>;

// ---------- DTOs ----------
export type TestDTO = {
	id: string;
	title: string;
	description: string;
	instructions: string;
	kind: TestKind;
	access: TestAccess;
	status: TestStatus;
	examId: string | null;
	subjectId: string | null;
	sessionId: string | null;
	batchId: string | null;
	difficulty: Difficulty;
	durationMin: number;
	marksPerQuestion: number;
	negativeMarks: number;
	priceInr: number | null;
	startsAt: string | null;
	endsAt: string | null;
	maxAttempts: number | null;
	shuffleQuestions: boolean;
	showSolutions: boolean;
	year: number | null;
	shift: string | null;
	language: string;
	sourceInfo: string;
	verifiedPyq: boolean;
	hasPassword: boolean;
	questionCount: number;
	totalMarks: number;
	attemptCount: number;
	window: WindowState;
	createdAt: string;
	updatedAt: string;
};
/** create/update/setPassword: `password` is the plaintext, present once, only when one was set. */
export type TestSaved = { test: TestDTO; password: string | null };
export type TestList = { items: TestDTO[]; nextCursor: string | null; counts: Record<'all' | TestStatus, number> };

export type TestQuestionDTO = {
	questionId: string;
	sortOrder: number;
	marks: number | null;
	negativeMarks: number | null;
	prompt: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	topic: string;
	difficulty: Difficulty;
	moduleId: string | null;
};
export type GrantDTO = { userId: string; name: string; email: string; note: string; createdAt: string };
export type BuildReport = { added: number; shortfalls: { moduleId: string; requested: number; added: number }[] };

/** Student catalog card: published test + this user's state. */
export type CatalogCard = {
	id: string;
	title: string;
	description: string;
	kind: TestKind;
	access: TestAccess;
	examId: string | null;
	subjectId: string | null;
	difficulty: Difficulty;
	durationMin: number;
	marksPerQuestion: number;
	negativeMarks: number;
	priceInr: number | null;
	startsAt: string | null;
	endsAt: string | null;
	year: number | null;
	shift: string | null;
	language: string;
	verifiedPyq: boolean;
	questionCount: number;
	totalMarks: number;
	window: WindowState;
	maxAttempts: number | null; // effective (live = 1)
	attemptsUsed: number;
	bestScore: number | null;
	inProgressAttemptId: string | null;
	/** What stands between the user and Start: password entry, or a paid grant. */
	lock: 'password' | 'paid' | null;
	canStart: boolean;
};
export type HistoryItem = {
	attemptId: string;
	testId: string;
	testTitle: string;
	kind: TestKind;
	number: number;
	status: 'in_progress' | 'submitted' | 'expired';
	score: number | null;
	maxScore: number | null;
	percentage: number | null;
	startedAt: string;
	submittedAt: string | null;
	timeTakenSec: number | null;
};
export type TestDetail = CatalogCard & { instructions: string; sourceInfo: string; showSolutions: boolean; attempts: HistoryItem[] };

export type AttemptScreen =
	| { state: 'closed'; attemptId: string }
	| {
			state: 'open';
			attemptId: string;
			test: { id: string; title: string; kind: TestKind; durationMin: number; marksPerQuestion: number; negativeMarks: number };
			questions: {
				id: string;
				prompt: string;
				options: string[];
				topic: string;
				imageFileId: string | null;
				marks: number;
				negativeMarks: number;
			}[];
			answers: Record<string, { selected: number | null; marked: boolean; timeSpentSec: number }>;
			startedAt: string;
			deadlineAt: string;
			serverNow: string;
	  };

export type ResultDTO = {
	attemptId: string;
	test: { id: string; title: string; kind: TestKind };
	userId: string;
	status: 'submitted' | 'expired';
	number: number;
	score: number;
	maxScore: number;
	percentage: number;
	correct: number;
	wrong: number;
	skipped: number;
	accuracy: number; // correct / attempted, %
	timeTakenSec: number;
	startedAt: string;
	submittedAt: string | null;
	rank: number;
	percentile: number;
	participants: number;
	solutionsVisible: boolean;
	questions: {
		id: string;
		prompt: string;
		options: string[];
		topic: string;
		difficulty: Difficulty;
		imageFileId: string | null;
		marks: number;
		negativeMarks: number;
		selected: number | null;
		marked: boolean;
		timeSpentSec: number;
		outcome: 'correct' | 'wrong' | 'skipped';
		correctIndex: number | null; // null while solutions are hidden
		explanation: string | null;
		optionPickPct: number[] | null;
	}[];
	topics: { topic: string; total: number; correct: number; wrong: number; skipped: number; accuracy: number }[];
};

export type ParticipantRow = {
	attemptId: string;
	userId: string;
	name: string;
	email: string;
	phone: string | null;
	number: number;
	status: 'in_progress' | 'submitted' | 'expired';
	score: number | null;
	maxScore: number | null;
	percentage: number | null;
	startedAt: string;
	submittedAt: string | null;
	timeTakenSec: number | null;
};
export type TestStats = {
	started: number;
	submitted: number;
	avg: number | null;
	top: number | null;
	median: number | null;
	questions: { questionId: string; prompt: string; attempted: number; correct: number; accuracy: number }[];
};
