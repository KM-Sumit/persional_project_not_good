import { afterAll, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { academicSessions, users } from '../../../server/db/schema';
import { JOIN_ALPHABET, joinCodeInput, newJoinCode, normalizeJoinCode } from '../schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const sessionIds: string[] = [];
const userIds: string[] = [];
afterAll(async () => {
	if (sessionIds.length) await db().delete(academicSessions).where(inArray(academicSessions.id, sessionIds)); // cascades batches + members
	if (userIds.length) await db().delete(users).where(inArray(users.id, userIds));
});

test('join codes: 6 chars from the unambiguous alphabet, normalised on input', () => {
	const codes = new Set(Array.from({ length: 2000 }, newJoinCode));
	expect(codes.size).toBeGreaterThan(1990);
	for (const c of codes) expect(c).toMatch(new RegExp(`^[${JOIN_ALPHABET}]{6}$`));
	expect([...codes].join('')).not.toMatch(/[01OIL]/);
	expect(normalizeJoinCode(' ab-c 23x ')).toBe('ABC23X');
	expect(joinCodeInput.safeParse({ code: 'abc' }).success).toBe(false);
});

test('sessions, batches, join by code, move, rollover', async () => {
	const s1 = await svc.createSession({ name: `T${tag}-a`, startsOn: '2030-04-01', endsOn: '2031-03-31' });
	const s2 = await svc.createSession({ name: `T${tag}-b`, startsOn: '2031-04-01', endsOn: '2032-03-31' });
	sessionIds.push(s1.id, s2.id);
	await expect(svc.createSession({ name: `T${tag}-a`, startsOn: '2030-04-01', endsOn: '2031-03-31' })).rejects.toThrow('exists');

	const [u] = await db().insert(users).values({ email: `cohort-${tag}@test.local`, name: 'Cohort Test' }).returning();
	userIds.push(u!.id);

	const b1 = await svc.createBatch({ sessionId: s1.id, name: 'Morning' });
	const b2 = await svc.createBatch({ sessionId: s1.id, name: 'Evening' });
	expect(b1.joinCode).toHaveLength(6);
	expect(b1.joinCode).not.toBe(b2.joinCode);

	const joined = await svc.joinByCode(u!.id, { code: b1.joinCode.toLowerCase() });
	expect(joined.memberCount).toBe(1);
	await svc.joinByCode(u!.id, { code: b1.joinCode }); // idempotent
	expect((await svc.listMembers(b1.id)).map((m) => m.id)).toEqual([u!.id]);
	await expect(svc.joinByCode(u!.id, { code: 'ZZZZZZ' })).rejects.toThrow('No open batch');

	await svc.moveMembers(b1.id, b2.id, [u!.id]);
	expect(await svc.userBatchIds(u!.id)).toEqual([b2.id]);
	await svc.setBatchArchived(b2.id, true);
	expect(await svc.userBatchIds(u!.id)).toEqual([]);
	await expect(svc.joinByCode(u!.id, { code: b2.joinCode })).rejects.toThrow();
	expect((await svc.userBatches(u!.id)).map((b) => b.id)).toEqual([b2.id]);

	const created = await svc.rollover(s1.id, s2.id);
	expect(created).toHaveLength(1); // archived Evening is skipped
	const copied = await svc.listBatches({ sessionId: s2.id });
	expect(copied.map((b) => [b.name, b.memberCount])).toEqual([['Morning', 0]]);
	expect(await svc.rollover(s1.id, s2.id)).toHaveLength(0); // re-runnable

	const old = await svc.regenerateJoinCode(b1.id);
	expect(old).not.toBe(b1.joinCode);
});

test('setCurrentSession keeps exactly one current (restores the real one)', async () => {
	const before = (await db().select().from(academicSessions).where(eq(academicSessions.isCurrent, true)))[0];
	const s = await svc.createSession({ name: `T${tag}-c`, startsOn: '2040-04-01', endsOn: '2041-03-31' });
	sessionIds.push(s.id);
	try {
		await svc.setCurrentSession(s.id);
		const cur = await db().select().from(academicSessions).where(eq(academicSessions.isCurrent, true));
		expect(cur.map((r) => r.id)).toEqual([s.id]);
		expect((await svc.currentSession())?.id).toBe(s.id);
	} finally {
		if (before) await svc.setCurrentSession(before.id);
	}
});
