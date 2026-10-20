import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { grantManual, listPayments, listProducts, markRefunded, regrant, revoke, userEntitlements } from '#lib/features/billing/server/service';
import { fmtDate } from '#lib/features/billing/schema';
import { listPeople } from '#lib/features/people/server/service';
import { DomainError, requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const sp = event.url.searchParams;
	const [list, products] = await Promise.all([
		listPayments({ status: (sp.get('status') ?? undefined) as never, q: sp.get('q') ?? undefined, cursor: sp.get('cursor') ?? undefined }),
		listProducts()
	]);
	return { ...list, status: sp.get('status') ?? '', products: products.map((p) => ({ value: p.id, label: p.title, hint: p.active ? undefined : 'Off sale' })) };
};

const wrap = async (fn: () => Promise<Record<string, unknown>>) => {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof DomainError) return fail(e.status, { message: e.message });
		if (e instanceof z.ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the form.' });
		throw e;
	}
};
const until = (iso: string | null) => (iso ? `until ${fmtDate(iso)}` : 'for life');

export const actions: Actions = {
	regrant: async (event) => {
		const user = requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400, { message: 'Pick a payment.' });
		return wrap(async () => ({ message: `Access granted again ${until(await regrant(id.data, user.id))}` }));
	},
	refund: async (event) => {
		const user = requireStaff(event);
		const id = z.uuid().safeParse((await event.request.formData()).get('id'));
		if (!id.success) return fail(400, { message: 'Pick a payment.' });
		return wrap(async () => {
			await markRefunded(id.data, user.id);
			return { message: 'Marked refunded and access removed' };
		});
	},
	search: async (event) => {
		requireStaff(event);
		const q = String((await event.request.formData()).get('q') ?? '').trim();
		if (q.length < 2) return { students: [] };
		const { items } = await listPeople({ q, role: 'student', limit: 8 });
		const students = await Promise.all(
			items.map(async (s) => ({ id: s.id, name: s.name, email: s.email, holdings: await userEntitlements(s.id) }))
		);
		return { students };
	},
	grant: async (event) => {
		const user = requireStaff(event);
		const d = Object.fromEntries(await event.request.formData());
		return wrap(async () => ({ granted: true, message: `Access granted ${until(await grantManual(d as never, user.id))}` }));
	},
	revoke: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		const v = z.object({ userId: z.uuid(), productId: z.uuid() }).safeParse(Object.fromEntries(d));
		if (!v.success) return fail(400, { message: 'Pick what to remove.' });
		await revoke(v.data.userId, v.data.productId, user.id);
		return { revoked: v.data, message: 'Access removed' };
	}
};
