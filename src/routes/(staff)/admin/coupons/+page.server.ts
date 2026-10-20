import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { couponInput } from '#lib/features/billing/schema';
import { deleteCoupon, listCoupons, saveCoupon, setCouponActive } from '#lib/features/billing/server/coupons';
import { listProducts } from '#lib/features/billing/server/service';
import { DomainError, requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [coupons, products] = await Promise.all([listCoupons(), listProducts()]);
	return {
		coupons,
		products: products.map((p) => ({ value: p.id, label: p.title, hint: `₹${p.priceInr}${p.active ? '' : ' · off sale'}` }))
	};
};

const wrap = async (fn: () => Promise<unknown>, message: string) => {
	try {
		await fn();
		return { message };
	} catch (e) {
		if (e instanceof DomainError) return fail(e.status, { message: e.message });
		if (e instanceof z.ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the form.' });
		throw e;
	}
};
const idOf = (d: FormData) => z.uuid().parse(d.get('id'));

export const actions: Actions = {
	save: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		const raw = Object.fromEntries(d) as Record<string, string>;
		raw.active = d.has('active') ? 'true' : 'false'; // unchecked switch sends nothing
		const v = couponInput.safeParse(raw);
		if (!v.success) return fail(400, { message: v.error.issues[0]?.message ?? 'Check the form.' });
		const id = raw.id || null;
		return wrap(() => saveCoupon(id, raw as never, user.id), id ? 'Coupon saved' : 'Coupon created');
	},
	active: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		const on = d.get('active') === 'true';
		return wrap(() => setCouponActive(idOf(d), on, user.id), on ? 'Coupon turned on' : 'Coupon turned off');
	},
	delete: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		return wrap(() => deleteCoupon(idOf(d), user.id), 'Coupon deleted');
	}
};
