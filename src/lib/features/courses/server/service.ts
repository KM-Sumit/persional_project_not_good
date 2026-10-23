// Courses -> chapters -> lessons, per-user lesson progress. Drizzle lives only here.
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql, sum, type SQL } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { chapters, courses, lessonProgress, lessons, type User } from '../../../server/db/schema';
import { cached, cacheKeys, invalidate } from '../../../server/cache/index';
import { DomainError, isStaff } from '../../../server/http';
import { userBatchIds } from '../../cohorts/server/service';
import {
	courseInput,
	courseUpdate,
	chapterInput,
	lessonInput,
	lessonUpdate,
	nextLesson,
	parseYouTubeId,
	progressInput,
	progressPercent,
	resumeLesson,
	type ChapterDTO,
	type ContinueLearning,
	type CourseCard,
	type CourseOutline,
	type CourseProgress,
	type LessonDTO,
	type LessonState
} from '../schema';
import { uniqueSlug } from './slug';
import type { z } from 'zod';

type Viewer = Pick<User, 'id' | 'role'>;
const TTL = 300;

// ---------- mapping ----------
type CourseRow = typeof courses.$inferSelect;
type LessonRow = typeof lessons.$inferSelect;

const toLesson = (l: LessonRow): LessonDTO => ({
	id: l.id,
	chapterId: l.chapterId,
	title: l.title,
	kind: l.kind,
	youtubeId: l.youtubeId,
	durationSec: l.durationSec,
	body: l.body,
	fileId: l.fileId,
	isPreview: l.isPreview,
	sortOrder: l.sortOrder
});

const toCard = (c: CourseRow, lessonCount: number, durationSec: number): CourseCard => ({
	id: c.id,
	slug: c.slug,
	title: c.title,
	summary: c.summary,
	instructor: c.instructor,
	examId: c.examId,
	batchId: c.batchId,
	coverFileId: c.coverFileId,
	coverUrl: c.coverUrl,
	isPaid: c.isPaid,
	lessonCount,
	durationSec,
	updatedAt: c.updatedAt.toISOString()
});

async function loadOutline(where: SQL | undefined): Promise<CourseOutline | null> {
	const [c] = await db().select().from(courses).where(where).limit(1);
	if (!c) return null;
	const chs = await db().select().from(chapters).where(eq(chapters.courseId, c.id)).orderBy(asc(chapters.sortOrder), asc(chapters.title));
	const ls = chs.length
		? await db()
				.select()
				.from(lessons)
				.where(inArray(lessons.chapterId, chs.map((ch) => ch.id)))
				.orderBy(asc(lessons.sortOrder), asc(lessons.title))
		: [];
	const chapterDtos: ChapterDTO[] = chs.map((ch) => ({
		id: ch.id,
		title: ch.title,
		sortOrder: ch.sortOrder,
		lessons: ls.filter((l) => l.chapterId === ch.id).map(toLesson)
	}));
	const all = chapterDtos.flatMap((ch) => ch.lessons);
	return {
		...toCard(c, all.length, all.reduce((a, l) => a + l.durationSec, 0)),
		description: c.description,
		published: c.published,
		chapters: chapterDtos
	};
}

async function bust(courseId: string) {
	const [c] = await db().select({ slug: courses.slug }).from(courses).where(eq(courses.id, courseId));
	await invalidate(cacheKeys.catalog, ...(c ? [cacheKeys.course(c.slug)] : []));
}
const courseIdOfChapter = async (chapterId: string) => {
	const [r] = await db().select({ id: chapters.courseId }).from(chapters).where(eq(chapters.id, chapterId));
	if (!r) throw new DomainError(404, 'Chapter not found.');
	return r.id;
};
const courseIdOfLesson = async (lessonId: string) => {
	const [r] = await db()
		.select({ id: chapters.courseId })
		.from(lessons)
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.where(eq(lessons.id, lessonId));
	if (!r) throw new DomainError(404, 'Lesson not found.');
	return r.id;
};

