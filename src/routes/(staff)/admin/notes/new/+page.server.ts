import { redirect } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/http';
import { attempt, editorOptions } from '../../courses/options.server';
import { saveNote } from '../note.server';
import type { Actions, PageServerLoad } from './$types';

const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export const load: PageServerLoad = async ({ url }) => ({ ...(await editorOptions()), subjectId: uuid(url.searchParams.get('subject')) });

export const actions: Actions = {
	default: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(() => saveNote(null, fd));
		if (typeof r === 'string') redirect(303, `/admin/notes/${r}?created=1`);
		return r;
	}
};
