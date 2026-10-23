import { error, isHttpError, redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { endSession, homeFor, readSession } from '#lib/server/auth/session';
import { isStaff } from '#lib/server/http';
import { allowRequest } from '#lib/server/rate-limit';
import { getUser, touchLastSeen } from '#lib/features/auth/server/service';
import { adminEmails, googleMock } from '#lib/server/env';

const area = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');
const back = (url: URL) => encodeURIComponent(url.pathname + url.search);

/** Log unexpected failures. Keep the message for expected 4xx errors; hide 5xx internals. */
export const handleError: HandleServerError = ({ error: err, event }) => {
	console.error('[app]', event.url.pathname, err);
	if (isHttpError(err) && err.status < 500) return { message: err.body.message };
	return { message: 'Something went wrong. Please try again.' };
};

export const handle: Handle = async ({ event, resolve }) => {
	const url = event.url;
	// www.host -> host (one host, so the Google callback and cookies always match).
	if (url.hostname.startsWith('www.')) {
		const to = new URL(url);
		to.hostname = url.hostname.slice(4);
		return new Response(null, { status: 301, headers: { location: to.href } });
	}

	event.locals.user = null;
	const session = await readSession(event.cookies);
	if (session) {
		let user;
		try {
			user = await getUser(session.userId);
		} catch (e) {
			console.error('[auth] getUser failed', e);
			error(503, 'Service briefly unavailable. Wait a moment and try again.');
		}
		// sessionVersion is bumped on logout: older tokens are dead even though their signature is valid.
		if (user && !user.suspendedAt && user.sessionVersion === session.sv) {
			event.locals.user = user;
			void touchLastSeen(user).catch((e) => console.error('[auth] lastSeen failed', e));
		} else {
			endSession(event.cookies);
			if (user?.suspendedAt && url.pathname !== '/login') redirect(303, '/login?error=suspended');
		}
	}

	if (!(await allowRequest(event)))
		return new Response('Too many requests. Wait a few minutes and try again.', {
			status: 429,
			headers: { 'retry-after': '60', 'content-type': 'text/plain' }
		});

	const path = url.pathname;
	const user = event.locals.user;
	const inApp = area(path, '/app') || area(path, '/onboarding');
	const inAdmin = area(path, '/admin');
	if ((inApp || inAdmin) && !user) redirect(303, `/login?next=${back(url)}`);
	if (user) {
		// Every target here is homeFor(user) or a page these checks let through, so nothing loops.
		if (inAdmin && !isStaff(user)) {
			// Local mock: the phone is often still signed in as a student, so /admin was opening the user app.
			const admin = googleMock() ? [...adminEmails()][0] : undefined;
			if (admin) redirect(303, `/auth/google?mock=${encodeURIComponent(admin)}&next=/admin`);
			redirect(303, homeFor(user));
		}
		if (area(path, '/admin/team') && user.role !== 'admin') redirect(303, '/admin');
		if (area(path, '/app') && user.role === 'student' && !user.onboardedAt) redirect(303, `/onboarding?next=${back(url)}`);
	}

	let response = await resolve(event);
	try {
		response.headers.set('X-Content-Type-Options', 'nosniff');
	} catch {
		response = new Response(response.body, response); // e.g. Response.redirect() has immutable headers
	}
	const h = response.headers;
	// Signed-in pages are never cached, so Back can't show someone else's page on a shared device.
	if (user && !h.has('cache-control')) h.set('cache-control', 'private, no-store');
	h.set('X-Frame-Options', 'DENY'); // we embed YouTube (CSP frame-src in vite.config.ts); nobody embeds us
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin'); // YouTube embeds need the origin as referrer
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")');
	h.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	if (!import.meta.env.DEV) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	return response;
};
