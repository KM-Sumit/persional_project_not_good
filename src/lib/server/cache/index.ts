import { LRU } from './lru';
import { newRedis, tryRedis, warnOnce } from './redis';

// Two-tier read-through cache: L1 in-process LRU -> L2 Redis -> loader (DB).
// Only for slow-changing reference data. Never cache sessions, sync payloads, invoices or money.

const l1 = new LRU<unknown>(5000);
const CHANNEL = 'cache:invalidate';

// Every key lives here (contract). Features read with cached(cacheKeys.x, ...) and write with invalidate(...).
export const cacheKeys = {
	taxonomy: 'taxonomy', // categories + exams + subjects
	sessions: 'academic_sessions',
	banners: 'banners:enabled',
	site: 'site:public', // settings + toppers + faculty for the public site
	catalog: 'courses:catalog', // published course cards
	course: (slug: string) => `course:${slug}`, // published course outline (no per-user progress)
	notesIndex: 'notes:index',
	note: (slug: string) => `note:${slug}`,
	testsIndex: 'tests:index' // published test cards (no per-user state)
};

let subscribed = false;
function subscribe() {
	if (subscribed) return;
	subscribed = true;
	const sub = newRedis(); // subscriber needs its own connection
	if (!sub) return;
	// Connect first: with no offline queue, subscribing on an unopened connection always fails.
	sub
		.connect()
		.then(() =>
			sub.subscribe(CHANNEL, (msg: string) => {
				for (const k of JSON.parse(msg) as string[]) l1.delete(k);
			})
		)
		.catch((e) => {
			subscribed = false;
			sub.close();
			warnOnce(e);
		});
}

export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
	subscribe();
	const hit = l1.get(key);
	if (hit !== undefined) return hit as T;
	const raw = await tryRedis((r) => r.get(key));
	if (raw != null) {
		const v = JSON.parse(raw) as T;
		l1.set(key, v, ttlSec * 1000);
		return v;
	}
	const v = await loader();
	if (v === undefined) return v;
	l1.set(key, v, ttlSec * 1000);
	void tryRedis((r) => r.send('SET', [key, JSON.stringify(v), 'EX', String(ttlSec)]));
	return v;
}

/** Drops keys here, in Redis, and (via pub/sub) in every other instance's L1. */
export async function invalidate(...keys: string[]) {
	for (const k of keys) l1.delete(k);
	await tryRedis(async (r) => {
		await r.send('DEL', keys);
		await r.publish(CHANNEL, JSON.stringify(keys));
	});
}
