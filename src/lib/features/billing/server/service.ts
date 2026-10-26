// Billing: products, Razorpay checkout + webhook (idempotent), entitlements, access checks, staff payments.
import { and, count, desc, eq, ilike, inArray, isNull, gt, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db';
import { coupons, courses, entitlements, examCategories, exams, payments, products, testGrants, tests, users } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { audit } from '../../site/server/audit';
import {
	expiryFor,
	hrefFor,
	isActive,
	paymentFilter,
	productInput,
	grantInput,
	type CheckoutOrder,
	type EntitlementDTO,
	type PaymentDTO,
	type PaymentList,
	type PaymentStatus,
	type ProductDTO,
	type ProductInput
} from '../schema';
import { quoteCoupon } from './coupons';
import { createOrder, razorpayKeys, verifyPaymentSignature, verifyWebhookSignature } from './razorpay';

type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0];
type ProductRow = typeof products.$inferSelect;
const iso = (d: Date | null) => d?.toISOString() ?? null;

// ---------- products ----------
const targetName = sql<string>`coalesce(${exams.name}, ${courses.title}, ${tests.title}, '')`;
const soldSql = sql<number>`(select count(*)::int from ${entitlements} where ${entitlements.productId} = ${products.id})`.mapWith(Number);
const productQuery = () =>
	db()
		.select({ p: products, targetName, sold: soldSql, courseSlug: courses.slug, examSlug: exams.slug })
		.from(products)
		.leftJoin(exams, and(eq(products.kind, 'exam_pass'), eq(exams.id, products.examId)))
		.leftJoin(courses, eq(courses.id, products.courseId))
		.leftJoin(tests, eq(tests.id, products.testId))
		.$dynamic();

function toProduct(r: { p: ProductRow; targetName: string; sold: number }): ProductDTO {
	const { p } = r;
	return {
		id: p.id,
		kind: p.kind,
		title: p.title,
		description: p.description,
		priceInr: p.priceInr,
		mrpInr: p.mrpInr,
		examId: p.examId,
		courseId: p.courseId,
		testId: p.testId,
		targetName: r.targetName,
		validityDays: p.validityDays,
		validUntil: iso(p.validUntil),
		active: p.active,
		sold: r.sold,
		createdAt: p.createdAt.toISOString()
	};
}

export async function listProducts(opts: { activeOnly?: boolean } = {}): Promise<ProductDTO[]> {
	const rows = await productQuery()
		.where(opts.activeOnly ? eq(products.active, true) : undefined)
		.orderBy(desc(products.active), products.kind, desc(products.createdAt));
	return rows.map(toProduct);
}

export async function getProduct(id: string): Promise<ProductDTO & { href: string }> {
	if (!z.uuid().safeParse(id).success) throw new DomainError(404, 'That product does not exist.');
	const [r] = await productQuery().where(eq(products.id, id));
	if (!r) throw new DomainError(404, 'That product does not exist.');
	return { ...toProduct(r), href: hrefFor({ ...r.p, courseSlug: r.courseSlug, examSlug: r.examSlug }) };
}

async function productValues(raw: ProductInput) {
	const v = productInput.parse(raw);
	const examId = v.kind === 'exam_pass' ? v.examId! : null;
	const courseId = v.kind === 'course' ? v.courseId! : null;
	const testId = v.kind === 'test' ? v.testId! : null;
	let title = v.title;
	if (!title) {
		const [t] = examId
			? await db().select({ n: exams.name }).from(exams).where(eq(exams.id, examId))
			: courseId
				? await db().select({ n: courses.title }).from(courses).where(eq(courses.id, courseId))
				: await db().select({ n: tests.title }).from(tests).where(eq(tests.id, testId!));
		if (!t) throw new DomainError(400, 'What this unlocks no longer exists.');
		title = examId ? `${t.n} Pass` : t.n;
	}
	return {
		kind: v.kind,
		title,
		description: v.description,
		priceInr: v.priceInr,
		mrpInr: v.mrpInr ?? null,
		examId,
		courseId,
		testId,
		validityDays: v.validUntil ? null : (v.validityDays ?? null),
		validUntil: v.validUntil ? new Date(v.validUntil.length === 10 ? `${v.validUntil}T23:59:59+05:30` : v.validUntil) : null,
		active: v.active
	};
}

