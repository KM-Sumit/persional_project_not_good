import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { draftAnswer } from '#lib/features/doubts/server/ai';
import { answer, draftContext, getForStaff, saveDraft } from '#lib/features/doubts/server/service';
import { pushTo } from '#lib/features/push/server/service';
import { audit } from '#lib/features/site/server/audit';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { DomainError, requireStaff, toHttp } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	try {
		const doubt = await getForStaff(event.params.id);
		return { doubt, draftHtml: doubt.aiDraft ? renderMarkdown(doubt.aiDraft) : null, now: new Date().toISOString() };
	} catch (e) {
		toHttp(e);
	}
};

const failOf = (e: unknown) => {
	if (e instanceof DomainError) return fail(e.status, { message: e.message });
	if (e instanceof ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the answer.' });
	throw e;
};

export const actions: Actions = {
	/** Generates (or regenerates) the AI draft on demand and stores it on the doubt. */
	draft: async (event) => {
		requireStaff(event);
		try {
			const c = await draftContext(event.params.id);
			const draft = await draftAnswer(c.body, c.context);
			await saveDraft(event.params.id, draft);
			return { message: 'Draft ready', draft, draftHtml: renderMarkdown(draft) };
		} catch (e) {
			return failOf(e);
		}
	},
	answer: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		try {
			const { userId } = await answer(event.params.id, me.id, { answer: d.get('answer') });
			await audit(me.id, 'doubt.answer', event.params.id);
			// A push is a nudge; the student's doubts page dot is the record.
			void pushTo({ userIds: [userId] }, { title: 'Your doubt is answered', body: 'Tap to read the answer.', url: `/app/doubts/${event.params.id}` }).catch(() => {});
			return { message: 'Answer sent' };
		} catch (e) {
			return failOf(e);
		}
	}
};
