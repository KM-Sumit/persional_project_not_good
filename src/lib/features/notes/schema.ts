// Notes: Zod inputs + DTOs (client-safe).
import { patchOf } from '#lib/zod.ts';
import { z } from 'zod';

const optUuid = z.preprocess((v) => (v === '' ? null : v), z.uuid().nullable().optional());

export const noteInput = z.object({
	title: z.string().trim().min(1, 'Title is required.').max(200),
	summary: z.string().trim().max(500).default(''),
	body: z.string().max(200_000).default(''),
	examId: optUuid,
	subjectId: optUuid,
	batchId: optUuid,
	fileId: optUuid,
	isPaid: z.preprocess((v) => v === true || v === 'true' || v === 'on' || v === '1', z.boolean()).default(false)
});
export const noteUpdate = patchOf(noteInput);

export const noteFilter = z.object({
	q: z.string().trim().max(100).optional(),
	examId: z.uuid().optional(),
	subjectId: z.uuid().optional(),
	bookmarked: z.boolean().optional()
});
export type NoteFilter = z.infer<typeof noteFilter>;

export type NoteCard = {
	id: string;
	slug: string;
	title: string;
	summary: string;
	examId: string | null;
	subjectId: string | null;
	batchId: string | null;
	hasPdf: boolean;
	isPaid: boolean; // needs the exam pass
	readingMinutes: number;
	updatedAt: string;
};
export type TocItem = { id: string; text: string; level: 2 | 3 | 4 };
export type NoteDTO = NoteCard & { body: string; html: string; toc: TocItem[]; fileId: string | null; published: boolean; createdAt: string };
