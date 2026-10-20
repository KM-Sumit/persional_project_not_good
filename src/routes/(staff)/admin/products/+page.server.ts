import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { deleteProduct, listProducts, productTargets, setProductActive, createProduct, updateProduct } from '#lib/features/billing/server/service';
import { productInput } from '#lib/features/billing/schema';
import { razorpayEnabled } from '#lib/server/env';
import { DomainError, requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [products, targets] = await Promise.all([listProducts(), productTargets()]);
	return { products, targets, enabled: razorpayEnabled() };
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
		// validity mode decides which of the two fields counts
		if (raw.validity !== 'days') raw.validityDays = '';
		if (raw.validity !== 'until') raw.validUntil = '';
		if (raw.validity === 'until' && !raw.validUntil) return fail(400, { message: 'Pick the date access ends.' });
		if (raw.validity === 'days' && !raw.validityDays) return fail(400, { message: 'Enter the number of days.' });
		raw.active = d.has('active') ? 'true' : 'false'; // unchecked switch sends nothing
		const v = productInput.safeParse(raw);
		if (!v.success) return fail(400, { message: v.error.issues[0]?.message ?? 'Check the form.' });
		const id = raw.id || null;
		return wrap(() => (id ? updateProduct(id, raw as never, user.id) : createProduct(raw as never, user.id)), id ? 'Product saved' : 'Product created');
	},
	active: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		const on = d.get('active') === 'true';
		return wrap(() => setProductActive(idOf(d), on, user.id), on ? 'Product is on sale' : 'Product taken off sale');
	},
	delete: async (event) => {
		const user = requireStaff(event);
		const d = await event.request.formData();
		return wrap(() => deleteProduct(idOf(d), user.id), 'Product deleted');
	}
};
