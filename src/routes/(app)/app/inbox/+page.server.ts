import { redirect } from '@sveltejs/kit';
import { inbox, markRead } from '#lib/features/engage/server/service';
import { unreadAnswers } from '#lib/features/doubts/server/service';
import { requireUser } from '#lib/server/http';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const [page, answers] = await Promise.all([inbox(u.id, event.url.searchParams.get('cursor')), unreadAnswers(u.id).catch(() => 0)]);
	return { page, answers, now: new Date().toISOString() };
};

const openInput = z.object({ id: z.uuid(), href: z.string().max(500).optional() });
const safeHref = (h: string | undefined) => (h && ((h.startsWith('/') && !h.startsWith('//')) || h.startsWith('https://')) ? h : null);

export const actions: Actions = {
	/** Opening an item marks it read, then follows its link (works without JS). */
	open: async (event) => {
		const u = requireUser(event);
		const r = openInput.safeParse(Object.fromEntries(await event.request.formData()));
		if (!r.success) return { ok: false };
		await markRead(u.id, [r.data.id]);
		const href = safeHref(r.data.href);
		// Announcement links may point off-site (https://); SvelteKit 3 needs that said explicitly.
		if (href) redirect(303, href, { external: href.startsWith('https://') });
		return { ok: true };
	},
	readAll: async (event) => {
		const u = requireUser(event);
		await markRead(u.id, 'all');
		return { ok: true };
	}
};
