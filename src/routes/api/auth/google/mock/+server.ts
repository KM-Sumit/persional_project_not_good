import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeNext } from '$lib/features/auth/server/google';
import { openSession, upsertGoogleUser } from '$lib/features/auth/server/service';
import { mockAuthAllowed } from '$lib/server/env';
import { setSessionCookie } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
	if (!mockAuthAllowed()) return new Response('Not found', { status: 404 });

	const admin = event.url.searchParams.get('as') === 'admin';
	const user = await upsertGoogleUser(
		admin
			? { sub: 'mock:admin', email: 'admin@uci.test', name: 'UCI Admin' }
			: { sub: 'mock:student', email: 'student@uci.test', name: 'Asha Rao' }
	);
	const session = await openSession(user.id);
	setSessionCookie(event.cookies, session.token, session.expiresAt);
	redirect(303, safeNext(event.url.searchParams.get('next')));
};
