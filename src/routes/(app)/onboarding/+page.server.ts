import { fail, redirect } from '@sveltejs/kit';
import { completeOnboarding } from '#lib/features/people/server/service';
import { enabledOnly, tree } from '#lib/features/taxonomy/server/service';
import { safeNext } from '#lib/server/auth/session';
import { requireUser } from '#lib/server/http';
import { ZodError } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	return {
		profile: { name: u.name, phone: u.phone, city: u.city, targetExamId: u.targetExamId, avatarUrl: u.avatarUrl },
		categories: enabledOnly(await tree()).categories,
		next: safeNext(event.url.searchParams.get('next'), '/app')
	};
};

export const actions: Actions = {
	default: async (event) => {
		const u = requireUser(event);
		const raw = Object.fromEntries(await event.request.formData());
		try {
			await completeOnboarding(u.id, raw as { name: string; targetExamId: string });
		} catch (e) {
			if (e instanceof ZodError) return fail(400, { values: raw, message: e.issues[0]?.message ?? 'Check the form.' });
			throw e;
		}
		redirect(303, safeNext(event.url.searchParams.get('next'), '/app'));
	}
};
