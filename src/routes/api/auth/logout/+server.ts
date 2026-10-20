import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/features/auth/server/service';
import { clearSessionCookie, SESSION_COOKIE } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) await destroySession(token);
	clearSessionCookie(event.cookies);
	redirect(303, '/');
};
