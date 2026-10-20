import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$lib/server/env';

export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
export const FLOW_COOKIE = 'uci_oauth';

const b64url = (value: Buffer | Uint8Array) => Buffer.from(value).toString('base64url');

export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));

const mac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest();

export function seal(data: object, secret: string, ttlSec: number, now = Date.now()) {
	const body = b64url(Buffer.from(JSON.stringify({ ...data, exp: now + ttlSec * 1000 })));
	return `${body}.${b64url(mac(body, secret))}`;
}

export function unseal<T>(value: string | undefined, secret: string, now = Date.now()): T | null {
	if (!value) return null;
	const [body, sig] = value.split('.');
	if (!body || !sig) return null;
	const expected = b64url(mac(body, secret));
	const left = Buffer.from(sig);
	const right = Buffer.from(expected);
	if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
	try {
		const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
		return typeof data.exp === 'number' && data.exp > now ? data : null;
	} catch {
		return null;
	}
}

export async function pkce() {
	const verifier = randomToken(32);
	const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
	return { verifier, challenge };
}

/** Same-origin paths only. */
export function safeNext(next: string | null | undefined, fallback = '/home') {
	if (!next || next.length > 512 || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f]/.test(next))
		return fallback;
	try {
		const url = new URL(next, 'http://uci.local');
		return url.origin === 'http://uci.local' ? url.pathname + url.search + url.hash : fallback;
	} catch {
		return fallback;
	}
}

export type Flow = { state: string; verifier: string; next: string };

export function authUrl(input: { clientId: string; redirectUri: string; state: string; challenge: string }) {
	const query = new URLSearchParams({
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		prompt: 'select_account',
		code_challenge: input.challenge,
		code_challenge_method: 'S256',
		state: input.state
	});
	return `${AUTH_URL}?${query}`;
}

export type GoogleProfile = { sub: string; email: string; name: string };

export async function exchangeCode(input: {
	code: string;
	verifier: string;
	redirectUri: string;
}): Promise<GoogleProfile> {
	const current = env();
	const tokenRes = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code: input.code,
			code_verifier: input.verifier,
			client_id: current.GOOGLE_CLIENT_ID ?? '',
			client_secret: current.GOOGLE_CLIENT_SECRET ?? '',
			redirect_uri: input.redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!tokenRes.ok) throw new Error('Google did not accept that sign-in. Try again.');
	const tokens = (await tokenRes.json()) as { access_token?: string };
	if (!tokens.access_token) throw new Error('Google did not accept that sign-in. Try again.');
	const infoRes = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${tokens.access_token}` } });
	if (!infoRes.ok) throw new Error('Google did not share an email for this account.');
	const profile = (await infoRes.json()) as {
		sub?: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
	};
	if (!profile.sub || !profile.email || profile.email_verified === false) {
		throw new Error('Use a Google account with a verified email.');
	}
	return { sub: profile.sub, email: profile.email, name: profile.name?.trim() || profile.email };
}
