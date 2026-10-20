import { redirect } from '@sveltejs/kit';
import { homeFor, safeNext } from '#lib/server/auth/session';
import { googleEnabled, googleMock } from '#lib/server/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'), '');
	if (locals.user) redirect(303, next || homeFor(locals.user));
	return { next, error: url.searchParams.get('error'), google: googleEnabled() || googleMock(), mock: googleMock() };
};
