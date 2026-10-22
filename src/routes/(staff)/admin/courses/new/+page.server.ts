import { redirect } from '@sveltejs/kit';
import { addChapter, createCourse } from '#lib/features/courses/server/service';
import { requireStaff } from '#lib/server/http';
import { attempt, courseFields, editorOptions } from '../options.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => editorOptions();

export const actions: Actions = {
	default: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(() => createCourse(courseFields(fd)));
		if ('id' in r) {
			await addChapter(r.id, { title: 'Lessons' });
			redirect(303, `/admin/courses/${r.id}?created=1`);
		}
		return r;
	}
};
