import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { attempts, posts, tests, users } from '#lib/server/db/schema';
import { daysBefore, istDate } from '../format';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const ids = { posts: [] as string[], tests: [] as string[], users: [] as string[] };
afterAll(async () => {
	if (ids.posts.length) await db().delete(posts).where(inArray(posts.id, ids.posts));
	if (ids.tests.length) await db().delete(tests).where(inArray(tests.id, ids.tests));
	if (ids.users.length) await db().delete(users).where(inArray(users.id, ids.users));
});

test('posts: create, publish rule, public reads, daily feed and streak', async () => {
	const today = istDate();
	const p = await svc.createPost({ kind: 'current_affairs', title: `CA ${tag}`, publishedOn: today });
	ids.posts.push(p.id);
	expect(p.slug).toBe(`ca-${tag}`);
	await expect(svc.setPostPublished(p.id, true)).rejects.toThrow('Write the post');
	await svc.updatePost(p.id, { body: '## RBI\n\nThe **repo rate** stays at 5.5%.' });
	await svc.setPostPublished(p.id, true);

	expect((await svc.listPublished('current_affairs')).some((x) => x.id === p.id)).toBe(true);
	const page = await svc.publishedBySlug('current_affairs', p.slug);
	expect(page.html).toContain('<strong>repo rate</strong>');
	expect(page.excerpt).toContain('repo rate');
	await expect(svc.publishedBySlug('job_alert', p.slug)).rejects.toThrow('not found');

	const [u] = await db().insert(users).values({ email: `posts-${tag}@test.local`, name: 'Daily' }).returning();
	ids.users.push(u!.id);
	const [t] = await db().insert(tests).values({ title: `Daily ${tag}`, kind: 'daily', status: 'published' }).returning();
	ids.tests.push(t!.id);
	await svc.updatePost(p.id, {}); // no-op patch keeps fields
	await db().update(posts).set({ quizTestId: t!.id }).where(inArray(posts.id, [p.id]));

	let feed = await svc.dailyFeed(u!.id);
	expect(feed.selected).toBe(today);
	expect(feed.post?.id).toBe(p.id);
	expect(feed.quiz?.status).toBe('todo');
	expect(feed.strip.length).toBe(14);
	expect(feed.streak).toBe(0);

	// Finished daily quizzes yesterday and today -> streak 2.
	const at = (d: string) => new Date(Date.parse(d + 'T12:00:00+05:30'));
	await db()
		.insert(attempts)
		.values([daysBefore(today, 1), today].map((d, i) => ({ testId: t!.id, userId: u!.id, number: i + 1, status: 'submitted' as const, questionOrder: [], deadlineAt: at(d), submittedAt: at(d), score: 3 })));
	feed = await svc.dailyFeed(u!.id);
	expect(feed.streak).toBe(2);
	expect(feed.quiz?.status).toBe('done');
	expect(feed.strip.at(-1)).toEqual({ date: today, hasPost: true, done: true });
	const t4 = await svc.todayFor(u!.id);
	expect(t4.post?.slug).toBe(p.slug);
	expect(t4.streak).toBe(2);
});
