import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { notificationReads, notifications } from '$lib/server/db/schema';

export type InboxItem = {
	id: string;
	title: string;
	body: string;
	sentAt: number;
	read: boolean;
};

export async function listInbox(userId: string): Promise<InboxItem[]> {
	const rows = await db()
		.select({
			id: notifications.id,
			title: notifications.title,
			body: notifications.body,
			sentAt: notifications.sentAt,
			readAt: notificationReads.readAt
		})
		.from(notifications)
		.leftJoin(
			notificationReads,
			and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId))
		)
		.orderBy(desc(notifications.sentAt))
		.limit(30);
	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		body: row.body,
		sentAt: row.sentAt.getTime(),
		read: row.readAt != null
	}));
}

export async function markRead(userId: string, notificationId: string) {
	await db().insert(notificationReads).values({ userId, notificationId }).onConflictDoNothing();
}