export async function createProduct(raw: ProductInput, actorId: string | null) {
	const [p] = await db().insert(products).values(await productValues(raw)).returning({ id: products.id });
	await audit(actorId, 'product.create', p!.id);
	return getProduct(p!.id);
}

export async function updateProduct(id: string, raw: ProductInput, actorId: string | null) {
	const [p] = await db().update(products).set(await productValues(raw)).where(eq(products.id, id)).returning({ id: products.id });
	if (!p) throw new DomainError(404, 'That product does not exist.');
	await audit(actorId, 'product.update', id);
	return getProduct(id);
}

export async function setProductActive(id: string, active: boolean, actorId: string | null) {
	await db().update(products).set({ active }).where(eq(products.id, id));
	await audit(actorId, active ? 'product.activate' : 'product.deactivate', id);
}

export async function deleteProduct(id: string, actorId: string | null) {
	const [{ n }] = await db().select({ n: count() }).from(payments).where(eq(payments.productId, id));
	if (n) throw new DomainError(409, 'This product has payments. Turn it off instead of deleting it.');
	await db().delete(products).where(eq(products.id, id));
	await audit(actorId, 'product.delete', id);
}

/** Active products that would unlock an item: its own product plus the pass for its exam. For locked teasers. */
export async function offersFor(t: { examId?: string | null; courseId?: string | null; testId?: string | null }): Promise<ProductDTO[]> {
	const any = [
		t.examId ? and(eq(products.kind, 'exam_pass'), eq(products.examId, t.examId)) : undefined,
		t.courseId ? and(eq(products.kind, 'course'), eq(products.courseId, t.courseId)) : undefined,
		t.testId ? and(eq(products.kind, 'test'), eq(products.testId, t.testId)) : undefined
	].filter(Boolean) as SQL[];
	if (!any.length) return [];
	const rows = await productQuery()
		.where(and(eq(products.active, true), or(...any)))
		.orderBy(products.priceInr);
	return rows.map(toProduct).filter((p) => !p.validUntil || new Date(p.validUntil) > new Date());
}

// ---------- access ----------
const liveEntitlement = (userId: string) =>
	and(eq(entitlements.userId, userId), or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, sql`now()`)));

/**
 * Can this user open the item? True for an active entitlement on the exam pass of `examId`, the course product of
 * `courseId` or the test product of `testId`, or a manual test grant for `testId`. Call for paid items only.
 */
export async function hasAccess(userId: string, t: { examId?: string | null; courseId?: string | null; testId?: string | null }) {
	const any = [
		t.examId ? and(eq(products.kind, 'exam_pass'), eq(products.examId, t.examId)) : undefined,
		t.courseId ? and(eq(products.kind, 'course'), eq(products.courseId, t.courseId)) : undefined,
		t.testId ? and(eq(products.kind, 'test'), eq(products.testId, t.testId)) : undefined
	].filter(Boolean) as SQL[];
	const checks: Promise<unknown[]>[] = [];
	if (any.length)
		checks.push(
			db()
				.select({ x: sql`1` })
				.from(entitlements)
				.innerJoin(products, eq(products.id, entitlements.productId))
				.where(and(liveEntitlement(userId), or(...any)))
				.limit(1)
		);
	if (t.testId)
		checks.push(
			db()
				.select({ x: sql`1` })
				.from(testGrants)
				.where(and(eq(testGrants.userId, userId), eq(testGrants.testId, t.testId)))
				.limit(1)
		);
	return (await Promise.all(checks)).some((r) => r.length > 0);
}