// ---------- staff: courses ----------
export async function listCoursesAdmin(opts: { q?: string; published?: boolean } = {}) {
	const conds = [];
	if (opts.q) conds.push(or(ilike(courses.title, `%${opts.q}%`), ilike(courses.summary, `%${opts.q}%`)));
	if (opts.published !== undefined) conds.push(eq(courses.published, opts.published));
	const rows = await db()
		.select({
			c: courses,
			lessonCount: count(lessons.id),
			durationSec: sum(lessons.durationSec)
		})
		.from(courses)
		.leftJoin(chapters, eq(chapters.courseId, courses.id))
		.leftJoin(lessons, eq(lessons.chapterId, chapters.id))
		.where(conds.length ? and(...conds) : undefined)
		.groupBy(courses.id)
		.orderBy(asc(courses.sortOrder), desc(courses.updatedAt));
	return rows.map((r) => ({ ...toCard(r.c, r.lessonCount, Number(r.durationSec ?? 0)), published: r.c.published }));
}

export async function getCourseAdmin(id: string): Promise<CourseOutline> {
	const o = await loadOutline(eq(courses.id, id));
	if (!o) throw new DomainError(404, 'Course not found.');
	return o;
}

export async function createCourse(raw: z.input<typeof courseInput>) {
	const input = courseInput.parse(raw);
	const slug = await uniqueSlug(input.title, async (s) =>
		Boolean((await db().select({ id: courses.id }).from(courses).where(eq(courses.slug, s)).limit(1)).length)
	);
	const [row] = await db().insert(courses).values({ ...input, slug }).returning({ id: courses.id, slug: courses.slug });
	await invalidate(cacheKeys.catalog);
	return row!;
}

/** The slug never changes after creation: shared links keep working. */
export async function updateCourse(id: string, raw: z.input<typeof courseUpdate>) {
	const input = courseUpdate.parse(raw);
	const [row] = await db().update(courses).set(input).where(eq(courses.id, id)).returning({ id: courses.id });
	if (!row) throw new DomainError(404, 'Course not found.');
	await bust(id);
}

export async function setCoursePublished(id: string, published: boolean) {
	if (published) {
		const o = await getCourseAdmin(id);
		if (!o.chapters.some((ch) => ch.lessons.length)) throw new DomainError(422, 'Add at least one lesson before publishing.');
	}
	await db().update(courses).set({ published }).where(eq(courses.id, id));
	await bust(id);
}

export async function deleteCourse(id: string) {
	await bust(id);
	await db().delete(courses).where(eq(courses.id, id));
}

export async function reorderCourses(ids: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries()) await tx.update(courses).set({ sortOrder: i }).where(eq(courses.id, id));
	});
	await invalidate(cacheKeys.catalog);
}

// ---------- staff: chapters ----------
export async function addChapter(courseId: string, raw: z.input<typeof chapterInput>) {
	const { title } = chapterInput.parse(raw);
	const [{ n }] = (await db().select({ n: count() }).from(chapters).where(eq(chapters.courseId, courseId))) as [{ n: number }];
	const [row] = await db().insert(chapters).values({ courseId, title, sortOrder: n }).returning({ id: chapters.id });
	await bust(courseId);
	return row!;
}

export async function updateChapter(id: string, raw: z.input<typeof chapterInput>) {
	const { title } = chapterInput.parse(raw);
	const courseId = await courseIdOfChapter(id);
	await db().update(chapters).set({ title }).where(eq(chapters.id, id));
	await bust(courseId);
}

export async function deleteChapter(id: string) {
	const courseId = await courseIdOfChapter(id);
	await db().delete(chapters).where(eq(chapters.id, id));
	await bust(courseId);
}

export async function reorderChapters(courseId: string, ids: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries())
			await tx.update(chapters).set({ sortOrder: i }).where(and(eq(chapters.id, id), eq(chapters.courseId, courseId)));
	});
	await bust(courseId);
}

// ---------- staff: lessons ----------
const lessonFields = (youtube: string | null | undefined) =>
	youtube === undefined ? {} : { youtubeId: youtube ? parseYouTubeId(youtube) : null };

export async function addLesson(chapterId: string, raw: z.input<typeof lessonInput>) {
	const { youtube, ...input } = lessonInput.parse(raw);
	if (input.kind === 'video' && !youtube && !input.fileId) throw new DomainError(422, 'Add a YouTube link or upload the video.');
	const courseId = await courseIdOfChapter(chapterId);
	const [{ n }] = (await db().select({ n: count() }).from(lessons).where(eq(lessons.chapterId, chapterId))) as [{ n: number }];
	const [row] = await db()
		.insert(lessons)
		.values({ ...input, ...lessonFields(youtube), chapterId, sortOrder: n })
		.returning({ id: lessons.id });
	await bust(courseId);
	return row!;
}

