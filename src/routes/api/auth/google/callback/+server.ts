import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode, FLOW_COOKIE, unseal, type Flow } from '$lib/features/auth/server/google';
import { openSession, upsertGoogleUser } from '$lib/features/auth/server/service';
import { env } from '$lib/server/env';
import { setSessionCookie } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	try {
		const secret = env().AUTH_SECRET;
		const code = event.url.searchParams.get('code');
		const state = event.url.searchParams.get('state');
		if (!secret || !code || !state) throw new Error('oauth');

		const flow = unseal<Flow>(event.cookies.get(FLOW_COOKIE), secret);
		if (!flow || flow.state !== state) throw new Error('state');

		const profile = await exchangeCode({
			code,
			verifier: flow.verifier,
			redirectUri: (env().ORIGIN ?? event.url.origin) + '/api/auth/google/callback'
		});
		const user = await upsertGoogleUser(profile);
		const session = await openSession(user.id);
		setSessionCookie(event.cookies, session.token, session.expiresAt);
		event.cookies.delete(FLOW_COOKIE, { path: '/' });
		redirect(303, flow.next || '/home');
	} catch (err) {
		if (isRedirect(err)) throw err;
		redirect(303, '/signin?error=google');
	}
};