/** Everything a user holds right now, as id sets, so lists can mark locked items without N queries. */
export async function accessScope(userId: string) {
	const [rows, grants] = await Promise.all([
		db()
			.select({ kind: products.kind, examId: products.examId, courseId: products.courseId, testId: products.testId, setId: products.setId })
			.from(entitlements)
			.innerJoin(products, eq(products.id, entitlements.productId))
			.where(liveEntitlement(userId)),
		db().select({ testId: testGrants.testId }).from(testGrants).where(eq(testGrants.userId, userId))
	]);
	const s = { examIds: new Set<string>(), courseIds: new Set<string>(), testIds: new Set(grants.map((g) => g.testId)), setIds: new Set<string>() };
	for (const r of rows) {
		if (r.kind === 'exam_pass' && r.examId) s.examIds.add(r.examId);
		if (r.kind === 'course' && r.courseId) s.courseIds.add(r.courseId);
		if (r.kind === 'test' && r.testId) s.testIds.add(r.testId);
		if (r.setId) s.setIds.add(r.setId);
	}
	return s;
}

/** Upserts (user, product) with expiry = max(current, computed). The one place access is written. */
async function grant(tx: Tx, userId: string, p: ProductRow, src: { paymentId?: string; grantedById?: string; expiresAt?: Date | null }) {
	const [cur] = await tx
		.select({ expiresAt: entitlements.expiresAt })
		.from(entitlements)
		.where(and(eq(entitlements.userId, userId), eq(entitlements.productId, p.id)))
		.for('update');
	const live = cur && isActive(cur.expiresAt) ? cur : null;
	const expiresAt = src.expiresAt !== undefined ? src.expiresAt : expiryFor(p, new Date(), live);
	await tx
		.insert(entitlements)
		.values({ userId, productId: p.id, paymentId: src.paymentId ?? null, grantedById: src.grantedById ?? null, expiresAt })
		.onConflictDoUpdate({
			target: [entitlements.userId, entitlements.productId],
			set: { expiresAt, paymentId: src.paymentId ?? null, grantedById: src.grantedById ?? null }
		});
	return expiresAt;
}

// ---------- checkout ----------
/** Next receipt number for this year (UCI-2026-000123). Caller holds the advisory lock. */
async function nextReceipt(tx: Tx, now = new Date()) {
	const year = new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now);
	const prefix = `UCI-${year}-`;
	const [r] = await tx
		.select({ n: sql<number>`coalesce(max(substring(${payments.receipt} from 10)::int), 0)`.mapWith(Number) })
		.from(payments)
		.where(ilike(payments.receipt, `${prefix}%`));
	return prefix + String((r?.n ?? 0) + 1).padStart(6, '0');
}

