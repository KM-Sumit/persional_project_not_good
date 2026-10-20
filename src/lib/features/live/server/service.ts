// Live classes on YouTube Live: schedule, go live, end (optionally saved as a course lesson), student timetable.
// Drizzle lives only here.
import { and, asc, desc, eq, gte, inArray, isNull, ne, not, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../../server/db/index';
import { chapters, courses, lessons, liveClasses, type User } from '../../../server/db/schema';
import { DomainError, isStaff } from '../../../server/http';
import { listBatches, userBatchIds } from '../../cohorts/server/service';
import { tree } from '../../taxonomy/server/service';
import { addLesson } from '../../courses/server/service';
import { accessScope } from '../../billing/server/service';
import { canMove, groupTimetable, STALE_MS } from '../format';
import { endInput, liveInput, liveUpdate, streamInput, type LiveClassDTO, type LiveStatus, type Timetable } from '../schema';

type Viewer = Pick<User, 'id' | 'role'>;
type Row = typeof liveClasses.$inferSelect;
type Scope = { examIds: Set<string>; courseIds: Set<string> } | null;

const lockedFor = (r: Row, scope: Scope) =>
	r.isPaid && scope !== null && !(r.courseId && scope.courseIds.has(r.courseId)) && !(r.examId && scope.examIds.has(r.examId));

export function toDTO(r: Row, scope: Scope = null): LiveClassDTO {
	const locked = lockedFor(r, scope);
	return {
		id: r.id,
		title: r.title,
		description: r.description,
		teacher: r.teacher,
		examId: r.examId,
		batchId: r.batchId,
		courseId: r.courseId,
		startsAt: r.startsAt.toISOString(),
		endsAt: new Date(r.startsAt.getTime() + r.durationMin * 60_000).toISOString(),
		durationMin: r.durationMin,
		status: r.status,
		youtubeId: locked ? null : r.youtubeId,
		lessonId: r.lessonId,
		isPaid: r.isPaid,
		locked
	};
}

async function row(id: string): Promise<Row> {
	const [r] = await db().select().from(liveClasses).where(eq(liveClasses.id, id)).limit(1);
	if (!r) throw new DomainError(404, 'Live class not found.');
	return r;
}

async function move(id: string, to: LiveStatus, set: Partial<typeof liveClasses.$inferInsert> = {}) {
	const r = await row(id);
	if (!canMove(r.status, to)) throw new DomainError(409, `A ${r.status} class cannot become ${to}.`);
	const [u] = await db()
		.update(liveClasses)
		.set({ ...set, status: to })
		.where(and(eq(liveClasses.id, id), eq(liveClasses.status, r.status))) // lost race = no row
		.returning();
	if (!u) throw new DomainError(409, 'Someone else changed this class. Reload and try again.');
	return toDTO(u);
}

// ---------- staff ----------
export async function listLiveAdmin(opts: { view?: 'upcoming' | 'past' } = {}): Promise<LiveClassDTO[]> {
	const since = new Date(Date.now() - STALE_MS - 8 * 3600_000);
	const past = opts.view === 'past';
	// Upcoming = live, or scheduled and not long past. Everything else (incl. classes never started) is past.
	const upcoming = or(eq(liveClasses.status, 'live'), and(eq(liveClasses.status, 'scheduled'), gte(liveClasses.startsAt, since)));
	const where = past ? not(upcoming!) : upcoming;
	const rows = await db()
		.select()
		.from(liveClasses)
		.where(where)
		.orderBy(past ? desc(liveClasses.startsAt) : asc(liveClasses.startsAt))
		.limit(200);
	return rows.map((r) => toDTO(r));
}

export const getLiveAdmin = async (id: string) => toDTO(await row(id));

export async function createLive(raw: z.input<typeof liveInput>) {
	const v = liveInput.parse(raw);
	const [r] = await db()
		.insert(liveClasses)
		.values({ ...v, startsAt: new Date(v.startsAt) })
		.returning();
	return toDTO(r!);
}

export async function updateLive(id: string, raw: z.input<typeof liveUpdate>) {
	const { startsAt, ...v } = liveUpdate.parse(raw);
	const r = await row(id);
	if (r.status === 'ended') throw new DomainError(409, 'This class has ended. Edit its lesson instead.');
	const [u] = await db()
		.update(liveClasses)
		.set({ ...v, ...(startsAt ? { startsAt: new Date(startsAt) } : {}) })
		.where(eq(liveClasses.id, id))
		.returning();
	return toDTO(u!);
}

/** Go live with the YouTube Live link. Also replaces the stream while live (stream restarted). */
export async function goLive(id: string, raw: z.input<typeof streamInput>) {
	const { stream } = streamInput.parse(raw);
	const r = await row(id);
	if (r.status === 'live') {
		await db().update(liveClasses).set({ youtubeId: stream }).where(eq(liveClasses.id, id));
		return toDTO({ ...r, youtubeId: stream });
	}
	return move(id, 'live', { youtubeId: stream });
}

export const backToScheduled = (id: string) => move(id, 'scheduled');
export const cancelLive = (id: string) => move(id, 'cancelled');

/** End the class. With saveAsLesson, the recording becomes a video lesson in the chosen chapter. */
export async function endLive(id: string, raw: z.input<typeof endInput> = {}) {
	const v = endInput.parse(raw);
	const r = await row(id);
	if (!canMove(r.status, 'ended')) throw new DomainError(409, `A ${r.status} class cannot be ended.`);
	let lessonId: string | null = null;
	if (v.saveAsLesson) {
		if (!r.youtubeId) throw new DomainError(422, 'Add the YouTube link first, so the recording can be saved.');
		if (!v.chapterId) throw new DomainError(422, 'Choose the chapter for the recording.');
		lessonId = (
			await addLesson(v.chapterId, {
				title: v.lessonTitle || r.title,
				kind: 'video',
				youtube: r.youtubeId,
				durationSec: r.durationMin * 60,
				body: r.description
			})
		).id;
	}
	try {
		return await move(id, 'ended', lessonId ? { lessonId } : {});
	} catch (e) {
		if (lessonId) await db().delete(lessons).where(eq(lessons.id, lessonId)); // don't leave a duplicate lesson behind
		throw e;
	}
}

export async function deleteLive(id: string) {
	await row(id);
	await db().delete(liveClasses).where(eq(liveClasses.id, id));
}

// ---------- students ----------
async function viewerScope(v: Viewer): Promise<{ where: SQL | undefined; scope: Scope }> {
	if (isStaff(v)) return { where: undefined, scope: null };
	const [batchIds, scope] = await Promise.all([userBatchIds(v.id), accessScope(v.id)]);
	const where = batchIds.length ? or(isNull(liveClasses.batchId), inArray(liveClasses.batchId, batchIds)) : isNull(liveClasses.batchId);
	return { where, scope };
}

/** Classes from 60 days back (recordings) to 8 days ahead, grouped for the Live tab. */
export async function timetableFor(v: Viewer, now = Date.now()): Promise<Timetable> {
	const { where, scope } = await viewerScope(v);
	const rows = await db()
		.select()
		.from(liveClasses)
		.where(
			and(
				where,
				or(
					eq(liveClasses.status, 'live'),
					and(gte(liveClasses.startsAt, new Date(now - 60 * 86_400_000)), ne(liveClasses.status, 'cancelled')),
					and(eq(liveClasses.status, 'cancelled'), gte(liveClasses.startsAt, new Date(now - 86_400_000)))
				)
			)
		)
		.orderBy(asc(liveClasses.startsAt))
		.limit(500);
	return groupTimetable(
		rows.filter((r) => r.startsAt.getTime() < now + 8 * 86_400_000).map((r) => toDTO(r, scope)),
		now
	);
}

export type LiveClassView = LiveClassDTO & { lessonHref: string | null; courseHref: string | null };

export async function classForUser(v: Viewer, id: string): Promise<LiveClassView> {
	const { where, scope } = await viewerScope(v);
	const [r] = await db()
		.select()
		.from(liveClasses)
		.where(and(eq(liveClasses.id, id), where))
		.limit(1);
	if (!r) throw new DomainError(404, 'Live class not found.');
	const dto = toDTO(r, scope);
	const [lesson] = r.lessonId
		? await db()
				.select({ slug: courses.slug })
				.from(lessons)
				.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
				.innerJoin(courses, eq(courses.id, chapters.courseId))
				.where(eq(lessons.id, r.lessonId))
		: [];
	const [course] = r.courseId ? await db().select({ slug: courses.slug }).from(courses).where(eq(courses.id, r.courseId)) : [];
	return {
		...dto,
		lessonHref: lesson && !dto.locked ? `/app/learn/${lesson.slug}/${r.lessonId}` : null,
		courseHref: course ? `/app/learn/${course.slug}` : null
	};
}

/** Today page hook: the class live now, else the next scheduled one in the next 7 days (null if none). */
export async function nextLiveFor(userId: string, now = Date.now()): Promise<LiveClassDTO | null> {
	const t = await timetableFor({ id: userId, role: 'student' }, now);
	return t.live[0] ?? [...t.today, ...t.week.flatMap((d) => d.items)].find((c) => c.status === 'scheduled') ?? null;
}

type Opt = { value: string; label: string; group?: string };
/** Picker options for the staff forms: exams, open batches, courses, and chapters grouped by course. */
export async function staffOptions(): Promise<{ exams: Opt[]; batches: Opt[]; courses: Opt[]; chapters: (Opt & { courseId: string })[] }> {
	const [taxonomy, bs, cs, chs] = await Promise.all([
		tree(),
		listBatches(),
		db().select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.sortOrder), asc(courses.title)),
		db()
			.select({ id: chapters.id, title: chapters.title, courseId: chapters.courseId })
			.from(chapters)
			.orderBy(asc(chapters.sortOrder), asc(chapters.title))
	]);
	const courseName = new Map(cs.map((c) => [c.id, c.title]));
	return {
		exams: taxonomy.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name }))),
		batches: bs.map((b) => ({ value: b.id, label: b.name, group: b.sessionName })),
		courses: cs.map((c) => ({ value: c.id, label: c.title })),
		chapters: chs.map((ch) => ({ value: ch.id, label: ch.title, group: courseName.get(ch.courseId) ?? '', courseId: ch.courseId }))
	};
}
