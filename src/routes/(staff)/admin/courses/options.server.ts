// Picker options shared by the course and note editors (exam, subject, batch visibility).
import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { DomainError } from '#lib/server/http';
import { tree } from '#lib/features/taxonomy/server/service';
import { listBatches } from '#lib/features/cohorts/server/service';

export type Opt = { value: string; label: string; hint?: string; group?: string };

export async function editorOptions() {
	const [t, batches] = await Promise.all([tree(), listBatches()]);
	const exams: Opt[] = t.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name })));
	const subjects: Opt[] = t.subjects.map((s) => ({ value: s.id, label: s.name }));
	const batchOpts: Opt[] = [
		{ value: '', label: 'Everyone', hint: 'Public, shown on the website' },
		...batches.map((b) => ({ value: b.id, label: b.name, hint: `${b.sessionName} batch only` }))
	];
	return { exams, subjects, batches: batchOpts };
}

/** Google Drive share links -> direct image links (legacy admins paste these). */
export function directImageUrl(url: string): string {
	const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
	return m ? `https://drive.google.com/uc?export=view&id=${m[1]}` : url;
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/** Form-action body: runs fn, turns validation and domain errors into fail({ message }) for the toast. */
export async function attempt<T>(fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the form.' });
		if (e instanceof DomainError) return fail(e.status, { message: e.message });
		throw e;
	}
}

/** Course details form -> service input. isPaid is always sent (an unchecked switch posts nothing). */
export function courseFields(fd: FormData) {
	const coverUrl = str(fd, 'coverUrl').trim();
	return {
		title: str(fd, 'title'),
		summary: str(fd, 'summary'),
		description: str(fd, 'description'),
		instructor: str(fd, 'instructor').trim() || 'UCI Faculty',
		examId: str(fd, 'examId'),
		batchId: str(fd, 'batchId'),
		coverFileId: str(fd, 'coverFileId'),
		coverUrl: coverUrl ? directImageUrl(coverUrl) : '',
		isPaid: fd.get('isPaid') === 'on'
	};
}

/** Entities from the billing migration carry isPaid; read it without assuming the DTO has it yet. */
export const isPaidOf = (x: object) => 'isPaid' in x && x.isPaid === true;
