import { myBilling } from '#lib/features/billing/server/service';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => myBilling(requireUser(event).id);
