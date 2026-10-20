// Courses: Zod inputs + DTOs + pure helpers (client-safe, no server imports).
import { patchOf } from '#lib/zod.ts';
import { z } from 'zod';

/** "SSC CGL: Quant & Reasoning!" -> "ssc-cgl-quant-reasoning". Empty input -> "item". */
export function slugify(s: string): string {
	const slug = s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
	return slug || 'item';
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extracts the 11-char video id from any YouTube URL form (watch, youtu.be, shorts, embed, live, nocookie) or a bare id. */
export function parseYouTubeId(input: string): string | null {
	const s = input.trim();
	if (YT_ID.test(s)) return s;
	let u: URL;
	try {
		u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
	} catch {
		return null;
	}
	const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
	let id: string | null | undefined;
	if (host === 'youtu.be') id = u.pathname.split('/')[1];
	else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		const [, first, second] = u.pathname.split('/');
		if (first === 'watch') id = u.searchParams.get('v');
		else if (['embed', 'shorts', 'live', 'v', 'e'].includes(first ?? '')) id = second;
		else if (u.searchParams.has('v')) id = u.searchParams.get('v');
	}
	return id && YT_ID.test(id) ? id : null;
}

/** Whole-course denominator: the fraction never goes backwards when lessons unlock. */
export const progressPercent = (completed: number, total: number) =>
	total <= 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

const title = z.string().trim().min(1, 'Title is required.').max(200);
/** Form checkboxes send "on"; JSON sends booleans. "false" must stay false (z.coerce.boolean would flip it). */
export const boolish = z.preprocess((v) => v === true || v === 'on' || v === 'true' || v === '1', z.boolean());
const optUuid = z.preprocess((v) => (v === '' ? null : v), z.uuid().nullable().optional());

export const courseInput = z.object({
	title,
	summary: z.string().trim().max(500).default(''),
	description: z.string().max(50_000).default(''),
	instructor: z.string().trim().max(120).default('UCI Faculty'),
	examId: optUuid,
	batchId: optUuid,
	coverFileId: optUuid,
	coverUrl: z.preprocess((v) => (v === '' ? null : v), z.url().nullable().optional()),
	isPaid: z.preprocess((v) => v === true || v === 'true' || v === 'on' || v === '1', z.boolean()).default(false)
});
export const courseUpdate = patchOf(courseInput);
export type CourseInput = z.input<typeof courseInput>;

export const chapterInput = z.object({ title });

export const lessonKinds = ['video', 'reading', 'pdf'] as const;
export const lessonInput = z
	.object({
		title,
		kind: z.enum(lessonKinds).default('video'),
		/** Any YouTube URL or id; parsed server-side. */
		youtube: z.string().trim().max(300).optional(),
		durationSec: z.coerce.number().int().min(0).max(24 * 3600).default(0),
		body: z.string().max(100_000).default(''),
		fileId: optUuid,
		isPreview: boolish.default(false)
	})
	.superRefine((v, ctx) => {
		if (v.kind === 'video' && v.youtube && !parseYouTubeId(v.youtube))
			ctx.addIssue({ code: 'custom', path: ['youtube'], message: 'That is not a YouTube link.' });
	});
export const lessonUpdate = z.object({
	title: title.optional(),
	kind: z.enum(lessonKinds).optional(),
	youtube: z.string().trim().max(300).nullable().optional(),
	durationSec: z.coerce.number().int().min(0).max(24 * 3600).optional(),
	body: z.string().max(100_000).optional(),
	fileId: optUuid,
	isPreview: boolish.optional()
});

export const reorderInput = z.object({ ids: z.array(z.uuid()).min(1).max(1000) });

export const progressInput = z.object({
	positionSec: z.coerce.number().int().min(0).max(24 * 3600).optional(),
	completed: z.boolean().optional()
});

export type LessonKind = (typeof lessonKinds)[number];

export type CourseCard = {
	id: string;
	slug: string;
	title: string;
	summary: string;
	instructor: string;
	examId: string | null;
	batchId: string | null;
	coverFileId: string | null;
	coverUrl: string | null;
	isPaid: boolean; // needs a course product or the exam pass
	lessonCount: number;
	durationSec: number;
	updatedAt: string;
};

export type LessonDTO = {
	id: string;
	chapterId: string;
	title: string;
	kind: LessonKind;
	youtubeId: string | null;
	durationSec: number;
	body: string;
	fileId: string | null;
	isPreview: boolean;
	sortOrder: number;
};
export type ChapterDTO = { id: string; title: string; sortOrder: number; lessons: LessonDTO[] };
export type CourseOutline = CourseCard & { description: string; published: boolean; chapters: ChapterDTO[] };

export type LessonState = { positionSec: number; completed: boolean; updatedAt: string };
export type CourseProgress = { completed: number; total: number; percent: number };
export type ContinueLearning = {
	course: { id: string; slug: string; title: string; coverUrl: string | null };
	lesson: { id: string; title: string; kind: LessonKind; positionSec: number; durationSec: number };
	progress: CourseProgress;
} | null;

/** Lesson after `lessonId` in course order (null at the end). */
export function nextLesson(outline: Pick<CourseOutline, 'chapters'>, lessonId: string): LessonDTO | null {
	const all = outline.chapters.flatMap((c) => c.lessons);
	const i = all.findIndex((l) => l.id === lessonId);
	return i >= 0 ? (all[i + 1] ?? null) : null;
}

/** Where to resume: the last touched lesson unless finished, then the next unfinished one after it, else the first unfinished. */
export function resumeLesson(
	outline: Pick<CourseOutline, 'chapters'>,
	done: Set<string>,
	lastId: string | null
): LessonDTO | null {
	const all = outline.chapters.flatMap((c) => c.lessons);
	const i = lastId ? all.findIndex((l) => l.id === lastId) : -1;
	if (i >= 0 && !done.has(all[i]!.id)) return all[i]!;
	return all.slice(i + 1).find((l) => !done.has(l.id)) ?? all.find((l) => !done.has(l.id)) ?? null;
}
