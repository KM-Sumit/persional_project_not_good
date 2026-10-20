import { redirect } from '@sveltejs/kit';
import { FLOW_COOKIE, FLOW_TTL_SEC, mockIdentity, startFlow } from '#lib/server/auth/google';
import { homeFor, safeNext, startSession } from '#lib/server/auth/session';
import { googleEnabled, googleMock } from '#lib/server/env';
import { signInWithGoogle } from '#lib/features/auth/server/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const next = safeNext(url.searchParams.get('next'), '');
	// Dev only (googleMock() is false in production): /auth/google?mock=teacher@uci.test picks the account.
	if (googleMock()) {
		const email = url.searchParams.get('mock') || 'student@uci.test';
		if (!/^[^\s@]+@[^\s@]+$/.test(email)) redirect(303, '/login?error=google');
		const res = await signInWithGoogle(mockIdentity(email));
		if ('error' in res) redirect(303, '/login?error=suspended');
		await startSession(cookies, res.user);
		redirect(303, next || homeFor(res.user));
	}
	if (!googleEnabled()) redirect(303, '/login?error=google');
	const { url: to, cookie } = await startFlow(url.origin, next);
	cookies.set(FLOW_COOKIE, cookie, { path: '/', httpOnly: true, sameSite: 'lax', secure: !import.meta.env.DEV, maxAge: FLOW_TTL_SEC });
	// SvelteKit 3 refuses external redirects unless the target origin is allowed explicitly.
	redirect(303, to, { external: ['https://accounts.google.com'] });
};
