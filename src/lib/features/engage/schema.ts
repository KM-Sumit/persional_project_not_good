import { z } from 'zod';

/** In-app paths only ("/app/tests"), or absolute https links. Never javascript: or protocol-relative. */
export const hrefSchema = z
	.string()
	.trim()
	.max(500)
	.refine((h) => (h.startsWith('/') && !h.startsWith('//')) || h.startsWith('https://'), 'Use an in-app path like /app/tests or an https link.');

export const bannerInput = z.object({
	title: z.string().trim().min(1, 'Add a title.').max(120),
	subtitle: z.string().trim().max(240).default(''),
	ctaLabel: z.string().trim().min(1).max(40).default('Explore'),
	href: hrefSchema.default('/app'),
	imageFileId: z.uuid().nullable().default(null),
	imageUrl: z.preprocess((v) => (v === '' ? null : v), z.url({ protocol: /^https$/ }).nullable().default(null)),
	enabled: z.boolean().default(true)
});
export type BannerInput = z.input<typeof bannerInput>;

export type BannerDto = {
	id: string;
	title: string;
	subtitle: string;
	ctaLabel: string;
	href: string;
	imageFileId: string | null;
	image: string | null; // resolved src: uploaded file route or external URL
	enabled: boolean;
	sortOrder: number;
	createdAt: string;
};

export const notificationInput = z.object({
	title: z.string().trim().min(1, 'Add a title.').max(120),
	body: z.string().trim().max(2000).default(''),
	href: hrefSchema.nullable().default(null),
	batchId: z.uuid().nullable().default(null)
});
export type NotificationInput = z.input<typeof notificationInput>;

export type InboxItem = {
	id: string;
	title: string;
	body: string;
	href: string | null;
	createdAt: string;
	read: boolean;
};
export type SentNotification = Omit<InboxItem, 'read'> & { batchId: string | null; batchName: string | null; reads: number };
export type Page<T> = { items: T[]; next: string | null };

/** ids in their new order -> sortOrder per id. Rejects duplicates and empty lists. */
export const reorderInput = z
	.array(z.uuid())
	.min(1)
	.max(500)
	.refine((ids) => new Set(ids).size === ids.length, 'Each item can appear only once.');
export const sortPlan = (ids: string[]) => ids.map((id, i) => ({ id, sortOrder: (i + 1) * 10 }));

/** Opaque keyset cursor over (createdAt desc, id desc). createdAt is Postgres' own text form (microseconds kept). */
export const encodeCursor = (createdAt: string, id: string) => btoa(`${createdAt}|${id}`);
export function decodeCursor(c: string | null | undefined): { createdAt: string; id: string } | null {
	if (!c) return null;
	try {
		const [createdAt, id] = atob(c).split('|');
		if (!createdAt || !id || !/^\d{4}-\d{2}-\d{2}[ T][\d:.]+([+-]\d{2}(:?\d{2})?|Z)?$/.test(createdAt) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
		return { createdAt, id };
	} catch {
		return null;
	}
}
