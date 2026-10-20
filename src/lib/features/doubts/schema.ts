// Doubts: a student asks (text + optional photo, maybe linked to a lesson or question), staff answer.
// Status: open -> answered (answer not yet read by the student) -> closed (student opened the answer).
// The schema has no per-user notification, so "answered" doubles as the student's unread dot.
import { z } from 'zod';

export const DOUBT_STATUSES = ['open', 'answered', 'closed'] as const;
export type DoubtStatus = (typeof DOUBT_STATUSES)[number];

const optId = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.uuid().optional());

export const askInput = z.object({
	body: z.string().trim().min(5, 'Write your doubt in a few more words.').max(2000, 'Keep it under 2000 characters.'),
	lessonId: optId,
	questionId: optId
});
export type AskInput = z.input<typeof askInput>;

export const answerInput = z.object({
	answer: z.string().trim().min(2, 'Write the answer first.').max(8000, 'Keep the answer under 8000 characters.')
});

/** Queue filter: 'answered' covers answered + closed (the student's read state is not staff's concern). */
export const QUEUE_FILTERS = ['open', 'answered'] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];

export type DoubtDto = {
	id: string;
	body: string;
	status: DoubtStatus;
	/** Answered and not yet opened by the student. */
	unread: boolean;
	imageUrl: string | null;
	lessonId: string | null;
	questionId: string | null;
	/** "Lesson: Percentages basics" / "Question: A train 120 m long ..." */
	context: string | null;
	contextHref: string | null;
	answer: string | null;
	answerHtml: string | null;
	createdAt: string;
	answeredAt: string | null;
};

export type StaffDoubtDto = DoubtDto & {
	aiDraft: string | null;
	student: { id: string; name: string; email: string };
	examId: string | null;
	answeredBy: string | null;
};

export type Page<T> = { items: T[]; next: string | null };

export const asFilter = (v: string | null | undefined): QueueFilter | null =>
	(QUEUE_FILTERS as readonly string[]).includes(v ?? '') ? (v as QueueFilter) : null;
