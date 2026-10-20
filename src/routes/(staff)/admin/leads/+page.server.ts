import { fail } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/http';
import { listLeads, setLeadStatus } from '#lib/features/site/server/service';
import { LEAD_STATUSES, type LeadStatus } from '#lib/features/site/schema';
import { act, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

const asStatus = (v: string | null): LeadStatus | null => ((LEAD_STATUSES as readonly string[]).includes(v ?? '') ? (v as LeadStatus) : null);

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const status = asStatus(event.url.searchParams.get('status'));
	// ponytail: tab counts come from one capped page per status (shown as "100" max); add a count query to the site service past that.
	const [page, ...perStatus] = await Promise.all([
		listLeads({ status, cursor: event.url.searchParams.get('cursor'), limit: 50 }),
		...LEAD_STATUSES.map((s) => listLeads({ status: s, limit: 100 }))
	]);
	const counts = Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, perStatus[i]!.items.length])) as Record<LeadStatus, number>;
	return { status, leads: page.items, next: page.next, counts };
};

export const actions: Actions = {
	status: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const s = asStatus(str(d, 'status'));
		if (!s) return fail(400, { message: 'Unknown status.' });
		return act(() => setLeadStatus(str(d, 'id'), s, me.id), `Marked ${s}`);
	}
};
