import { fail, redirect } from '@sveltejs/kit';
import { startAttempt, testDetail } from '#lib/features/tests/server/attempt';
import { examMap } from '#lib/features/taxonomy/server/service';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { DomainError, requireUser, toHttp } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();
	const test = await testDetail(params.id, user.id).catch(toHttp);
	const exam = test.examId ? (await examMap()).get(test.examId) : undefined;
	return {
		test,
		examName: exam?.name ?? null,
		instructionsHtml: test.instructions.trim() ? renderMarkdown(test.instructions) : '',
		serverNow: new Date().toISOString()
	};
};

export const actions: Actions = {
	start: async (event) => {
		const user = requireUser(event);
		const password = String((await event.request.formData()).get('password') ?? '').trim() || undefined;
		let attemptId: string;
		try {
			({ attemptId } = await startAttempt(event.params.id, user.id, password));
		} catch (e) {
			if (e instanceof DomainError) return fail(e.status, { error: e.message, locked: e.status === 423 });
			throw e;
		}
		redirect(303, `/app/tests/${event.params.id}/attempt/${attemptId}`);
	}
};
