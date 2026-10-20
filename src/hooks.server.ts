import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { validateSession } from '$lib/features/auth/server/service';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '$lib/server/http';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;

	if (!event.url.pathname.startsWith('/_app/')) {
		const token = event.cookies.get(SESSION_COOKIE);
		if (token) {
			const session = await validateSession(token);
			if (session) {
				event.locals.user = session.user;
				setSessionCookie(event.cookies, token, session.expiresAt);
			} else {
				clearSessionCookie(event.cookies);
			}
		}
	}

	const path = event.url.pathname;
	if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
		const api = path.startsWith('/api');
		if (!event.locals.user) {
			if (api) return Response.json({ message: 'Sign in' }, { status: 401 });
			redirect(303, '/signin?next=/admin');
		}
		if (event.locals.user.role !== 'admin') {
			if (api) return Response.json({ message: 'Not allowed' }, { status: 403 });
			return new Response('Not allowed', { status: 403 });
		}
	}

	return resolve(event);
};
