import { patchOf } from '#lib/zod.ts';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { cached, cacheKeys, invalidate } from '#lib/server/cache';
import { db } from '#lib/server/db';
import { faculty, leads, settings, toppers } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { hit } from '#lib/server/rate-limit';
import { fileUrl } from '#lib/features/files/schema';
import { decodeCursor, encodeCursor, type Page } from '#lib/features/engage/schema';
import { applyOrder, parse } from '#lib/features/engage/server/shared';
import {
	facultyInput,
	leadInput,
	LEAD_STATUSES,
	SETTING_KEYS,
	settingsPatch,
	settingsSchema,
	topperInput,
	type FacultyDto,
	type FacultyInput,
	type LeadDto,
	type LeadInput,
	type LeadStatus,
	type PublicSite,
	type SettingKey,
	type SiteSettings,
	type TopperDto,
	type TopperInput
} from '../schema';
import { audit } from './audit';

// ---------- settings ----------
export async function getSettings(): Promise<SiteSettings> {
	const rows = await db().select().from(settings).where(inArray(settings.key, SETTING_KEYS));
	const out: Record<string, unknown> = {};
	for (const r of rows) {
		// One bad stored value must not hide the rest.
		const f = settingsSchema.shape[r.key as SettingKey].safeParse(r.value);
		if (f.success && f.data !== undefined) out[r.key] = f.data;
	}
	return out as SiteSettings;
}

/** Upserts the given keys; a key sent as "" (or undefined) is cleared. */
export async function setSettings(patch: Record<string, unknown>, actorId: string | null): Promise<SiteSettings> {
	const data = parse(settingsPatch, patch) as Record<string, unknown>;
	const keys = Object.keys(patch) as SettingKey[];
	await db().transaction(async (tx) => {
		for (const key of keys) {
			const value = data[key];
			if (value === undefined) await tx.delete(settings).where(eq(settings.key, key));
			else
				await tx
					.insert(settings)
					.values({ key, value })
					.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
		}
	});
	await invalidate(cacheKeys.site);
	await audit(actorId, 'site.settings', '', { keys });
	return getSettings();
}

// ---------- toppers / faculty ----------
type Person = typeof toppers | typeof faculty;
const withPhoto = <R extends { photoFileId: string | null }>(r: R) => ({ ...r, photo: r.photoFileId ? fileUrl(r.photoFileId) : null });
const listOf = async (t: Person, onlyPublished: boolean) =>
	(
		await db()
			.select()
			.from(t)
			.where(onlyPublished ? eq(t.published, true) : undefined)
			.orderBy(asc(t.sortOrder), asc(t.name))
	).map(withPhoto);

