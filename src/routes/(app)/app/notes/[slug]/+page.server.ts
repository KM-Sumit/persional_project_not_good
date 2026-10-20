import { notePaywall, teaserMarkdown } from '#lib/features/billing/server/paywall';
import { renderDoc } from '#lib/features/notes/server/markdown';
import { noteForUser, setBookmark } from '#lib/features/notes/server/service';
import { examMap } from '#lib/features/taxonomy/server/service';
import { requireUser, toHttp } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const note = await noteForUser(u, event.params.slug).catch(toHttp);
	const [exams, paywall] = await Promise.all([note.examId ? examMap() : null, notePaywall(u.id, note)]);
	const exam = note.examId ? exams?.get(note.examId)?.name : null;
	const { body, ...rest } = note;
	if (!paywall.locked) return { note: rest, examName: exam ?? null, paywall };
	// Locked: the first part only, its own contents list, and no PDF.
	const teaser = renderDoc(teaserMarkdown(body));
	return { note: { ...rest, html: teaser.html, toc: teaser.toc, fileId: null }, examName: exam ?? null, paywall };
};

export const actions: Actions = {
	bookmark: async (event) => {
		const u = requireUser(event);
		const note = await noteForUser(u, event.params.slug).catch(toHttp);
		const on = (await event.request.formData()).get('on') === 'true';
		return { bookmarked: await setBookmark(u.id, note.id, on) };
	}
};
