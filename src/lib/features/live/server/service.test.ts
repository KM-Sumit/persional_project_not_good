import { afterAll, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { academicSessions, courses, lessons, liveClasses, users } from '../../../server/db/schema';
import { addChapter, createCourse } from '../../courses/server/service';
import { createBatch, createSession, joinByCode } from '../../cohorts/server/service';
import { canMove, groupTimetable, istDay, visibleTo } from '../format';
import type { LiveClassDTO } from '../schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const liveIds: string[] = [];
const courseIds: string[] = [];
const sessionIds: string[] = [];
const userIds: string[] = [];
afterAll(async () => {
	if (liveIds.length) await db().delete(liveClasses).where(inArray(liveClasses.id, liveIds));
	if (courseIds.length) await db().delete(courses).where(inArray(courses.id, courseIds));
	if (sessionIds.length) await db().delete(academicSessions).where(inArray(academicSessions.id, sessionIds));
	if (userIds.length) await db().delete(users).where(inArray(users.id, userIds));
});

const H = 3600_000;
const cls = (startsAt: string, status: LiveClassDTO['status'] = 'scheduled', extra: Partial<LiveClassDTO> = {}): LiveClassDTO => ({
	id: crypto.randomUUID(),
	title: 't',
	description: '',
	teacher: 'x',
	examId: null,
	batchId: null,
	courseId: null,
	startsAt,
	endsAt: new Date(Date.parse(startsAt) + H).toISOString(),
	durationMin: 60,
	status,
	youtubeId: null,
	lessonId: null,
	isPaid: false,
	locked: false,
	...extra
});

test('status transitions', () => {
	expect(canMove('scheduled', 'live')).toBe(true);
	expect(canMove('live', 'ended')).toBe(true);
	expect(canMove('scheduled', 'ended')).toBe(true);
	expect(canMove('ended', 'live')).toBe(false);
	expect(canMove('cancelled', 'live')).toBe(false);
	expect(canMove('cancelled', 'scheduled')).toBe(true);
});

test('visibility by batch', () => {
	expect(visibleTo({ batchId: null }, { staff: false, batchIds: [] })).toBe(true);
	expect(visibleTo({ batchId: 'b1' }, { staff: false, batchIds: ['b2'] })).toBe(false);
	expect(visibleTo({ batchId: 'b1' }, { staff: false, batchIds: ['b1'] })).toBe(true);
	expect(visibleTo({ batchId: 'b1' }, { staff: true, batchIds: [] })).toBe(true);
});

test('timetable groups by IST day, not UTC day', () => {
	// 2026-10-21 20:00 UTC = 22 Oct 01:30 IST. "Today" in IST is 22 Oct.
	const now = Date.parse('2026-10-21T20:00:00Z');
	expect(istDay(now)).toBe(20261022);
	const t = groupTimetable(
		[
			cls('2026-10-22T04:30:00Z'), // 22 Oct 10:00 IST -> today
			cls('2026-10-21T19:00:00Z', 'live'), // live now
			cls('2026-10-22T19:00:00Z'), // 23 Oct 00:30 IST -> tomorrow
			cls('2026-10-23T05:00:00Z'), // 23 Oct -> tomorrow
			cls('2026-10-30T05:00:00Z'), // beyond 7 days -> dropped
			cls('2026-10-20T05:00:00Z', 'ended', { youtubeId: 'abcdefghijk' }), // recording
			cls('2026-10-19T05:00:00Z', 'ended', { youtubeId: 'abcdefghij2' }), // older recording
			cls('2026-10-19T05:00:00Z', 'ended'), // no video -> no recording
			cls('2026-10-21T10:00:00Z') // scheduled, ended long ago, never started -> stale, hidden
		],
		now
	);
	expect(t.live).toHaveLength(1);
	expect(t.today).toHaveLength(1);
	expect(t.week).toHaveLength(1);
	expect(t.week[0]!.label).toBe('Tomorrow');
	expect(t.week[0]!.items).toHaveLength(2);
	expect(t.recordings.map((r) => r.youtubeId)).toEqual(['abcdefghijk', 'abcdefghij2']);
});

test('schedule, go live, end as lesson; batch visibility and nextLiveFor', async () => {
	const s = await createSession({ name: `L${tag}`, startsOn: '2030-04-01', endsOn: '2031-03-31' });
	sessionIds.push(s.id);
	const b = await createBatch({ sessionId: s.id, name: 'Live batch' });
	const [inB, outB] = await db()
		.insert(users)
		.values([
			{ email: `live-in-${tag}@test.local`, name: 'In' },
			{ email: `live-out-${tag}@test.local`, name: 'Out' }
		])
		.returning();
	userIds.push(inB!.id, outB!.id);
	await joinByCode(inB!.id, { code: b.joinCode });

	const c = await createCourse({ title: `Live course ${tag}` });
	courseIds.push(c.id);
	const ch = await addChapter(c.id, { title: 'Recordings' });

	const soon = new Date(Date.now() + 2 * H).toISOString();
	const a = await svc.createLive({ title: `Batch class ${tag}`, startsAt: soon, batchId: b.id, durationMin: 90 });
	const pub = await svc.createLive({ title: `Open class ${tag}`, startsAt: new Date(Date.now() + 3 * H).toISOString(), isPaid: true, examId: null });
	liveIds.push(a.id, pub.id);
	expect(a.status).toBe('scheduled');
	expect(a.endsAt).toBe(new Date(Date.parse(soon) + 90 * 60_000).toISOString());

	// Batch members see it; others don't, and can't open it.
	const mine = (await svc.timetableFor({ id: inB!.id, role: 'student' })).today.concat(
		(await svc.timetableFor({ id: inB!.id, role: 'student' })).week.flatMap((d) => d.items)
	);
	expect(mine.some((x) => x.id === a.id)).toBe(true);
	await expect(svc.classForUser({ id: outB!.id, role: 'student' }, a.id)).rejects.toThrow('not found');
	const open = await svc.classForUser({ id: outB!.id, role: 'student' }, pub.id);
	expect(open.locked).toBe(true);

	await expect(svc.goLive(a.id, { stream: 'not a link' })).rejects.toThrow('YouTube');
	await expect(svc.endLive(a.id, { saveAsLesson: true, chapterId: ch.id })).rejects.toThrow('YouTube link first');
	const live = await svc.goLive(a.id, { stream: 'https://www.youtube.com/live/dQw4w9WgXcQ?si=x' });
	expect(live.status).toBe('live');
	expect(live.youtubeId).toBe('dQw4w9WgXcQ');
	expect((await svc.nextLiveFor(inB!.id))?.id).toBe(a.id);
	await expect(svc.cancelLive(a.id)).rejects.toThrow('cannot');

	const ended = await svc.endLive(a.id, { saveAsLesson: 'on', chapterId: ch.id, lessonTitle: '' } as never);
	expect(ended.status).toBe('ended');
	const [lesson] = await db().select().from(lessons).where(eq(lessons.id, ended.lessonId!));
	expect(lesson?.youtubeId).toBe('dQw4w9WgXcQ');
	expect(lesson?.title).toBe(`Batch class ${tag}`);
	expect(lesson?.durationSec).toBe(90 * 60);
	await expect(svc.endLive(a.id)).rejects.toThrow('cannot');
	const view = await svc.classForUser({ id: inB!.id, role: 'student' }, a.id);
	expect(view.lessonHref).toContain(ended.lessonId!);

	const cancelled = await svc.cancelLive(pub.id);
	expect(cancelled.status).toBe('cancelled');
	expect((await svc.listLiveAdmin({ view: 'past' })).some((x) => x.id === pub.id)).toBe(true);
});
