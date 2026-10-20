import { error, json, type Cookies, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { tryRedis } from './cache/redis';

export const SESSION_COOKIE = 'uci_session';
export const SECURE_COOKIES = !import.meta.env.DEV;

export function setSessionCookie(cookies: Cookies, token: string, expires: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: SECURE_COOKIES,
		expires
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function body<T extends z.ZodType>(event: RequestEvent, schema: T): Promise<z.infer<T>> {
	const parsed = schema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	return parsed.data;
}

export function requireUser(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Sign in');
	return event.locals.user;
}

export function requireAdmin(event: RequestEvent) {
	const user = requireUser(event);
	if (user.role !== 'admin') error(403, 'Not allowed');
	return user;
}

const hits = new Map<string, { n: number; reset: number }>();

function memoryHit(key: string, windowMs: number) {
	const now = Date.now();
	if (hits.size > 10_000) {
		for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
	}
	const current = hits.get(key);
	if (!current || current.reset < now) {
		hits.set(key, { n: 1, reset: now + windowMs });
		return 1;
	}
	return ++current.n;
}

async function hit(key: string, windowMs: number) {
	const count = await tryRedis(async (redis) => {
		await redis.send('SET', [key, '0', 'PX', String(windowMs), 'NX']);
		return redis.incr(key);
	});
	return count ?? memoryHit(key, windowMs);
}

export async function rateLimit(
	event: RequestEvent,
	bucket: string,
	max: number,
	windowMs: number,
	subject?: string
) {
	const keys = [`rl:${bucket}:ip:${event.getClientAddress()}`];
	if (event.locals.user) keys.push(`rl:${bucket}:user:${event.locals.user.id}`);
	if (subject) keys.push(`rl:${bucket}:sub:${subject}`);
	const counts = await Promise.all(keys.map((key) => hit(key, windowMs)));
	if (counts.some((n) => n > max)) error(429, 'Too many attempts. Try again in a few minutes.');
}

export { json };
