import { json } from '@sveltejs/kit';
import { saveAnswer } from '#lib/features/tests/server/attempt';
import { saveAnswerInput } from '#lib/features/tests/schema';
import { body, requireUser, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Autosave one answer. 409 = the attempt is closed (submitted, or time ran out and it was graded). */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const input = await body(event, saveAnswerInput);
	return json(await saveAnswer(event.params.id, user.id, input).catch(toHttp));
};
