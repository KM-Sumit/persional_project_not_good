import { examHub } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ hub: await examHub() });
