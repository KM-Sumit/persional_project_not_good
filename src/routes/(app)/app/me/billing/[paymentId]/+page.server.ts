import { getReceipt } from '#lib/features/billing/server/service';
import { getSettings } from '#lib/features/site/server/service';
import { isStaff, requireUser, toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [payment, settings] = await Promise.all([
		getReceipt(event.params.paymentId, { id: user.id, staff: isStaff(user) }).catch(toHttp),
		getSettings().catch(() => ({}) as Awaited<ReturnType<typeof getSettings>>)
	]);
	return { payment, org: { address: settings.address ?? '', email: settings.email ?? '', phone: settings.contactPhone ?? '' } };
};
