import { fail } from '@sveltejs/kit';
import { joinByCode } from '#lib/features/cohorts/server/service';
import { getProfile, updateProfile } from '#lib/features/people/server/service';
import { enabledOnly, tree } from '#lib/features/taxonomy/server/service';
import { DomainError, requireUser } from '#lib/server/http';
import { hit } from '#lib/server/rate-limit';
import { ZodError } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const [profile, t] = await Promise.all([getProfile(u.id), tree()]);
	return { profile, categories: enabledOnly(t).categories };
};

const message = (e: unknown) =>
	e instanceof ZodError ? (e.issues[0]?.message ?? 'Check the form.') : e instanceof DomainError ? e.message : null;

export const actions: Actions = {
	profile: async (event) => {
		const u = requireUser(event);
		const raw = Object.fromEntries(await event.request.formData()) as Record<string, string>;
		try {
			await updateProfile(u.id, raw);
		} catch (e) {
			const m = message(e);
			if (m) return fail(400, { message: m });
			throw e;
		}
		return { saved: true };
	},
	join: async (event) => {
		const u = requireUser(event);
		// Codes are 6 characters from a small alphabet: cap guesses per student.
		if (!(await hit(`join:${u.id}`, 10, 600))) return fail(429, { message: 'Too many tries. Wait 10 minutes and try again.' });
		const code = String((await event.request.formData()).get('code') ?? '');
		try {
			const b = await joinByCode(u.id, { code });
			return { batch: b.name };
		} catch (e) {
			const m = message(e);
			if (m) return fail(400, { message: m });
			throw e;
		}
	}
};