export async function updateLesson(id: string, raw: z.input<typeof lessonUpdate>) {
	const { youtube, ...input } = lessonUpdate.parse(raw);
	if (youtube && !parseYouTubeId(youtube)) throw new DomainError(422, 'That is not a YouTube link.');
	const courseId = await courseIdOfLesson(id);
	await db()
		.update(lessons)
		.set({ ...input, ...lessonFields(youtube) })
		.where(eq(lessons.id, id));
	await bust(courseId);
}

export async function deleteLesson(id: string) {
	const courseId = await courseIdOfLesson(id);
	await db().delete(lessons).where(eq(lessons.id, id));
	await bust(courseId);
}

/** ids = the chapter's lessons in their new order. A lesson id from another chapter is moved into this one. */
export async function reorderLessons(chapterId: string, ids: string[]) {
	const courseId = await courseIdOfChapter(chapterId);
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries()) await tx.update(lessons).set({ sortOrder: i, chapterId }).where(eq(lessons.id, id));
	});
	await bust(courseId);
}

// ---------- public / student reads ----------
/** Every published course card (batch-only ones included; filter with visibleTo). */
export const catalog = () =>
	cached(cacheKeys.catalog, TTL, async () => (await listCoursesAdmin({ published: true })).map(({ published: _, ...c }) => c as CourseCard));

/** Public site: published courses open to everyone. */
export const publicCatalog = async () => (await catalog()).filter((c) => !c.batchId);

/** Published outline by slug (no per-user state). */
export const outline = (slug: string) =>
	cached(cacheKeys.course(slug), TTL, async () => (await loadOutline(and(eq(courses.slug, slug), eq(courses.published, true)))) ?? undefined);

async function canSee(viewer: Viewer, batchId: string | null, batchIds?: Set<string>) {
	if (!batchId || isStaff(viewer)) return true;
	return (batchIds ?? new Set(await userBatchIds(viewer.id))).has(batchId);
}

async function stateFor(userId: string, lessonIds: string[]) {
	if (!lessonIds.length) return new Map<string, LessonState>();
	const rows = await db()
		.select()
		.from(lessonProgress)
		.where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));
	return new Map(
		rows.map((r) => [
			r.lessonId,
			{ positionSec: r.positionSec, completed: Boolean(r.completedAt), updatedAt: r.updatedAt.toISOString() }
		])
	);
}

/** Courses a student can open, with their progress. */
export async function coursesForUser(viewer: Viewer) {
	const batchIds = new Set(await userBatchIds(viewer.id));
	const cards = [];
	for (const c of await catalog()) if (await canSee(viewer, c.batchId, batchIds)) cards.push(c);
	const done = await completedByCourse(viewer.id, cards.map((c) => c.id));
	return cards.map((c) => ({ ...c, progress: { completed: done.get(c.id) ?? 0, total: c.lessonCount, percent: progressPercent(done.get(c.id) ?? 0, c.lessonCount) } }));
}

async function completedByCourse(userId: string, courseIds: string[]) {
	if (!courseIds.length) return new Map<string, number>();
	const rows = await db()
		.select({ courseId: chapters.courseId, n: count() })
		.from(lessonProgress)
		.innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.where(and(eq(lessonProgress.userId, userId), isNotNull(lessonProgress.completedAt), inArray(chapters.courseId, courseIds)))
		.groupBy(chapters.courseId);
	return new Map(rows.map((r) => [r.courseId, r.n]));
}

export async function courseProgress(userId: string, courseId: string): Promise<CourseProgress> {
	const [{ total }] = (await db()
		.select({ total: count() })
		.from(lessons)
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.where(eq(chapters.courseId, courseId))) as [{ total: number }];
	const completed = (await completedByCourse(userId, [courseId])).get(courseId) ?? 0;
	return { completed, total, percent: progressPercent(completed, total) };
}

/** Course page for a signed-in student: outline + per-lesson state + where to resume. */
export async function courseForUser(viewer: Viewer, slug: string) {
	const o = await outline(slug);
	if (!o || !(await canSee(viewer, o.batchId))) throw new DomainError(404, 'Course not found.');
	const all = o.chapters.flatMap((ch) => ch.lessons);
	const state = await stateFor(viewer.id, all.map((l) => l.id));
	const done = new Set([...state].filter(([, s]) => s.completed).map(([id]) => id));
	const last = [...state].sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0]?.[0] ?? null;
	return {
		course: o,
		state: Object.fromEntries(state) as Record<string, LessonState>,
		progress: { completed: done.size, total: all.length, percent: progressPercent(done.size, all.length) },
		resume: resumeLesson(o, done, last)
	};
}

