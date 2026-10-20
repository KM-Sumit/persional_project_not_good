import { afterAll, beforeAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { academicSessions, banners, batches, batchMembers, notifications, users } from '#lib/server/db/schema';
import { bannerInput, decodeCursor, encodeCursor, hrefSchema, reorderInput, sortPlan } from './schema';
import { createBanner, deleteBanner, inbox, listBanners, markRead, reorderBanners, send, sentList, unreadCount } from './server/service';

test('href accepts in-app paths and https only', () => {
	expect(hrefSchema.safeParse('/app/tests').success).toBe(true);
	expect(hrefSchema.safeParse('https://youtube.com/x').success).toBe(true);
	for (const bad of ['//evil.com', 'javascript:alert(1)', 'http://x.com', 'app'])
		expect(hrefSchema.safeParse(bad).success).toBe(false);
	expect(bannerInput.parse({ title: 'Hi', imageUrl: '' }).imageUrl).toBeNull();
});

test('reorder validates ids and spaces sortOrder', () => {
	const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
	expect(reorderInput.safeParse([a, b]).success).toBe(true);
	expect(reorderInput.safeParse([a, a]).success).toBe(false);
	expect(reorderInput.safeParse([]).success).toBe(false);
	expect(sortPlan([b, a])).toEqual([{ id: b, sortOrder: 10 }, { id: a, sortOrder: 20 }]);
});

test('cursor round-trips and rejects junk', () => {
	const id = crypto.randomUUID();
	const at = '2026-10-20 10:00:00.123456+05:30';
	expect(decodeCursor(encodeCursor(at, id))).toEqual({ createdAt: at, id });
	expect(decodeCursor('not-base64!')).toBeNull();
	expect(decodeCursor(btoa("1'; drop table x|" + id))).toBeNull();
});

// ---------- DB ----------
const tag = crypto.randomUUID().slice(0, 8);
const ids = { users: [] as string[], session: '', batches: [] as string[], notes: [] as string[] };

beforeAll(async () => {
	const us = await db()
		.insert(users)
		.values([0, 1, 2].map((i) => ({ email: `engage-${tag}-${i}@test.local`, name: `T${i}` })))
		.returning({ id: users.id });
	ids.users = us.map((u) => u.id);
	const [s] = await db().insert(academicSessions).values({ name: `test-${tag}`, startsOn: '2026-04-01', endsOn: '2027-03-31' }).returning();
	ids.session = s.id;
	const bs = await db()
		.insert(batches)
		.values([0, 1].map((i) => ({ sessionId: s.id, name: `B${i}`, joinCode: `T${tag}${i}` })))
		.returning({ id: batches.id });
	ids.batches = bs.map((b) => b.id);
	// user0 in batch0, user1 in batch1, user2 in none
	await db().insert(batchMembers).values([
		{ batchId: ids.batches[0], userId: ids.users[0] },
		{ batchId: ids.batches[1], userId: ids.users[1] }
	]);
});

afterAll(async () => {
	if (ids.notes.length) await db().delete(notifications).where(inArray(notifications.id, ids.notes));
	await db().delete(academicSessions).where(inArray(academicSessions.id, [ids.session])); // cascades batches + members
	await db().delete(users).where(inArray(users.id, ids.users));
});

test('inbox shows everyone + own-batch notifications, with read flags and paging', async () => {
	const [u0, u1, u2] = ids.users;
	const all = await send({ title: `all ${tag}` }, u2);
	const b0 = await send({ title: `b0 ${tag}`, batchId: ids.batches[0] }, u2);
	const b1 = await send({ title: `b1 ${tag}`, batchId: ids.batches[1], href: '/app/tests' }, u2);
	ids.notes.push(all.id, b0.id, b1.id);
	const mine = (r: { items: { id: string }[] }) => r.items.map((i) => i.id).filter((id) => ids.notes.includes(id));

	expect(mine(await inbox(u0, null, 100))).toEqual([b0.id, all.id]);
	expect(mine(await inbox(u1, null, 100))).toEqual([b1.id, all.id]);
	expect(mine(await inbox(u2, null, 100))).toEqual([all.id]);

	const before = await unreadCount(u0);
	await markRead(u0, [b0.id, b1.id]); // b1 is not visible to u0: ignored
	expect(await unreadCount(u0)).toBe(before - 1);
	const items = (await inbox(u0, null, 100)).items;
	expect(items.find((i) => i.id === b0.id)?.read).toBe(true);
	expect(items.find((i) => i.id === all.id)?.read).toBe(false);
	await markRead(u0, 'all');
	expect(await unreadCount(u0)).toBe(0);

	// keyset paging walks every item exactly once
	const seen: string[] = [];
	let cursor: string | null = null;
	do {
		const p = await inbox(u0, cursor, 1);
		seen.push(...p.items.map((i) => i.id));
		cursor = p.next;
	} while (cursor);
	expect(new Set(seen).size).toBe(seen.length);
	expect(seen.filter((id) => ids.notes.includes(id))).toEqual([b0.id, all.id]);

	const sent = (await sentList(null, 100)).items.filter((n) => ids.notes.includes(n.id));
	expect(sent.find((n) => n.id === b0.id)).toMatchObject({ reads: 1, batchName: 'B0' });
	expect(sent.find((n) => n.id === b1.id)?.reads).toBe(0);
});

test('banners reorder in one shot and reject unknown ids', async () => {
	const a = await createBanner({ title: `A ${tag}` });
	const b = await createBanner({ title: `B ${tag}` });
	try {
		await reorderBanners([b.id, a.id]);
		const order = (await listBanners()).filter((x) => [a.id, b.id].includes(x.id)).map((x) => x.id);
		expect(order).toEqual([b.id, a.id]);
		await expect(reorderBanners([a.id, crypto.randomUUID()])).rejects.toThrow('no longer exist');
	} finally {
		await deleteBanner(a.id);
		await deleteBanner(b.id);
	}
	expect((await db().select().from(banners).where(inArray(banners.id, [a.id, b.id]))).length).toBe(0);
});
