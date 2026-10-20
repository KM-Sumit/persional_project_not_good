// Best-effort fixed-window rate limits.
// Counts live in Redis when it is up (shared by every instance), else in this process. Never throws:
// a Redis outage degrades to per-instance counting, it never blocks or breaks a request.
import type { RequestEvent } from '@sveltejs/kit';
import { LRU } from './cache/lru';
import { tryRedis } from './cache/redis';

const local = new LRU<number>(20_000);

/** Counts one hit on `key`; true while the key is within `limit` hits per `windowSec`. */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
	const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
	const n = await tryRedis(async (r) => {
		const v = Number(await r.send('INCR', [bucket]));
		if (v === 1) await r.send('EXPIRE', [bucket, String(windowSec + 5)]);
		return v;
	});
	if (n !== null) return n <= limit;
	const v = (local.get(bucket) ?? 0) + 1;
	local.set(bucket, v, (windowSec + 5) * 1000);
	return v <= limit;
}

type Rule = { name: string; method: 'GET' | 'POST' | '*'; path: RegExp; limit: number; windowSec: number; by: 'user' | 'ip' };

// Matched against pathname + search (form actions post to "?/name"). First match wins.
export const RULES: Rule[] = [
	// Google start + callback (and the dev mock): stops a sign-in loop or callback replay flood.
	{ name: 'auth', method: 'GET', path: /^\/auth\//, limit: 30, windowSec: 600, by: 'ip' },
	// Public lead form.
	{ name: 'contact', method: 'POST', path: /^\/contact\/?(\?|$)/, limit: 5, windowSec: 3600, by: 'ip' },
	// Test page actions (password unlock, start): brute-force guard on top of the service's 5-fail lockout.
	{ name: 'test_unlock', method: 'POST', path: /^\/app\/tests\/[^/?]+\/?\?\//, limit: 30, windowSec: 600, by: 'user' },
	// Client fetch API (uploads, autosave): generous, it only stops runaway clients.
	{ name: 'api', method: '*', path: /^\/api\//, limit: 600, windowSec: 60, by: 'user' }
];

export function matchRule(method: string, pathAndSearch: string) {
	return RULES.find((r) => (r.method === '*' || r.method === method) && r.path.test(pathAndSearch)) ?? null;
}

/**
 * One-line hook guard: `if (!(await allowRequest(event))) return new Response('Too many requests', { status: 429 });`
 * Call it after locals.user is set. Behind a proxy, set adapter-node ADDRESS_HEADER/XFF_DEPTH or every client shares one IP.
 */
export async function allowRequest(event: Pick<RequestEvent, 'request' | 'url' | 'locals' | 'getClientAddress'>) {
	// Local browser test runs share one IP; never honoured in production.
	if (process.env.RATE_LIMIT === 'off' && process.env.NODE_ENV !== 'production') return true;
	const rule = matchRule(event.request.method, event.url.pathname + event.url.search);
	if (!rule) return true;
	let who: string;
	try {
		who = rule.by === 'user' && event.locals.user ? `u:${event.locals.user.id}` : `ip:${event.getClientAddress()}`;
	} catch {
		return true; // no client address (prerender/tests): don't block
	}
	return hit(`${rule.name}:${who}`, rule.limit, rule.windowSec);
}
