import { redirect } from '@sveltejs/kit';
import { createPost } from '#lib/features/posts/server/service';
import { istDate } from '#lib/features/posts/format';
import { requireStaff } from '#lib/server/http';
import { attempt, editorOptions } from '../../courses/options.server';
import { postFields } from '../post.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ exams: (await editorOptions()).exams, today: istDate() });

export const actions: Actions = {
	default: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(async () => (await createPost(postFields(fd))).id);
		if (typeof r === 'string') redirect(303, `/admin/posts/${r}?created=1`);
		return r;
	}
};
