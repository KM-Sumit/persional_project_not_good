import { LRU } from './lru';
import { newRedis, tryRedis, warnOnce } from './redis';

const l1 = new LRU<unknown>(5000);
const CHANNEL = 'cache:invalidate';

export const cacheKeys = {
	courses: () => 'catalog:courses',
	notes: () => 'catalog:notes',
	tests: () => 'catalog:tests:v2',
	banners: () => 'catalog:banners',
	course: (id: string) => `catalog:course:v3:${id}`,
	note: (id: string) => `catalog:note:v2:${id}`
};

let subscribed = false;

function subscribe() {
	if (subscribed) return;
	subscribed = true;
	const sub = newRedis();
	sub
		?.subscribe(CHANNEL, (message: string) => {
			for (const key of JSON.parse(message) as string[]) l1.delete(key);
		})
		.catch((error) => {
			subscribed = false;
			sub.close();
			warnOnce(error);
		});
}

export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
	subscribe();
	const hit = l1.get(key);
	if (hit !== undefined) return hit as T;
	const raw = await tryRedis((redis) => redis.get(key));
	if (raw != null) {
		const value = JSON.parse(raw) as T;
		l1.set(key, value, ttlSec * 1000);
		return value;
	}
	const value = await loader();
	if (value !== undefined) {
		l1.set(key, value, ttlSec * 1000);
		void tryRedis((redis) => redis.send('SET', [key, JSON.stringify(value), 'EX', String(ttlSec)]));
	}
	return value;
}

export async function invalidate(...keys: string[]) {
	for (const key of keys) l1.delete(key);
	if (keys.length === 0) return;
	await tryRedis(async (redis) => {
		await redis.send('DEL', keys);
		await redis.publish(CHANNEL, JSON.stringify(keys));
	});
}
