import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { asFilter } from '#lib/features/doubts/schema';
import { ask, listMine, unreadAnswers } from '#lib/features/doubts/server/service';
import { DomainError, requireUser } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const filter = asFilter(event.url.searchParams.get('status'));
	const [page, unread] = await Promise.all([listMine(u.id, event.url.searchParams.get('cursor'), filter), unreadAnswers(u.id)]);
	return { page, unread, filter, now: new Date().toISOString() };
};

export const actions: Actions = {
	/** Also the target of AskDoubtButton on lesson / question screens. */
	ask: async (event) => {
		const u = requireUser(event);
		const d = await event.request.formData().catch(() => null);
		if (!d) return fail(400, { message: 'Send the form again.' });
		const photo = d.get('photo');
		try {
			const { id } = await ask(
				u.id,
				{ body: String(d.get('body') ?? ''), lessonId: String(d.get('lessonId') ?? ''), questionId: String(d.get('questionId') ?? '') },
				photo instanceof File ? photo : null
			);
			return { message: 'Doubt sent', id };
		} catch (e) {
			if (e instanceof DomainError) return fail(e.status, { message: e.status === 503 ? 'Photo upload is not available right now. Send the doubt without a photo.' : e.message });
			if (e instanceof ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the form.' });
			throw e;
		}
	}
};
