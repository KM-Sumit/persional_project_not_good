// Stateless session: an HS256 JWT (jose) in an httpOnly cookie. The user row is still loaded per
// request in hooks.server.ts, so suspension and role changes take effect immediately.
import type { Cookies } from '@sveltejs/kit';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../env';

export const SESSION_COOKIE = 'uci_session';
const TTL_SEC = 60 * 60 * 24 * 30; // remember for 30 days, slid on each visit past half-life
/** Secure in builds; dev relaxes it because WebKit drops Secure cookies on http://localhost. */
const SECURE = !import.meta.env.DEV;

const key = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function signToken(payload: Record<string, unknown>, ttlSec: number) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
		.sign(key());
}

export async function verifyToken<T>(token: string | undefined): Promise<(T & { iat: number; exp: number }) | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
		return payload as T & { iat: number; exp: number };
	} catch {
		return null;
	}
}

/** Session token payload. `sv` is users.sessionVersion at sign-in; bumping the column revokes the token. */
export type SessionClaims = { sub: string; typ: 'session'; sv: number };

export const sessionToken = (user: { id: string; sessionVersion: number }) =>
	signToken({ sub: user.id, typ: 'session', sv: user.sessionVersion } satisfies SessionClaims, TTL_SEC);

/** Claims of a valid session token, or null. OAuth flow tokens share the key, so `typ` is required. */
export async function parseSessionToken(token: string | undefined) {
	const p = await verifyToken<Partial<SessionClaims>>(token);
	if (!p || typeof p.sub !== 'string' || !p.sub || p.typ !== 'session') return null;
	return { sub: p.sub, sv: typeof p.sv === 'number' ? p.sv : -1, exp: p.exp }; // no sv = never matches a version
}

function setCookie(cookies: Cookies, token: string) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: SECURE,
		maxAge: TTL_SEC
	});
}

export async function startSession(cookies: Cookies, user: { id: string; sessionVersion: number }) {
	setCookie(cookies, await sessionToken(user));
}

/**
 * User id + session version from the cookie; the caller (hooks.server.ts) must compare `sv` with the
 * user row. Re-issues the cookie once it is past half its life.
 */
export async function readSession(cookies: Cookies): Promise<{ userId: string; sv: number } | null> {
	const p = await parseSessionToken(cookies.get(SESSION_COOKIE));
	if (!p) return null;
	if (p.sv >= 0 && p.exp - Date.now() / 1000 < TTL_SEC / 2) setCookie(cookies, await sessionToken({ id: p.sub, sessionVersion: p.sv }));
	return { userId: p.sub, sv: p.sv };
}

export function endSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Same-origin relative paths only: "/x" yes; "//evil", "/\\evil", "https://..." no. */
export function safeNext(next: string | null | undefined, fallback = '/') {
	if (!next || next.length > 512 || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next))
		return fallback;
	try {
		const u = new URL(next, 'http://x');
		if (u.origin !== 'http://x') return fallback;
		// Auth routes would bounce forever (/login?next=/login, /auth/google loops).
		if (/^\/(login|logout|auth)(\/|$)/.test(u.pathname)) return fallback;
		return u.pathname + u.search + u.hash;
	} catch {
		return fallback;
	}
}

/**
 * Where a signed-in user lands by default. Agrees with the guards in hooks.server.ts (no redirect loop):
 * staff -> /admin, students finish onboarding first, then /app.
 */
export function homeFor(user: { role: string; onboardedAt: Date | string | null }) {
	if (user.role === 'admin' || user.role === 'teacher') return '/admin';
	return user.onboardedAt ? '/app' : '/onboarding';
}
