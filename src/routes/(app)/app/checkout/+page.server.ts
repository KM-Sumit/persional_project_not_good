import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { checkoutVerify } from '#lib/features/billing/schema';
import { confirmCheckout, getProduct, reportFailure, startCheckout, userEntitlements } from '#lib/features/billing/server/service';
import { quoteForProduct } from '#lib/features/billing/server/coupons';
import { getSettings } from '#lib/features/site/server/service';
import { razorpayEnabled } from '#lib/server/env';
import { DomainError, form, requireUser } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

const waLink = (num: string | undefined, text: string) => {
	const d = (num ?? '').replace(/\D/g, '');
	if (!d) return null;
	return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(text)}`;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const id = event.url.searchParams.get('product') ?? '';
	const product = await getProduct(id).catch((e) => {
		if (e instanceof DomainError) error(404, 'This product does not exist. It may have been removed.');
		throw e;
	});
	const [settings, owned] = await Promise.all([getSettings().catch(() => ({}) as { whatsappNumber?: string }), userEntitlements(user.id)]);
	const mine = owned.find((o) => o.productId === product.id && o.active) ?? null;
	// ?coupon=CODE in a shared link pre-applies it when it is valid
	const code = event.url.searchParams.get('coupon')?.slice(0, 40) ?? '';
	const quote = code ? await quoteForProduct(code, product.id).catch(() => null) : null;
	return {
		quote,
		product,
		enabled: razorpayEnabled(),
		onSale: product.active && (!product.validUntil || new Date(product.validUntil) > new Date()),
		owned: mine,
		whatsapp: waLink(settings.whatsappNumber, `Hi, I want to buy "${product.title}" (₹${product.priceInr}). My email: ${user.email}`),
		prefill: { name: user.name, email: user.email, contact: user.phone ?? '' }
	};
};

const failMsg = (e: unknown) => {
	if (e instanceof DomainError) return fail(e.status, { message: e.message });
	console.error('[billing]', e);
	return fail(502, { message: 'Could not reach the payment provider. Try again in a minute.' });
};

export const actions: Actions = {
	start: async (event) => {
		const user = requireUser(event);
		const v = form(await event.request.formData(), z.object({ productId: z.uuid(), coupon: z.string().max(40).default('') }));
		if (!v.ok) return fail(400, { message: 'Pick something to buy.' });
		try {
			return { order: await startCheckout(user.id, v.data.productId, v.data.coupon.trim() || null) };
		} catch (e) {
			return failMsg(e);
		}
	},
	/** Live price with a coupon. The same check runs again when the order is created. */
	coupon: async (event) => {
		requireUser(event);
		const v = form(await event.request.formData(), z.object({ productId: z.uuid(), code: z.string().max(40) }));
		if (!v.ok || !v.data.code.trim()) return fail(400, { couponError: 'Enter a coupon code.' });
		try {
			return { quote: await quoteForProduct(v.data.code, v.data.productId) };
		} catch (e) {
			if (e instanceof DomainError) return fail(e.status, { couponError: e.message });
			throw e;
		}
	},
	verify: async (event) => {
		const user = requireUser(event);
		const v = form(await event.request.formData(), checkoutVerify);
		if (!v.ok) return fail(400, { message: 'The payment response was incomplete.' });
		try {
			const p = await confirmCheckout(user.id, {
				orderId: v.data.razorpay_order_id,
				paymentId: v.data.razorpay_payment_id,
				signature: v.data.razorpay_signature
			});
			return { paid: true, href: p.href };
		} catch (e) {
			return failMsg(e);
		}
	},
	failed: async (event) => {
		const user = requireUser(event);
		const v = form(await event.request.formData(), z.object({ orderId: z.string().min(1).max(64), reason: z.string().max(300).default('') }));
		if (v.ok) await reportFailure(user.id, v.data.orderId, v.data.reason || 'Payment failed.');
		return { ok: true };
	}
};
