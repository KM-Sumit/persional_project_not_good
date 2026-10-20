import { fail, redirect } from '@sveltejs/kit';
import { getJob } from '#lib/features/ai/server/service';
import { getPost, publishQuiz } from '#lib/features/posts/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import { attempt } from '../../../../courses/options.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [post, job] = await Promise.all([getPost(event.params.id), getJob(event.params.jobId)]).catch(toHttp);
	return { post: { id: post.id, title: post.title, publishedOn: post.publishedOn, quizTestId: post.quizTestId }, job };
};

export const actions: Actions = {
	publish: async (event) => {
		const u = requireStaff(event);
		let items: unknown;
		try {
			items = JSON.parse(String((await event.request.formData()).get('questions') ?? '[]'));
		} catch {
			return fail(400, { message: 'Bad question list.' });
		}
		if (!Array.isArray(items)) return fail(400, { message: 'Bad question list.' });
		const r = await attempt(() => publishQuiz(event.params.id, event.params.jobId, items, u.id));
		if (typeof r === 'string') redirect(303, `/admin/posts/${event.params.id}?quiz=1`);
		return r;
	}
};
