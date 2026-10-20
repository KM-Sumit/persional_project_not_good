import { requireStaff } from '#lib/server/http';
import { createLive, listLiveAdmin, staffOptions } from '#lib/features/live/server/service';
import { act } from '../students/_act.server';
import { liveFields } from './_fields.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const view = event.url.searchParams.get('view') === 'past' ? 'past' : 'upcoming';
	const [classes, options] = await Promise.all([listLiveAdmin({ view }), staffOptions()]);
	return { view, classes, options, serverNow: new Date().toISOString() };
};

export const actions: Actions = {
	create: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => createLive(liveFields(d)), 'Class scheduled');
	}
};
