import { answerSchema } from '$lib/features/auth/schema';
import { AttemptError, saveAnswer } from '$lib/features/attempts/server/service';
import { body, json, rateLimit, requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	await rateLimit(event, 'attempt-answer', 120, 60_000);
	const { questionId, selectedIndex } = await body(event, answerSchema);
	try {
		await saveAnswer(user.id, event.params.id, questionId, selectedIndex);
	} catch (cause) {
		if (cause instanceof AttemptError) return json({ message: cause.message }, { status: 409 });
		throw cause;
	}
	return json({ ok: true });
};
