import { publicSite } from '#lib/features/site/server/service';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const site = await publicSite();
	return { site };
};
