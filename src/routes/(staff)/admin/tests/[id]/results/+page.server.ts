import { participants, testStats } from '#lib/features/tests/server/service';
import { requireStaff } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [rows, stats] = await Promise.all([participants(event.params.id), testStats(event.params.id)]);
	return { rows, stats };
};
