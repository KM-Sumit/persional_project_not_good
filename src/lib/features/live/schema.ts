// Live classes: Zod inputs + DTOs. Client pages use `import type` only (runtime helpers live in format.ts).
import { z } from 'zod';
import { patchOf } from '#lib/zod.ts';
import { parseYouTubeId } from '#lib/features/courses/schema';

export type LiveStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

const optId = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.uuid().nullable());
const flag = z.preprocess((v) => v === true || v === 'on' || v === 'true' || v === '1', z.boolean());

export const liveInput = z.object({
	title: z.string().trim().min(3, 'Give the class a title.').max(160),
	description: z.string().trim().max(2000).default(''),
	teacher: z.string().trim().min(2, 'Add the teacher name.').max(80).default('UCI Faculty'),
	examId: optId.default(null),
	batchId: optId.default(null),
	courseId: optId.default(null),
	startsAt: z.iso.datetime({ offset: true, error: 'Pick the start date and time.' }),
	durationMin: z.coerce.number().int().min(10, 'At least 10 minutes.').max(480, 'At most 8 hours.').default(60),
	isPaid: flag.default(false)
});
export const liveUpdate = patchOf(liveInput);

/** Any YouTube link (watch, live, youtu.be, embed) or a bare 11-char id. */
export const streamInput = z.object({
	stream: z
		.string()
		.trim()
		.min(1, 'Paste the YouTube Live link.')
		.max(300)
		.refine((s) => parseYouTubeId(s) !== null, 'That is not a YouTube link.')
		.transform((s) => parseYouTubeId(s)!)
});

export const endInput = z.object({
	saveAsLesson: flag.default(false),
	chapterId: optId.default(null),
	lessonTitle: z.string().trim().max(160).default('')
});

export type LiveClassDTO = {
	id: string;
	title: string;
	description: string;
	teacher: string;
	examId: string | null;
	batchId: string | null;
	courseId: string | null;
	startsAt: string;
	endsAt: string;
	durationMin: number;
	status: LiveStatus;
	/** Null for students when the class is locked. */
	youtubeId: string | null;
	lessonId: string | null;
	isPaid: boolean;
	/** Paid class the viewer has no access to. */
	locked: boolean;
};

export type LiveDay = { key: number; label: string; items: LiveClassDTO[] };
export type Timetable = { live: LiveClassDTO[]; today: LiveClassDTO[]; week: LiveDay[]; recordings: LiveClassDTO[] };