/** Lesson player page. */
export async function lessonForUser(viewer: Viewer, slug: string, lessonId: string) {
	const page = await courseForUser(viewer, slug);
	const all = page.course.chapters.flatMap((ch) => ch.lessons);
	const i = all.findIndex((l) => l.id === lessonId);
	if (i < 0) throw new DomainError(404, 'Lesson not found.');
	return {
		...page,
		lesson: all[i]!,
		lessonState: page.state[lessonId] ?? null,
		prev: all[i - 1] ?? null,
		next: nextLesson(page.course, lessonId)
	};
}

/** Public course page: published + open to everyone; preview lessons keep their media, others are stripped. */
export async function publicCourse(slug: string) {
	const o = await outline(slug);
	if (!o || o.batchId) return null;
	return {
		...o,
		chapters: o.chapters.map((ch) => ({
			...ch,
			lessons: ch.lessons.map((l) => (l.isPreview ? l : { ...l, youtubeId: null, body: '', fileId: null }))
		}))
	};
}

/** Saves the resume point; completed=true stamps completion once, false clears it. */
export async function saveLessonProgress(viewer: Viewer, lessonId: string, raw: z.input<typeof progressInput>) {
	const input = progressInput.parse(raw);
	const [l] = await db()
		.select({ batchId: courses.batchId, published: courses.published, courseId: courses.id })
		.from(lessons)
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.innerJoin(courses, eq(courses.id, chapters.courseId))
		.where(eq(lessons.id, lessonId));
	if (!l || (!l.published && !isStaff(viewer)) || !(await canSee(viewer, l.batchId))) throw new DomainError(404, 'Lesson not found.');
	const completedAt =
		input.completed === undefined ? undefined : input.completed ? sql`coalesce(${lessonProgress.completedAt}, now())` : null;
	await db()
		.insert(lessonProgress)
		.values({ userId: viewer.id, lessonId, positionSec: input.positionSec ?? 0, completedAt: input.completed ? new Date() : null })
		.onConflictDoUpdate({
			target: [lessonProgress.userId, lessonProgress.lessonId],
			set: {
				updatedAt: new Date(),
				...(input.positionSec !== undefined ? { positionSec: input.positionSec } : {}),
				...(completedAt !== undefined ? { completedAt } : {})
			}
		});
	return courseProgress(viewer.id, l.courseId);
}

/** Home "continue learning": the most recently touched lesson of a visible published course. */
export async function continueLearning(viewer: Viewer): Promise<ContinueLearning> {
	const rows = await db()
		.select({ slug: courses.slug, lessonId: lessonProgress.lessonId })
		.from(lessonProgress)
		.innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.innerJoin(courses, eq(courses.id, chapters.courseId))
		.where(and(eq(lessonProgress.userId, viewer.id), eq(courses.published, true)))
		.orderBy(desc(lessonProgress.updatedAt))
		.limit(5);
	for (const r of rows) {
		const page = await courseForUser(viewer, r.slug).catch(() => null);
		if (!page) continue;
		const l = page.resume ?? page.course.chapters.flatMap((ch) => ch.lessons).find((x) => x.id === r.lessonId)!;
		return {
			course: { id: page.course.id, slug: page.course.slug, title: page.course.title, coverUrl: page.course.coverUrl },
			lesson: { id: l.id, title: l.title, kind: l.kind, positionSec: page.state[l.id]?.positionSec ?? 0, durationSec: l.durationSec },
			progress: page.progress
		};
	}
	return null;
}

/** Courses a user has touched but not finished (profile stats). */
export async function coursesInProgressCount(userId: string) {
	const rows = await db().execute<{ n: number }>(sql`
		select count(*)::int as n from (
			select ch.course_id
			from ${lessonProgress} lp
			join ${lessons} l on l.id = lp.lesson_id
			join ${chapters} ch on ch.id = l.chapter_id
			where lp.user_id = ${userId}
			group by ch.course_id
			having count(lp.completed_at) < (
				select count(*) from ${lessons} l2 join ${chapters} c2 on c2.id = l2.chapter_id where c2.course_id = ch.course_id
			)
		) t`);
	return Number(rows[0]?.n ?? 0);
}
