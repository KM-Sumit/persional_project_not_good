import { listPublished } from '#lib/features/posts/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ items: await listPublished('job_alert') });
