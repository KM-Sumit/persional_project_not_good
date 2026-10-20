import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { auditLog, leads, toppers } from '#lib/server/db/schema';
import { leadInput, normalizeIndianPhone, settingsPatch } from './schema';
import { createLead, createTopper, deleteTopper, listLeads, publicSite, reorderToppers, setLeadStatus, setTopperPublished } from './server/service';

test('normalises Indian mobile numbers', () => {
	for (const ok of ['9876543210', '+91 98765 43210', '91-9876543210', '09876543210', '(+91) 98765-43210'])
		expect(normalizeIndianPhone(ok)).toBe('+919876543210');
	for (const bad of ['1234567890', '98765', '+1 9876543210', '98765432100', 'call me', '+91 5876543210'])
		expect(normalizeIndianPhone(bad)).toBeNull();
});

test('settings patch validates known keys only', () => {
	expect(settingsPatch.parse({ whatsappNumber: '98765 43210', stats: [{ label: 'Selections', value: '1200+' }] })).toEqual({
		whatsappNumber: '+919876543210',
		stats: [{ label: 'Selections', value: '1200+' }]
	});
	expect(settingsPatch.safeParse({ bogus: 1 }).success).toBe(false);
	expect(settingsPatch.safeParse({ mapUrl: 'http://maps.google.com' }).success).toBe(false);
	expect(settingsPatch.safeParse({ socials: { youtube: 'https://youtube.com/@uci' } }).success).toBe(true);
	expect(settingsPatch.parse({ address: '' })).toEqual({ address: '' });
	expect(settingsPatch.parse({ email: '' }).email).toBeUndefined();
});

test('lead input normalises phone and rejects bad numbers', () => {
	expect(leadInput.parse({ name: 'Asha', phone: '098765 43210' }).phone).toBe('+919876543210');
	expect(leadInput.safeParse({ name: 'Asha', phone: '12345' }).success).toBe(false);
});

// ---------- DB ----------
const made = { leads: [] as string[], toppers: [] as string[] };
afterAll(async () => {
	await db().delete(auditLog).where(inArray(auditLog.target, [...made.leads, ...made.toppers]));
	if (made.leads.length) await db().delete(leads).where(inArray(leads.id, made.leads));
	if (made.toppers.length) await db().delete(toppers).where(inArray(toppers.id, made.toppers));
});

test('leads: create is rate-limited per IP; list filters by status with keyset paging', async () => {
	const ip = `test-${crypto.randomUUID()}`;
	for (let i = 0; i < 5; i++) made.leads.push((await createLead({ name: `Lead ${i}`, phone: '9876543210' }, ip)).id);
	await expect(createLead({ name: 'Lead 6', phone: '9876543210' }, ip)).rejects.toThrow('Too many');
	await setLeadStatus(made.leads[0], 'contacted', null);

	const contacted = (await listLeads({ status: 'contacted', limit: 100 })).items.map((l) => l.id);
	expect(contacted).toContain(made.leads[0]);
	expect(contacted).not.toContain(made.leads[1]);

	const seen: string[] = [];
	let cursor: string | null = null;
	do {
		const p = await listLeads({ cursor, limit: 2 });
		seen.push(...p.items.map((l) => l.id));
		cursor = p.next;
	} while (cursor);
	expect(new Set(seen).size).toBe(seen.length);
	expect(made.leads.every((id) => seen.includes(id))).toBe(true);
});

test('toppers: reorder + publish reflect in the cached public site', async () => {
	const a = await createTopper({ name: 'Zed A', exam: 'SSC CGL 2025', result: 'AIR 1' }, null);
	const b = await createTopper({ name: 'Zed B', exam: 'SSC CGL 2025', result: 'AIR 2' }, null);
	made.toppers.push(a.id, b.id);
	await reorderToppers([b.id, a.id]);
	let pub = (await publicSite()).toppers.filter((t) => made.toppers.includes(t.id)).map((t) => t.id);
	expect(pub).toEqual([b.id, a.id]);
	await setTopperPublished(b.id, false, null);
	pub = (await publicSite()).toppers.filter((t) => made.toppers.includes(t.id)).map((t) => t.id);
	expect(pub).toEqual([a.id]);
	await deleteTopper(b.id, null);
});
