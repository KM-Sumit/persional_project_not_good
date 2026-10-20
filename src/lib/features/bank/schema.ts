// Question bank: Zod inputs + DTOs. Client-safe (no server imports).
import { patchOf } from '#lib/zod.ts';
import { z } from 'zod';

// ---------- form-friendly primitives (FormData sends strings; JSON sends real types) ----------
const blankToNull = (v: unknown) => (v === '' ? null : v);
export const optUuid = () => z.preprocess(blankToNull, z.uuid().nullish());
export const optStr = (max: number) => z.string().trim().max(max).default('');
export const boolish = () =>
	z.preprocess((v) => (v === 'on' || v === 'true' || v === '1' ? true : v === 'false' || v === '0' || v === '' ? false : v), z.boolean());
export const cursorQuery = {
	cursor: z.string().max(200).nullish(),
	limit: z.coerce.number().int().min(1).max(100).default(30)
};

export const difficultyEnum = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultyEnum>;
export const questionSourceEnum = z.enum(['manual', 'import', 'ai_topic', 'ai_pdf']);
export type QuestionSource = z.infer<typeof questionSourceEnum>;

export const moduleInput = z.object({
	name: z.string().trim().min(1, 'Name the module.').max(200),
	subjectId: optUuid(),
	examId: optUuid()
});
export type ModuleInput = z.infer<typeof moduleInput>;

/** Options arrive as strings or as { text } objects (AI output, legacy JSON). */
const optionText = z.preprocess(
	(v) => (v && typeof v === 'object' && 'text' in v ? (v as { text: unknown }).text : v),
	z.string().trim().min(1, 'Options cannot be empty.').max(1000)
);

const questionShape = z.object({
	prompt: z.string().trim().min(1, 'Write the question.').max(5000),
	options: z.array(optionText).min(2, 'Give at least 2 options.').max(6, 'At most 6 options.'),
	correctIndex: z.coerce.number().int().min(0),
	explanation: optStr(5000),
	topic: optStr(200),
	difficulty: difficultyEnum.default('medium'),
	imageFileId: optUuid()
});
const correctInRange = (q: { options: string[]; correctIndex: number }) => q.correctIndex < q.options.length;
const correctMsg = { message: 'The correct option must be one of the options.', path: ['correctIndex'] };

export const questionInput = questionShape.refine(correctInRange, correctMsg);
export type QuestionInput = z.infer<typeof questionInput>;
export const questionPatch = patchOf(questionShape);
export type QuestionPatch = z.infer<typeof questionPatch>;

export const moveQuestionsInput = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	moduleId: z.uuid().nullable()
});

export const questionSearch = z.object({
	q: z.string().trim().max(200).optional(),
	topic: z.string().trim().max(200).optional(),
	difficulty: difficultyEnum.optional(),
	moduleId: z.union([z.uuid(), z.literal('none')]).optional(), // 'none' = unfiled
	...cursorQuery
});
export type QuestionSearch = z.input<typeof questionSearch>;

// ---------- DTOs ----------
export type DifficultyCounts = Record<Difficulty, number>;
export type ModuleDTO = {
	id: string;
	name: string;
	subjectId: string | null;
	examId: string | null;
	ownerId: string | null;
	questionCount: number;
	counts: DifficultyCounts;
	createdAt: string;
	updatedAt: string;
};
export type QuestionDTO = {
	id: string;
	moduleId: string | null;
	prompt: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	topic: string;
	difficulty: Difficulty;
	imageFileId: string | null;
	source: QuestionSource;
	createdAt: string;
	updatedAt: string;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ImportReport = {
	inserted: number;
	ids: string[];
	duplicates: { row: number; prompt: string }[];
	errors: { row: number; message: string }[];
};
