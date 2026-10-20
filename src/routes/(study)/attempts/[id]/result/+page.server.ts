import { error, redirect } from '@sveltejs/kit';
import { loadResult } from '$lib/features/attempts/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const result = await loadResult(locals.user.id, params.id);
	if (!result) error(404, 'Result not found');
	return result;
};
