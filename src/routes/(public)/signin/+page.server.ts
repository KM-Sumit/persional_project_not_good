import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/features/auth/server/google';
import { googleConfigured, mockAuthAllowed } from '$lib/server/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));

	return {
		mock: mockAuthAllowed(),
		google: googleConfigured(),
		next: safeNext(url.searchParams.get('next')),
		error: url.searchParams.get('error') === 'google' ? 'google' : null
	};
};
