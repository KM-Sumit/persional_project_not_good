import { getNoteAdmin, listNotesAdmin, setNotePublished } from '#lib/features/notes/server/service';
import { DomainError, requireStaff } from '#lib/server/http';
import { attempt, editorOptions, isPaidOf, str } from '../courses/options.server';
import type { Actions, PageServerLoad } from './$types';

const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

export const load: PageServerLoad = async ({ url }) => {
	const p = url.searchParams;
	const status = p.get('status');
	const [rows, opts] = await Promise.all([
		listNotesAdmin({
			q: p.get('q')?.trim().slice(0, 100) || undefined,
			examId: uuid(p.get('exam')),
			subjectId: uuid(p.get('subject')),
			published: status === 'published' ? true : status === 'draft' ? false : undefined
		}),
		editorOptions()
	]);
	const name = new Map([...opts.exams, ...opts.subjects].map((o) => [o.value, o.label]));
	return {
		rows: rows.map((n) => ({
			...n,
			paid: isPaidOf(n),
			examName: n.examId ? (name.get(n.examId) ?? '') : '',
			subjectName: n.subjectId ? (name.get(n.subjectId) ?? '') : ''
		})),
		exams: opts.exams,
		subjects: opts.subjects,
		filtered: [...p.keys()].some((k) => ['q', 'exam', 'subject', 'status'].includes(k))
	};
};

export const actions: Actions = {
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
