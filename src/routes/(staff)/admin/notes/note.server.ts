// Note form -> service calls, shared by /admin/notes/new and /admin/notes/[id].
import { createNote, setNotePublished, updateNote } from '#lib/features/notes/server/service';
import { DomainError } from '#lib/server/http';
import { str } from '../courses/options.server';

export async function saveNote(id: string | null, fd: FormData) {
	const input = {
		title: str(fd, 'title'),
		summary: str(fd, 'summary'),
		body: str(fd, 'body').replace(/\r\n/g, '\n'),
		examId: str(fd, 'examId'),
		subjectId: str(fd, 'subjectId'),
		batchId: str(fd, 'batchId'),
		fileId: str(fd, 'fileId'),
		isPaid: fd.get('isPaid') === 'on'
	};
	const published = fd.get('published') === 'on';
	if (published && !input.body.trim() && !input.fileId) throw new DomainError(422, 'Write the note or attach a PDF before publishing.');
	const noteId = id ?? (await createNote(input)).id;
	if (id) await updateNote(id, input);
	await setNotePublished(noteId, published);
	return noteId;
}
