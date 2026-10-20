import { error, fail, redirect } from '@sveltejs/kit';
import { passwordSchema } from '$lib/features/auth/schema';
import { AttemptError, startAttempt, testIntro, unlockTest } from '$lib/features/attempts/server/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const intro = await testIntro(locals.user.id, params.id);
	if (!intro) error(404, 'Test not found');
	return intro;
};

export const actions: Actions = {
	unlock: async ({ locals, params, request, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		const parsed = passwordSchema.safeParse({
			password: (await request.formData()).get('password')
		});
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Enter the password' });
		}
		try {
			await unlockTest(locals.user.id, params.id, parsed.data.password);
		} catch (e) {
			if (e instanceof AttemptError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/tests/${params.id}`);
	},
	start: async ({ locals, params, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		let attemptId: string;
		try {
			attemptId = await startAttempt(locals.user.id, params.id);
		} catch (e) {
			if (e instanceof AttemptError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/attempts/${attemptId}`);
	}
};
