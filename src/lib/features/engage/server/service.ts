import { pushTo } from '#lib/features/push/server/service';
import { patchOf } from '#lib/zod.ts';
import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { cached, cacheKeys, invalidate } from '#lib/server/cache';
import { db } from '#lib/server/db';
import { banners, batches, batchMembers, notificationReads, notifications } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { fileUrl } from '#lib/features/files/schema';
import {
	bannerInput,
	decodeCursor,
	encodeCursor,
	notificationInput,
	type BannerDto,
	type BannerInput,
	type InboxItem,
	type NotificationInput,
	type Page,
	type SentNotification
} from '../schema';
import { applyOrder, parse } from './shared';

// ---------- banners ----------
type BannerRow = typeof banners.$inferSelect;
const bannerDto = (b: BannerRow): BannerDto => ({
	id: b.id,
	title: b.title,
	subtitle: b.subtitle,
	ctaLabel: b.ctaLabel,
	href: b.href,
	imageFileId: b.imageFileId,
	image: b.imageFileId ? fileUrl(b.imageFileId) : b.imageUrl,
	enabled: b.enabled,
	sortOrder: b.sortOrder,
	createdAt: b.createdAt.toISOString()
});

const bannerOrder = [asc(banners.sortOrder), asc(banners.createdAt)];

export async function listBanners(): Promise<BannerDto[]> {
	return (await db().select().from(banners).orderBy(...bannerOrder)).map(bannerDto);
}

/** Enabled banners for the home carousel (cached; every write invalidates). */
export const listEnabledBanners = () =>
	cached(cacheKeys.banners, 300, async () =>
		(await db().select().from(banners).where(eq(banners.enabled, true)).orderBy(...bannerOrder)).map(bannerDto)
	);

export async function createBanner(input: BannerInput): Promise<BannerDto> {
	const data = parse(bannerInput, input);
	const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${banners.sortOrder}), 0)::int` }).from(banners);
	const [row] = await db().insert(banners).values({ ...data, sortOrder: max + 10 }).returning();
	await invalidate(cacheKeys.banners);
	return bannerDto(row);
}

export async function updateBanner(id: string, input: Partial<BannerInput>): Promise<BannerDto> {
	const data = parse(patchOf(bannerInput), input);
	const [row] = await db().update(banners).set(data).where(eq(banners.id, id)).returning();
	if (!row) throw new DomainError(404, 'Banner not found.');
	await invalidate(cacheKeys.banners);
	return bannerDto(row);
}

export const setBannerEnabled = (id: string, enabled: boolean) => updateBanner(id, { enabled });

export async function deleteBanner(id: string) {
	const rows = await db().delete(banners).where(eq(banners.id, id)).returning({ id: banners.id });
	if (!rows.length) throw new DomainError(404, 'Banner not found.');
	await invalidate(cacheKeys.banners);
}

export async function reorderBanners(ids: string[]) {
	await applyOrder(banners, ids);
	await invalidate(cacheKeys.banners);
}

// ---------- notifications ----------
const PAGE = 20;

/** Everyone-notifications plus those for batches the user belongs to. */
const visibleTo = (userId: string) =>
	or(
		isNull(notifications.batchId),
		inArray(notifications.batchId, db().select({ id: batchMembers.batchId }).from(batchMembers).where(eq(batchMembers.userId, userId)))
	)!;

const createdText = sql<string>`${notifications.createdAt}::text`;
const before = (cursor: string | null | undefined): SQL | undefined => {
	const c = decodeCursor(cursor);
	return c ? sql`(${notifications.createdAt}, ${notifications.id}) < (${c.createdAt}::timestamptz, ${c.id}::uuid)` : undefined;
};
const newestFirst = [desc(notifications.createdAt), desc(notifications.id)];

function page<T extends { id: string }>(rows: (T & { cursorAt: string })[], limit: number): Page<T> {
	const more = rows.length > limit;
	const items = rows.slice(0, limit);
	const last = items.at(-1);
	return {
		items: items.map(({ cursorAt: _, ...r }) => r as unknown as T),
		next: more && last ? encodeCursor(last.cursorAt, last.id) : null
	};
}

export async function send(input: NotificationInput, senderId: string | null) {
	const data = parse(notificationInput, input);
	const [row] = await db()
		.insert(notifications)
		.values({ ...data, sentById: senderId })
		.returning();
	// Phones get it too. Best-effort: a push failure never fails the announcement (the inbox has it).
	void pushTo(data.batchId ? { batchId: data.batchId } : { all: true }, { title: row.title, body: row.body, url: row.href ?? '/app/inbox' }).catch((e) =>
		console.error('[push] announcement', e)
	);
	return { id: row.id, title: row.title, body: row.body, href: row.href, batchId: row.batchId, createdAt: row.createdAt.toISOString() };
}

export async function inbox(userId: string, cursor?: string | null, limit = PAGE): Promise<Page<InboxItem>> {
	const rows = await db()
		.select({
			id: notifications.id,
			title: notifications.title,
			body: notifications.body,
			href: notifications.href,
			createdAt: notifications.createdAt,
			cursorAt: createdText,
			read: sql<boolean>`${notificationReads.userId} is not null`
		})
		.from(notifications)
		.leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)))
		.where(and(visibleTo(userId), before(cursor)))
		.orderBy(...newestFirst)
		.limit(limit + 1);
	return page(
		rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		limit
	);
}

export async function unreadCount(userId: string): Promise<number> {
	const [r] = await db()
		.select({ n: count() })
		.from(notifications)
		.leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)))
		.where(and(visibleTo(userId), isNull(notificationReads.userId)));
	return r?.n ?? 0;
}

/** Marks the given (or every visible) notification read; ids the user can't see are ignored. */
export async function markRead(userId: string, ids: string[] | 'all') {
	if (ids !== 'all' && !ids.length) return;
	const where = ids === 'all' ? visibleTo(userId) : and(visibleTo(userId), inArray(notifications.id, ids));
	await db()
		.insert(notificationReads)
		.select(
			db()
				.select({ notificationId: notifications.id, userId: sql`${userId}::uuid`.as('user_id'), readAt: sql`now()`.as('read_at') })
				.from(notifications)
				.where(where)
		)
		.onConflictDoNothing();
}

/** Staff view: what was sent, to whom, and how many have read it. */
export async function sentList(cursor?: string | null, limit = PAGE): Promise<Page<SentNotification>> {
	const rows = await db()
		.select({
			id: notifications.id,
			title: notifications.title,
			body: notifications.body,
			href: notifications.href,
			createdAt: notifications.createdAt,
			cursorAt: createdText,
			batchId: notifications.batchId,
			batchName: batches.name,
			reads: sql<number>`(select count(*)::int from ${notificationReads} where ${notificationReads.notificationId} = ${notifications.id})`
		})
		.from(notifications)
		.leftJoin(batches, eq(batches.id, notifications.batchId))
		.where(before(cursor))
		.orderBy(...newestFirst)
		.limit(limit + 1);
	return page(
		rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		limit
	);
}

export async function deleteNotification(id: string) {
	await db().delete(notifications).where(eq(notifications.id, id));
}
