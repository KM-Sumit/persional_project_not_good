import { afterAll, beforeAll, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { pushSubscriptions, users } from '../../../server/db/schema';
import * as svc from './service';
import { generateVapidKeys } from './webpush';

const tag = crypto.randomUUID().slice(0, 8);
const userIds: string[] = [];
const saved = { ...process.env };
// A real browser key pair (RFC 8291 vector) so encryption succeeds.
const keys = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };

beforeAll(async () => {
	const k = await generateVapidKeys();
	Object.assign(process.env, { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, VAPID_SUBJECT: 'mailto:test@uci.test' });
});
afterAll(async () => {
	for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) if (saved[k] === undefined) delete process.env[k];
	else process.env[k] = saved[k];
	if (userIds.length) await db().delete(users).where(inArray(users.id, userIds));
});

test('pushTo sends to a user and prunes gone endpoints', async () => {
	const [u] = await db().insert(users).values({ email: `push-${tag}@test.local`, name: 'Pushed' }).returning();
	userIds.push(u!.id);
	const live = `https://push.test.local/${tag}/live`;
	const gone = `https://push.test.local/${tag}/gone`;
	await svc.subscribe(u!.id, { endpoint: live, keys });
	await svc.subscribe(u!.id, { endpoint: gone, keys });
	await svc.subscribe(u!.id, { endpoint: gone, keys }); // upsert, no duplicate

	const calls: { url: string; headers: Record<string, string> }[] = [];
	const fake = (async (url: string, init: RequestInit) => {
		calls.push({ url, headers: init.headers as Record<string, string> });
		return new Response(null, { status: url.endsWith('/gone') ? 410 : 201 });
	}) as unknown as typeof fetch;

	const r = await svc.pushTo({ userIds: [u!.id] }, { title: 'T', body: 'B', url: '/app' }, fake);
	expect(r).toEqual({ sent: 1, failed: 0, pruned: 1 });
	expect(calls[0]!.headers['content-encoding']).toBe('aes128gcm');
	expect(calls[0]!.headers.authorization).toStartWith('vapid t=');
	const left = await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u!.id));
	expect(left.map((s) => s.endpoint)).toEqual([live]);

	await svc.unsubscribe(crypto.randomUUID(), live); // not the owner: no-op
	expect((await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u!.id))).length).toBe(1);
	await svc.unsubscribe(u!.id, live);
	expect((await db().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u!.id))).length).toBe(0);
});
