import { requireUser } from '#lib/server/http';
import { timetableFor } from '#lib/features/live/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const now = Date.now();
	return { timetable: await timetableFor(user, now), serverNow: new Date(now).toISOString() };
};
