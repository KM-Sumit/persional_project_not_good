import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getAttempt, saveAnswer, submitAttempt } from '#lib/features/tests/server/attempt';
import { saveAnswerInput } from '#lib/features/tests/schema';
import { requireUser, toHttp } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();
	const screen = await getAttempt(params.attemptId, user.id).catch(toHttp);
	if (screen.state === 'closed') redirect(303, `/app/results/${params.attemptId}`);
	return { screen };
};

/** Answers the device had not synced yet travel with the submit, so nothing picked in time is lost. */
const pending = z.array(saveAnswerInput).max(500);

export const actions: Actions = {
	submit: async (event) => {
		const user = requireUser(event);
		const { attemptId } = event.params;
		const raw = (await event.request.formData()).get('pending');
		let json: unknown = [];
		try {
			json = JSON.parse(typeof raw === 'string' && raw ? raw : '[]');
		} catch {
			/* ignore a mangled field; the server copy still grades */
		}
		const parsed = pending.safeParse(json);
		if (parsed.success) {
			// Best effort: a closed attempt (409) or a bad row must not block the submit itself.
			for (const a of parsed.data) await saveAnswer(attemptId, user.id, a).catch(() => undefined);
		}
		await submitAttempt(attemptId, user.id).catch(toHttp);
		redirect(303, `/app/results/${attemptId}`);
	}
};
