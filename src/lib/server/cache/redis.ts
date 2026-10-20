import { env } from '../env';

type RedisClient = Bun.RedisClient;

const opts = { enableOfflineQueue: false, connectionTimeout: 1000, autoReconnect: true, maxRetries: 1e9 };

let client: RedisClient | null | undefined;
let down = false;

export const newRedis = () => {
	const url = env().REDIS_URL;
	return url ? new Bun.RedisClient(url, opts) : null;
};

export function warnOnce(error: unknown) {
	if (down) return;
	down = true;
	console.warn('[cache] Valkey unavailable, using this process only:', error instanceof Error ? error.message : error);
}

/** Null when Valkey is unset, failing, or slower than 250ms. */
export async function tryRedis<T>(fn: (redis: RedisClient) => Promise<T>): Promise<T | null> {
	if (client === undefined) {
		client = newRedis();
		client?.connect().catch(warnOnce);
	}
	if (!client) return null;
	let timer: Timer | undefined;
	try {
		const value = await Promise.race([
			fn(client),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('timeout')), 250);
			})
		]);
		down = false;
		return value;
	} catch (error) {
		warnOnce(error);
		return null;
	} finally {
		clearTimeout(timer);
	}
}
