import { redirect } from '@sveltejs/kit';
import { deleteNote, getNoteAdmin } from '#lib/features/notes/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import { attempt, editorOptions, isPaidOf } from '../../courses/options.server';
import { saveNote } from '../note.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [note, opts] = await Promise.all([getNoteAdmin(params.id).catch(toHttp), editorOptions()]);
	const { html: _h, toc: _t, ...rest } = note;
	return { note: { ...rest, paid: isPaidOf(note) }, ...opts };
};

export const actions: Actions = {
	save: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await saveNote(event.params.id, fd);
			return { message: 'Note saved' };
		});
	},
	delete: async (event) => {
		requireStaff(event);
		await deleteNote(event.params.id);
		redirect(303, '/admin/notes?deleted=1');
	}
};