/** Form action: reserves a receipt, creates the Razorpay order, returns what Checkout needs. A coupon is re-validated here. */
export async function startCheckout(userId: string, productId: string, couponCode?: string | null): Promise<CheckoutOrder> {
	const keys = razorpayKeys();
	if (!keys) throw new DomainError(503, 'Payments are not set up yet. Contact the institute.');
	const [p] = await db().select().from(products).where(and(eq(products.id, productId), eq(products.active, true)));
	if (!p) throw new DomainError(404, 'This product is not on sale.');
	if (p.validUntil && p.validUntil <= new Date()) throw new DomainError(410, 'This pass has ended and is no longer on sale.');
	const [cur] = await db()
		.select({ expiresAt: entitlements.expiresAt })
		.from(entitlements)
		.where(and(eq(entitlements.userId, userId), eq(entitlements.productId, p.id)));
	if (cur && isActive(cur.expiresAt)) {
		const next = expiryFor(p, new Date(), cur);
		if (next === null || (cur.expiresAt && next <= cur.expiresAt))
			throw new DomainError(409, 'You already have this. Paying again would not add any time.');
	}
	const quote = couponCode ? await quoteCoupon(couponCode, p) : null;
	const amountPaise = (quote?.totalInr ?? p.priceInr) * 100;
	// Reserve the receipt under a lock so numbers never collide; the order id is filled in after Razorpay answers.
	const placeholder = `pending_${crypto.randomUUID()}`;
	const row = await db().transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('uci:receipt'))`);
		const receipt = await nextReceipt(tx);
		const [r] = await tx
			.insert(payments)
			.values({ userId, productId: p.id, amountPaise, couponId: quote?.couponId ?? null, receipt, razorpayOrderId: placeholder })
			.returning({ id: payments.id, receipt: payments.receipt });
		return r!;
	});
	try {
		const order = await createOrder(keys, { amountPaise, receipt: row.receipt, notes: { userId, productId: p.id, receipt: row.receipt } });
		await db().update(payments).set({ razorpayOrderId: order.id }).where(eq(payments.id, row.id));
		return { keyId: keys.keyId, orderId: order.id, amountPaise, receipt: row.receipt, title: p.title };
	} catch (e) {
		await db().update(payments).set({ status: 'failed', error: 'Could not create the order.' }).where(eq(payments.id, row.id));
		throw e;
	}
}

/**
 * Credits an order exactly once. The conditional status flip on razorpayOrderId is the idempotency lock: the
 * checkout callback and the webhook can race, but only one UPDATE returns a row. Amount is checked when known.
 */
export async function markPaid(orderId: string, paymentId: string, opts: { amountPaise?: number } = {}) {
	return db().transaction(async (tx) => {
		const [pay] = await tx
			.update(payments)
			.set({ status: 'paid', razorpayPaymentId: paymentId, paidAt: new Date(), error: null })
			.where(
				and(
					eq(payments.razorpayOrderId, orderId),
					inArray(payments.status, ['created', 'failed']),
					opts.amountPaise === undefined ? undefined : eq(payments.amountPaise, opts.amountPaise)
				)
			)
			.returning();
		if (!pay) return false; // unknown order, amount mismatch, already credited or refunded
		// Counted on success only, in the same transaction as the credit. ponytail: two orders racing for the last
		// use can both pay and push `used` past maxUses; money was taken, so both are honoured.
		if (pay.couponId) await tx.update(coupons).set({ used: sql`${coupons.used} + 1` }).where(eq(coupons.id, pay.couponId));
		const [p] = await tx.select().from(products).where(eq(products.id, pay.productId));
		await grant(tx, pay.userId, p!, { paymentId: pay.id });
		return true;
	});
}

async function markFailed(orderId: string, reason: string) {
	await db()
		.update(payments)
		.set({ status: 'failed', error: reason.slice(0, 300) })
		.where(and(eq(payments.razorpayOrderId, orderId), eq(payments.status, 'created')));
}

/** Checkout.js success handler. Only the order's owner can confirm it. Returns where the unlocked content is. */
export async function confirmCheckout(userId: string, v: { orderId: string; paymentId: string; signature: string }) {
	const keys = razorpayKeys();
	if (!keys) throw new DomainError(503, 'Payments are not set up yet.');
	if (!verifyPaymentSignature(v.orderId, v.paymentId, v.signature, keys.keySecret))
		throw new DomainError(400, 'This payment could not be verified. If money was taken, it will be confirmed shortly.');
	const [pay] = await db().select().from(payments).where(eq(payments.razorpayOrderId, v.orderId));
	if (!pay || pay.userId !== userId) throw new DomainError(404, 'Unknown order.');
	if (pay.status !== 'paid') await markPaid(v.orderId, v.paymentId);
	return getProduct(pay.productId);
}

/** Client reported a failure or a closed modal; keeps the reason for staff. */
export async function reportFailure(userId: string, orderId: string, reason: string) {
	const [pay] = await db().select({ userId: payments.userId }).from(payments).where(eq(payments.razorpayOrderId, orderId));
	if (pay?.userId === userId) await markFailed(orderId, reason);
}

const WebhookBody = z.object({
	event: z.string(),
	payload: z
		.object({
			payment: z
				.object({
					entity: z.object({
						id: z.string(),
						order_id: z.string().nullish(),
						amount: z.number().int(),
						error_description: z.string().nullish()
					})
				})
				.optional(),
			order: z.object({ entity: z.object({ id: z.string(), amount_paid: z.number().int().optional() }) }).optional()
		})
		.default({})
});

/** Returns an HTTP status. Bad signature 400, not configured 503, everything else 200 so Razorpay stops retrying. */
export async function handleWebhook(rawBody: string, signature: string | null, secret = razorpayKeys()?.webhookSecret): Promise<number> {
	if (!secret) return 503;
	if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) return 400;
	let json: unknown;
	try {
		json = JSON.parse(rawBody);
	} catch {
		return 400;
	}
	const parsed = WebhookBody.safeParse(json);
	if (!parsed.success) return 200; // signed, but a shape we don't handle
	const { event, payload } = parsed.data;
	const pay = payload.payment?.entity;
	const orderId = payload.order?.entity.id ?? pay?.order_id;
	if (!orderId) return 200;
	if ((event === 'payment.captured' || event === 'order.paid') && pay?.id) await markPaid(orderId, pay.id, { amountPaise: pay.amount });
	else if (event === 'payment.failed') await markFailed(orderId, pay?.error_description ?? 'Payment failed.');
	return 200;
}

// ---------- student ----------
const paymentSelect = {
	pay: payments,
	productTitle: products.title,
	productKind: products.kind,
	userName: users.name,
	userEmail: users.email,
	couponCode: coupons.code
};
type PaymentJoin = { pay: typeof payments.$inferSelect; productTitle: string; productKind: ProductRow['kind']; userName: string; userEmail: string; couponCode: string | null };
function toPayment(r: PaymentJoin): PaymentDTO {
	const { pay } = r;
	return {
		id: pay.id,
		receipt: pay.receipt,
		status: pay.status,
		amountPaise: pay.amountPaise,
		productId: pay.productId,
		productTitle: r.productTitle,
		productKind: r.productKind,
		userId: pay.userId,
		userName: r.userName,
		userEmail: r.userEmail,
		razorpayOrderId: pay.razorpayOrderId,
		razorpayPaymentId: pay.razorpayPaymentId,
		error: pay.error,
		couponCode: r.couponCode,
		paidAt: iso(pay.paidAt),
		createdAt: pay.createdAt.toISOString()
	};
}
const paymentQuery = () =>
	db().select(paymentSelect).from(payments).innerJoin(products, eq(products.id, payments.productId)).innerJoin(users, eq(users.id, payments.userId)).leftJoin(coupons, eq(coupons.id, payments.couponId)).$dynamic();

/** Passes and purchases for /app/me/billing. Pending orders older than a day are hidden. */
export async function myBilling(userId: string): Promise<{ passes: EntitlementDTO[]; payments: PaymentDTO[] }> {
	const [ents, pays] = await Promise.all([userEntitlements(userId), paymentQuery().where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(100)]);
	const dayAgo = Date.now() - 86_400_000;
	return {
		passes: ents,
		payments: pays.map(toPayment).filter((p) => p.status !== 'created' || new Date(p.createdAt).getTime() > dayAgo)
	};
}

export async function userEntitlements(userId: string): Promise<EntitlementDTO[]> {
	const rows = await db()
		.select({ e: entitlements, p: products, targetName, courseSlug: courses.slug, examSlug: exams.slug })
		.from(entitlements)
		.innerJoin(products, eq(products.id, entitlements.productId))
		.leftJoin(exams, and(eq(products.kind, 'exam_pass'), eq(exams.id, products.examId)))
		.leftJoin(courses, eq(courses.id, products.courseId))
		.leftJoin(tests, eq(tests.id, products.testId))
		.where(eq(entitlements.userId, userId))
		.orderBy(desc(entitlements.createdAt));
	return rows
		.map((r) => ({
			productId: r.p.id,
			title: r.p.title,
			kind: r.p.kind,
			targetName: r.targetName,
			href: hrefFor({ ...r.p, courseSlug: r.courseSlug, examSlug: r.examSlug }),
			expiresAt: iso(r.e.expiresAt),
			granted: !r.e.paymentId && !!r.e.grantedById,
			active: isActive(r.e.expiresAt)
		}))
		.sort((a, b) => Number(b.active) - Number(a.active));
}

/** A receipt: the owner, or staff. */
export async function getReceipt(paymentId: string, viewer: { id: string; staff: boolean }): Promise<PaymentDTO> {
	if (!z.uuid().safeParse(paymentId).success) throw new DomainError(404, 'Receipt not found.');
	const [r] = await paymentQuery().where(eq(payments.id, paymentId));
	if (!r || (!viewer.staff && r.pay.userId !== viewer.id)) throw new DomainError(404, 'Receipt not found.');
	return toPayment(r);
}

// ---------- staff ----------
const PAGE = 30;
const encodeCursor = (d: Date, id: string) => Buffer.from(`${d.toISOString()}|${id}`).toString('base64url');
function decodeCursor(c: string) {
	const [d, id] = Buffer.from(c, 'base64url').toString().split('|');
	if (!d || !id || Number.isNaN(Date.parse(d)) || !z.uuid().safeParse(id).success) throw new DomainError(400, 'Bad page cursor.');
	return { d: new Date(d), id };
}

export async function listPayments(raw: z.input<typeof paymentFilter> = {}): Promise<PaymentList> {
	const f = paymentFilter.parse(raw);
	const search = f.q
		? or(
				ilike(payments.receipt, `%${f.q.replace(/[\\%_]/g, '\\$&')}%`),
				ilike(users.email, `%${f.q.replace(/[\\%_]/g, '\\$&')}%`),
				ilike(users.name, `%${f.q.replace(/[\\%_]/g, '\\$&')}%`),
				eq(payments.razorpayOrderId, f.q),
				eq(payments.razorpayPaymentId, f.q)
			)
		: undefined;
	const cur = f.cursor ? decodeCursor(f.cursor) : null;
	const where = and(
		search,
		f.status ? eq(payments.status, f.status) : undefined,
		cur ? sql`(${payments.createdAt}, ${payments.id}) < (${cur.d.toISOString()}::timestamptz, ${cur.id}::uuid)` : undefined
	);
	const istDay = sql`(date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')`;
	const istMonth = sql`(date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')`;
	const [rows, counts, [rev]] = await Promise.all([
		paymentQuery().where(where).orderBy(desc(payments.createdAt), desc(payments.id)).limit(PAGE + 1),
		db()
			.select({ status: payments.status, n: count() })
			.from(payments)
			.innerJoin(users, eq(users.id, payments.userId))
			.where(search)
			.groupBy(payments.status),
		db()
			.select({
				today: sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.paidAt} >= ${istDay}), 0)`.mapWith(Number),
				month: sql<number>`coalesce(sum(${payments.amountPaise}) filter (where ${payments.paidAt} >= ${istMonth}), 0)`.mapWith(Number),
				all: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number)
			})
			.from(payments)
			.where(eq(payments.status, 'paid'))
	]);
	const page = rows.slice(0, PAGE);
	const last = page.at(-1);
	const c = { all: 0, created: 0, paid: 0, failed: 0, refunded: 0 } as Record<PaymentStatus | 'all', number>;
	for (const r of counts) {
		c[r.status] = r.n;
		c.all += r.n;
	}
	return {
		rows: page.map(toPayment),
		nextCursor: rows.length > PAGE && last ? encodeCursor(new Date(last.pay.createdAt), last.pay.id) : null,
		counts: c,
		revenue: { todayPaise: rev?.today ?? 0, monthPaise: rev?.month ?? 0, allPaise: rev?.all ?? 0 }
	};
}

/** "Grant access again" for a paid payment whose access went missing (revoked by mistake, expired early). */
export async function regrant(paymentId: string, actorId: string) {
	const [pay] = await db().select().from(payments).where(eq(payments.id, paymentId));
	if (!pay) throw new DomainError(404, 'Payment not found.');
	if (pay.status !== 'paid') throw new DomainError(409, 'Only paid orders can grant access. Use "Grant access" for this student instead.');
	const expiresAt = await db().transaction(async (tx) => {
		const [p] = await tx.select().from(products).where(eq(products.id, pay.productId));
		return grant(tx, pay.userId, p!, { paymentId: pay.id });
	});
	await audit(actorId, 'billing.regrant', pay.id);
	return iso(expiresAt);
}

/** Staff gives a product without payment (cash, scholarship). Blank expiry = the product's own validity. */
export async function grantManual(raw: z.input<typeof grantInput>, actorId: string) {
	const v = grantInput.parse(raw);
	const [u] = await db().select({ id: users.id }).from(users).where(eq(users.id, v.userId));
	if (!u) throw new DomainError(404, 'Student not found.');
	const expiresAt = await db().transaction(async (tx) => {
		const [p] = await tx.select().from(products).where(eq(products.id, v.productId));
		if (!p) throw new DomainError(404, 'Product not found.');
		return grant(tx, v.userId, p, {
			grantedById: actorId,
			expiresAt: v.expiresAt ? new Date(`${v.expiresAt}T23:59:59+05:30`) : undefined
		});
	});
	await audit(actorId, 'billing.grant', v.userId, { productId: v.productId });
	return iso(expiresAt);
}

export async function revoke(userId: string, productId: string, actorId: string) {
	await db().delete(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId)));
	await audit(actorId, 'billing.revoke', userId, { productId });
}

/** Marks a paid order refunded (after refunding in the Razorpay dashboard) and removes its access. */
export async function markRefunded(paymentId: string, actorId: string) {
	await db().transaction(async (tx) => {
		const [pay] = await tx
			.update(payments)
			.set({ status: 'refunded' })
			.where(and(eq(payments.id, paymentId), eq(payments.status, 'paid')))
			.returning();
		if (!pay) throw new DomainError(409, 'Only paid orders can be refunded.');
		await tx.delete(entitlements).where(and(eq(entitlements.paymentId, pay.id)));
	});
	await audit(actorId, 'billing.refund', paymentId);
}

/** Picker options for the product form: exams (grouped by category), courses and tests. */
export async function productTargets() {
	const [ex, cs, ts] = await Promise.all([
		db()
			.select({ value: exams.id, label: exams.name, group: examCategories.name })
			.from(exams)
			.innerJoin(examCategories, eq(examCategories.id, exams.categoryId))
			.orderBy(examCategories.sortOrder, exams.sortOrder, exams.name),
		db()
			.select({ value: courses.id, label: courses.title, paid: courses.isPaid, published: courses.published })
			.from(courses)
			.orderBy(desc(courses.updatedAt)),
		db()
			.select({ value: tests.id, label: tests.title, access: tests.access, status: tests.status })
			.from(tests)
			.where(sql`${tests.status} <> 'archived'`)
			.orderBy(desc(tests.createdAt))
			.limit(500)
	]);
	return {
		exams: ex,
		courses: cs.map((c) => ({ value: c.value, label: c.label, hint: [c.paid ? 'Paid' : 'Free', c.published ? '' : 'Draft'].filter(Boolean).join(' · ') })),
		tests: ts.map((t) => ({ value: t.value, label: t.label, hint: `${t.access === 'paid' ? 'Paid' : t.access} · ${t.status}` }))
	};
}
