import { and, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index';
import { batchMembers, pushSubscriptions } from '#lib/server/db/schema';
import type { PushPayload, PushTarget, SubscriptionInput } from '../schema';
import { encrypt, vapidAuth } from './webpush';

// Read live (like adminEmails() in env.ts) so tests can set keys; env.ts validates the same names at boot.
export function vapid() {
	const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
	return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
export const pushEnabled = () => vapid() !== null;

export async function subscribe(userId: string, s: SubscriptionInput) {
	const row = { userId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
	await db().insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row });
}

/** Only the owner can remove an endpoint. */
export async function unsubscribe(userId: string, endpoint: string) {
	await db().delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

type Sub = { endpoint: string; p256dh: string; auth: string };

async function targets(t: PushTarget): Promise<Sub[]> {
	const cols = { endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth };
	if (t.all) return db().select(cols).from(pushSubscriptions);
	const out: Sub[] = [];
	if (t.userIds?.length) out.push(...(await db().select(cols).from(pushSubscriptions).where(inArray(pushSubscriptions.userId, t.userIds))));
	if (t.batchId)
		out.push(
			...(await db()
				.select(cols)
				.from(pushSubscriptions)
				.innerJoin(batchMembers, eq(batchMembers.userId, pushSubscriptions.userId))
				.where(eq(batchMembers.batchId, t.batchId)))
		);
	return [...new Map(out.map((s) => [s.endpoint, s])).values()];
}

/** Sends one encrypted push to one subscription. Returns the push service's HTTP status. */
export async function sendOne(sub: Sub, payload: PushPayload, fetcher: typeof fetch = fetch): Promise<number> {
	const v = vapid();
	if (!v) return 503;
	const body = await encrypt(new TextEncoder().encode(JSON.stringify(payload)), sub);
	const res = await fetcher(sub.endpoint, {
		method: 'POST',
		headers: {
			authorization: await vapidAuth(sub.endpoint, v),
			'content-encoding': 'aes128gcm',
			'content-type': 'application/octet-stream',
			ttl: String(24 * 3600),
			urgency: 'normal'
		},
		body
	});
	return res.status;
}

/**
 * Fire-and-report: pushes `payload` to every device of the target. Gone endpoints (404/410) are pruned.
 * Never throws for delivery failures: a push is a nudge, the inbox is the record.
 */
export async function pushTo(target: PushTarget, payload: PushPayload, fetcher: typeof fetch = fetch) {
	if (!pushEnabled()) return { sent: 0, failed: 0, pruned: 0 };
	const subs = await targets(target);
	const gone: string[] = [];
	let sent = 0;
	let failed = 0;
	// ponytail: 20 at a time in-process; move to a queue if one announcement ever targets 10k+ devices.
	for (let i = 0; i < subs.length; i += 20)
		await Promise.all(
			subs.slice(i, i + 20).map(async (s) => {
				const status = await sendOne(s, payload, fetcher).catch(() => 0);
				if (status === 404 || status === 410) gone.push(s.endpoint);
				else if (status >= 200 && status < 300) sent++;
				else failed++;
			})
		);
	if (gone.length) await db().delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, gone));
	return { sent, failed, pruned: gone.length };
}
