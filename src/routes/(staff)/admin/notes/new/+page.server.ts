import { redirect } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/http';
import { attempt, editorOptions } from '../../courses/options.server';
import { saveNote } from '../note.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => editorOptions();

export const actions: Actions = {
	default: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(() => saveNote(null, fd));
		if (typeof r === 'string') redirect(303, `/admin/notes/${r}?created=1`);
		return r;
	}
};
