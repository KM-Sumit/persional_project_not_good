import { error, fail, redirect } from '@sveltejs/kit';
import { AttemptError, loadPlayer, submitAttempt } from '$lib/features/attempts/server/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const player = await loadPlayer(locals.user.id, params.id);
	if (!player) error(404, 'Attempt not found');
	if (player.submitted) redirect(303, `/attempts/${params.id}/result`);
	return player;
};

export const actions: Actions = {
	default: async ({ locals, params, request, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		const answers: Record<string, number | null> = {};
		for (const [key, value] of await request.formData()) {
			if (!key.startsWith('q:') || typeof value !== 'string') continue;
			const index = Number(value);
			answers[key.slice(2)] = Number.isInteger(index) ? index : null;
		}
		try {
			await submitAttempt(locals.user.id, params.id, answers);
		} catch (e) {
			if (e instanceof AttemptError) return fail(400, { message: e.message });
			throw e;
		}
		redirect(303, `/attempts/${params.id}/result`);
	}
};
