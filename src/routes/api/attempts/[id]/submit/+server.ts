import { json } from '@sveltejs/kit';
import { submitAttempt } from '#lib/features/tests/server/attempt';
import { requireUser } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Closes the signed-in student's attempt. Safe to call again after the clock hits zero. */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	return json(await submitAttempt(event.params.id, user.id));
};
