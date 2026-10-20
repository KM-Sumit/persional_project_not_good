import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { academicSessions, courses, users } from '../../../server/db/schema';
import * as cohorts from '../../cohorts/server/service';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const courseIds: string[] = [];
const userIds: string[] = [];
const sessionIds: string[] = [];
afterAll(async () => {
	if (courseIds.length) await db().delete(courses).where(inArray(courses.id, courseIds));
	if (userIds.length) await db().delete(users).where(inArray(users.id, userIds));
	if (sessionIds.length) await db().delete(academicSessions).where(inArray(academicSessions.id, sessionIds));
});

test('course CRUD, unique slugs, reorder, progress, continue learning, batch visibility', async () => {
	const title = `Test Course ${tag}`;
	const a = await svc.createCourse({ title });
	const b = await svc.createCourse({ title });
	courseIds.push(a.id, b.id);
	expect(a.slug).toBe(`test-course-${tag}`);
	expect(b.slug).toBe(`test-course-${tag}-2`);

	const ch1 = await svc.addChapter(a.id, { title: 'One' });
	const ch2 = await svc.addChapter(a.id, { title: 'Two' });
	await svc.reorderChapters(a.id, [ch2.id, ch1.id]);
	await expect(svc.setCoursePublished(a.id, true)).rejects.toThrow('at least one lesson');
	const l1 = await svc.addLesson(ch1.id, { title: 'Video', kind: 'video', youtube: 'https://youtu.be/dQw4w9WgXcQ', durationSec: 600 });
	const l2 = await svc.addLesson(ch1.id, { title: 'Read', kind: 'reading', body: '# Hi' });
	const l3 = await svc.addLesson(ch2.id, { title: 'Read 2', kind: 'reading', body: 'x' });
	await expect(svc.addLesson(ch1.id, { title: 'Bad', kind: 'video', youtube: 'https://vimeo.com/1' })).rejects.toThrow();
	await svc.reorderLessons(ch1.id, [l2.id, l1.id]);

	const admin = await svc.getCourseAdmin(a.id);
	expect(admin.chapters.map((c) => c.title)).toEqual(['Two', 'One']);
	expect(admin.chapters[1]!.lessons.map((l) => l.title)).toEqual(['Read', 'Video']);
	expect(admin.chapters[1]!.lessons[1]!.youtubeId).toBe('dQw4w9WgXcQ');
	expect(admin.lessonCount).toBe(3);

	await svc.setCoursePublished(a.id, true);
	expect((await svc.catalog()).some((c) => c.id === a.id)).toBe(true);
	expect((await svc.publicCatalog()).some((c) => c.id === a.id)).toBe(true);

	const [u] = await db().insert(users).values({ email: `course-${tag}@test.local`, name: 'Learner' }).returning();
	userIds.push(u!.id);
	const viewer = { id: u!.id, role: 'student' as const };

	expect(await svc.continueLearning(viewer)).toBeNull();
	await svc.saveLessonProgress(viewer, l1.id, { positionSec: 120 });
	let p = await svc.saveLessonProgress(viewer, l3.id, { completed: true });
	expect(p).toEqual({ completed: 1, total: 3, percent: 33 });
	p = await svc.saveLessonProgress(viewer, l1.id, { completed: true });
	expect(p.percent).toBe(67);
	await svc.saveLessonProgress(viewer, l1.id, { positionSec: 300 }); // keeps completion
	expect((await svc.courseProgress(u!.id, a.id)).completed).toBe(2);
	await svc.saveLessonProgress(viewer, l1.id, { completed: false });
	expect((await svc.courseProgress(u!.id, a.id)).completed).toBe(1);

	const page = await svc.courseForUser(viewer, a.slug);
	expect(page.state[l1.id]?.positionSec).toBe(300);
	expect(page.resume?.id).toBe(l1.id);
	const cl = await svc.continueLearning(viewer);
	expect(cl?.course.id).toBe(a.id);
	expect(cl?.lesson.id).toBe(l1.id);
	expect(cl?.lesson.positionSec).toBe(300);

	const lp = await svc.lessonForUser(viewer, a.slug, l2.id);
	expect(lp.next?.id).toBe(l1.id);
	expect(lp.prev?.id).toBe(l3.id);
	expect(await svc.coursesInProgressCount(u!.id)).toBe(1);

	// batch-only course: hidden until the student joins the batch
	const s = await cohorts.createSession({ name: `T${tag}`, startsOn: '2050-04-01', endsOn: '2051-03-31' });
	sessionIds.push(s.id);
	const batch = await cohorts.createBatch({ sessionId: s.id, name: 'B' });
	await svc.updateCourse(a.id, { batchId: batch.id });
	await expect(svc.courseForUser(viewer, a.slug)).rejects.toThrow('not found');
	expect((await svc.coursesForUser(viewer)).some((c) => c.id === a.id)).toBe(false);
	expect((await svc.publicCatalog()).some((c) => c.id === a.id)).toBe(false);
	await cohorts.joinByCode(u!.id, { code: batch.joinCode });
	const mine = (await svc.coursesForUser(viewer)).find((c) => c.id === a.id);
	expect(mine?.progress.percent).toBe(33);

	await svc.deleteLesson(l2.id);
	await svc.deleteChapter(ch2.id);
	expect((await svc.getCourseAdmin(a.id)).lessonCount).toBe(1);
});
