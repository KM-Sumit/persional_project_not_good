import { redirect } from '@sveltejs/kit';
import { deletePost, getPost, startQuiz, updatePost } from '#lib/features/posts/server/service';
import { getTest } from '#lib/features/tests/server/service';
import { istDate } from '#lib/features/posts/format';
import { requireStaff, toHttp } from '#lib/server/http';
import { attempt, editorOptions } from '../../courses/options.server';
import { postFields } from '../post.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [post, opts] = await Promise.all([getPost(params.id).catch(toHttp), editorOptions()]);
	const quiz = post.quizTestId ? await getTest(post.quizTestId).catch(() => null) : null;
	return {
		post,
		quiz: quiz && { id: quiz.id, title: quiz.title, status: quiz.status, questionCount: quiz.questionCount },
		exams: opts.exams,
		today: istDate()
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await updatePost(event.params.id, postFields(fd));
			return { message: 'Post saved' };
		});
	},
	quiz: async (event) => {
		const u = requireStaff(event);
		const r = await attempt(() => startQuiz(event.params.id, u.id));
		if (typeof r === 'string') redirect(303, `/admin/posts/${event.params.id}/quiz/${r}`);
		return r;
	},
	delete: async (event) => {
		requireStaff(event);
		await deletePost(event.params.id);
		redirect(303, '/admin/posts?deleted=1');
	}
};