async function createIn(t: Person, values: Record<string, unknown>, actorId: string | null) {
	const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${t.sortOrder}), 0)::int` }).from(t);
	const [row] = await db()
		.insert(t)
		.values({ ...values, sortOrder: max + 10 } as never)
		.returning();
	await done(actorId, `${t === toppers ? 'topper' : 'faculty'}.create`, row.id);
	return withPhoto(row);
}

async function updateIn(t: Person, id: string, values: Record<string, unknown>, actorId: string | null) {
	const [row] = await db().update(t).set(values).where(eq(t.id, id)).returning();
	if (!row) throw new DomainError(404, 'Not found.');
	await done(actorId, `${t === toppers ? 'topper' : 'faculty'}.update`, id);
	return withPhoto(row);
}

async function deleteIn(t: Person, id: string, actorId: string | null) {
	const rows = await db().delete(t).where(eq(t.id, id)).returning({ id: t.id });
	if (!rows.length) throw new DomainError(404, 'Not found.');
	await done(actorId, `${t === toppers ? 'topper' : 'faculty'}.delete`, id);
}

async function done(actorId: string | null, action: string, target: string) {
	await invalidate(cacheKeys.site);
	await audit(actorId, action, target);
}

export const listToppers = (onlyPublished = false) => listOf(toppers, onlyPublished) as Promise<TopperDto[]>;
export const createTopper = (input: TopperInput, actorId: string | null) =>
	createIn(toppers, parse(topperInput, input), actorId) as Promise<TopperDto>;
export const updateTopper = (id: string, input: Partial<TopperInput>, actorId: string | null) =>
	updateIn(toppers, id, parse(patchOf(topperInput), input), actorId) as Promise<TopperDto>;
export const setTopperPublished = (id: string, published: boolean, actorId: string | null) => updateTopper(id, { published }, actorId);
export const deleteTopper = (id: string, actorId: string | null) => deleteIn(toppers, id, actorId);
export const reorderToppers = async (ids: string[]) => {
	await applyOrder(toppers, ids);
	await invalidate(cacheKeys.site);
};

export const listFaculty = (onlyPublished = false) => listOf(faculty, onlyPublished) as Promise<FacultyDto[]>;
export const createFaculty = (input: FacultyInput, actorId: string | null) =>
	createIn(faculty, parse(facultyInput, input), actorId) as Promise<FacultyDto>;
export const updateFaculty = (id: string, input: Partial<FacultyInput>, actorId: string | null) =>
	updateIn(faculty, id, parse(patchOf(facultyInput), input), actorId) as Promise<FacultyDto>;
export const setFacultyPublished = (id: string, published: boolean, actorId: string | null) => updateFaculty(id, { published }, actorId);
export const deleteFaculty = (id: string, actorId: string | null) => deleteIn(faculty, id, actorId);
export const reorderFaculty = async (ids: string[]) => {
	await applyOrder(faculty, ids);
	await invalidate(cacheKeys.site);
};

/** Everything the public pages need, cached; every settings/topper/faculty write invalidates it. */
export const publicSite = (): Promise<PublicSite> =>
	cached(cacheKeys.site, 600, async () => {
		const [s, t, f] = await Promise.all([getSettings(), listToppers(true), listFaculty(true)]);
		return { settings: s, toppers: t, faculty: f };
	});

// ---------- leads ----------
const LEADS_PER_IP_HOUR = 5;
const leadDto = (r: typeof leads.$inferSelect): LeadDto => ({ ...r, createdAt: r.createdAt.toISOString() });

/** Public enquiry form. Rate-limited per client IP. */
export async function createLead(input: LeadInput, ip: string): Promise<LeadDto> {
	const data = parse(leadInput, input);
	if (!(await hit(`lead:${ip}`, LEADS_PER_IP_HOUR, 3600))) throw new DomainError(429, 'Too many enquiries. Please call us instead.');
	const [row] = await db().insert(leads).values(data).returning();
	return leadDto(row);
}

export async function listLeads(opts: { status?: LeadStatus | null; cursor?: string | null; limit?: number } = {}): Promise<Page<LeadDto>> {
	const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
	const c = decodeCursor(opts.cursor);
	const rows = await db()
		.select({ lead: leads, cursorAt: sql<string>`${leads.createdAt}::text` })
		.from(leads)
		.where(
			and(
				opts.status ? eq(leads.status, opts.status) : undefined,
				c ? sql`(${leads.createdAt}, ${leads.id}) < (${c.createdAt}::timestamptz, ${c.id}::uuid)` : undefined
			)
		)
		.orderBy(desc(leads.createdAt), desc(leads.id))
		.limit(limit + 1);
	const items = rows.slice(0, limit);
	const last = items.at(-1);
	return { items: items.map((r) => leadDto(r.lead)), next: rows.length > limit && last ? encodeCursor(last.cursorAt, last.lead.id) : null };
}

export async function setLeadStatus(id: string, status: LeadStatus, actorId: string | null): Promise<LeadDto> {
	if (!LEAD_STATUSES.includes(status)) throw new DomainError(400, 'Unknown status.');
	const [row] = await db().update(leads).set({ status }).where(eq(leads.id, id)).returning();
	if (!row) throw new DomainError(404, 'Lead not found.');
	await audit(actorId, 'lead.status', id, { status });
	return leadDto(row);
}
