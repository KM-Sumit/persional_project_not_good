import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authUrl, FLOW_COOKIE, pkce, randomToken, safeNext, seal } from '$lib/features/auth/server/google';
import { env, googleConfigured } from '$lib/server/env';
import { rateLimit, SECURE_COOKIES } from '$lib/server/http';

const TEN_MINUTES = 10 * 60;

export const GET: RequestHandler = async (event) => {
	await rateLimit(event, 'google-start', 20, 60_000);
	if (!googleConfigured()) return Response.json({ message: 'Not found' }, { status: 404 });

	const { AUTH_SECRET, GOOGLE_CLIENT_ID, ORIGIN } = env();
	if (!AUTH_SECRET || !GOOGLE_CLIENT_ID) {
		return Response.json({ message: 'Sign-in is not configured' }, { status: 500 });
	}

	const { verifier, challenge } = await pkce();
	const state = randomToken();
	event.cookies.set(
		FLOW_COOKIE,
		seal({ state, verifier, next: safeNext(event.url.searchParams.get('next')) }, AUTH_SECRET, TEN_MINUTES),
		{
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: SECURE_COOKIES,
			maxAge: TEN_MINUTES
		}
	);

	const redirectUri = (ORIGIN ?? event.url.origin) + '/api/auth/google/callback';
	redirect(303, authUrl({ clientId: GOOGLE_CLIENT_ID, redirectUri, state, challenge }), {
		external: ['https://accounts.google.com']
	});
};
