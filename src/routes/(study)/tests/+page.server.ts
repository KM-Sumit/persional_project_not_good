import { fail, redirect } from '@sveltejs/kit';
import { listTests, testIdByCode } from '$lib/features/catalog/server/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	return { tests: await listTests() };
};

export const actions: Actions = {
	join: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		const code = String((await request.formData()).get('code') ?? '');
		const id = await testIdByCode(code);
		if (!id) return fail(400, { message: 'No paper uses that code.' });
		redirect(303, `/tests/${id}`);
	}
};
