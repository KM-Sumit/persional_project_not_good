import { env } from '../env';

// Uses the Bun.RedisClient global (not `import 'bun'`) so `vite build`, which runs under Node, can load this module.
type RedisClient = Bun.RedisClient;

// Redis is best-effort: unset, down or slow all mean "behave as if it isn't there".
const opts = { enableOfflineQueue: false, connectionTimeout: 1000, autoReconnect: true, maxRetries: 1e9 };

let client: RedisClient | null | undefined;
let down = false;
let connecting: Promise<unknown> = Promise.resolve();

export const newRedis = () => {
	const url = env().REDIS_URL;
	return url ? new Bun.RedisClient(url, opts) : null;
};

export function warnOnce(e: unknown) {
	if (down) return; // log once per outage, not once per request
	down = true;
	console.warn('[cache] Redis unavailable, falling back to in-process:', e instanceof Error ? e.message : e);
}

/** Runs a Redis command; resolves null when Redis is unset, failing, or slower than 250ms. */
export async function tryRedis<T>(fn: (r: RedisClient) => Promise<T>): Promise<T | null> {
	if (client === undefined) {
		client = newRedis();
		// The first command waits for the connection (still within the 250ms budget); with no offline queue it would fail.
		connecting = client?.connect().catch(warnOnce) ?? Promise.resolve();
	}
	if (!client) return null;
	let timer: Timer | undefined;
	try {
		const v = await Promise.race([
			connecting.then(() => fn(client!)),
			new Promise<never>((_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), 250)))
		]);
		down = false;
		return v;
	} catch (e) {
		warnOnce(e);
		return null;
	} finally {
		clearTimeout(timer);
	}
}
