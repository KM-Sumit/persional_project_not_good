import { redirect } from '@sveltejs/kit';
import { deleteNote, getNoteAdmin, listNotesAdmin, setNotePublished } from '#lib/features/notes/server/service';
import { createSubject, deleteSubject } from '#lib/features/taxonomy/server/service';
import { DomainError, requireStaff } from '#lib/server/http';
import { attempt, editorOptions, str } from '../courses/options.server';
import type { Actions, PageServerLoad } from './$types';

const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

export const load: PageServerLoad = async ({ url }) => {
	const subjectId = uuid(url.searchParams.get('subject'));
	const [rows, opts] = await Promise.all([listNotesAdmin(), editorOptions()]);
	const subjects = opts.subjects.map((s) => ({
		id: s.value,
		name: s.label,
		count: rows.filter((n) => n.subjectId === s.value).length
	}));
	const subject = subjects.find((s) => s.id === subjectId) ?? null;
	return {
		subjects,
		subject,
		notes: subject ? rows.filter((n) => n.subjectId === subject.id) : [],
		loose: rows.filter((n) => !n.subjectId).length
	};
};

export const actions: Actions = {
	createSubject: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(() => createSubject({ name: str(fd, 'name') }));
		if (r && typeof r === 'object' && 'id' in r && typeof r.id === 'string') redirect(303, `/admin/notes?subject=${r.id}`);
		return r;
	},
	deleteSubject: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const r = await attempt(() => deleteSubject(str(fd, 'id')));
		if (r && typeof r === 'object' && 'status' in r) return r;
		redirect(303, '/admin/notes?deleted=1');
	},
	deleteNote: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const subject = uuid(str(fd, 'subject')) ?? '';
		await deleteNote(str(fd, 'id'));
		redirect(303, subject ? `/admin/notes?subject=${subject}&deleted=1` : '/admin/notes?deleted=1');
	},
	publish: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const on = fd.get('on') === 'true';
			if (on) {
				const n = await getNoteAdmin(str(fd, 'id'));
				if (!n.body.trim() && !n.fileId) throw new DomainError(422, 'Write the note or attach a PDF before publishing.');
			}
			await setNotePublished(str(fd, 'id'), on);
			return { message: on ? 'Note published' : 'Note moved to drafts' };
		});
	}
};
