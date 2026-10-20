// Sign in with Google: server-side Authorization Code flow with PKCE + state + nonce (ported from
// easy-business). Behaviour matches the django-allauth setup: verified Google email signs in, an
// existing account with the same email is auto-connected, otherwise a new account is created.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../env';
import { signToken, verifyToken } from './session';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const FLOW_COOKIE = 'uci_oauth';
export const FLOW_TTL_SEC = 600;

const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

export type Flow = { state: string; verifier: string; nonce: string; next: string };
export type GoogleIdentity = { sub: string; email: string; firstName: string; lastName: string; picture: string | null };

export const redirectUri = (origin: string) => env().GOOGLE_REDIRECT_URI ?? `${env().ORIGIN ?? origin}/auth/google/callback`;

/** Builds the Google consent URL and the signed flow cookie value that /callback checks. */
export async function startFlow(origin: string, next: string) {
	const flow: Flow = { state: randomToken(), verifier: randomToken(), nonce: randomToken(), next };
	const challenge = b64url(
		new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(flow.verifier)))
	);
	const q = new URLSearchParams({
		client_id: env().GOOGLE_CLIENT_ID!,
		redirect_uri: redirectUri(origin),
		response_type: 'code',
		scope: 'openid email profile',
		prompt: 'select_account',
		code_challenge: challenge,
		code_challenge_method: 'S256',
		state: flow.state,
		nonce: flow.nonce
	});
	return { url: `${AUTH_URL}?${q}`, cookie: await signToken(flow, FLOW_TTL_SEC) };
}

export const readFlow = (value: string | undefined) => verifyToken<Flow>(value);

let googleKeys: JWTVerifyGetKey | undefined;

/** Exchanges the code and verifies the id_token (signature, issuer, audience, nonce, verified email). */
export async function finishFlow(o: { code: string; flow: Flow; origin: string }): Promise<GoogleIdentity> {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code: o.code,
			code_verifier: o.flow.verifier,
			client_id: env().GOOGLE_CLIENT_ID!,
			client_secret: env().GOOGLE_CLIENT_SECRET!,
			redirect_uri: redirectUri(o.origin),
			grant_type: 'authorization_code'
		}),
		signal: AbortSignal.timeout(15_000)
	}).catch(() => null);
	const data = (await res?.json().catch(() => null)) as { id_token?: string } | null;
	if (!res?.ok || !data?.id_token) throw new Error('exchange_failed');

	const { payload: p } = await jwtVerify(data.id_token, (googleKeys ??= createRemoteJWKSet(new URL(CERTS_URL))), {
		algorithms: ['RS256'],
		issuer: ['https://accounts.google.com', 'accounts.google.com'],
		audience: env().GOOGLE_CLIENT_ID!,
		clockTolerance: 30
	});
	if (p.nonce !== o.flow.nonce || !p.sub || typeof p.email !== 'string') throw new Error('invalid_token');
	if (p.email_verified !== true && p.email_verified !== 'true') throw new Error('email_unverified');
	const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
	return {
		sub: p.sub,
		email: p.email.toLowerCase(),
		firstName: str(p.given_name) || str(p.name),
		lastName: str(p.family_name),
		picture: typeof p.picture === 'string' && p.picture.startsWith('https://') ? p.picture : null
	};
}

/** GOOGLE_OAUTH_MOCK=1 (never in production): a fake verified identity, stable per email. */
export const mockIdentity = (email: string): GoogleIdentity => {
	const e = email.trim().toLowerCase();
	return { sub: `mock:${e}`, email: e, firstName: e.split('@')[0] ?? 'Dev', lastName: 'Mock', picture: null };
};
