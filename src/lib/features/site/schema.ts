import { z } from 'zod';

/** Indian mobile -> "+91XXXXXXXXXX", or null. Accepts spaces, dashes, +91 / 91 / 0 prefixes. */
export function normalizeIndianPhone(raw: string): string | null {
	let d = raw.replace(/[\s\-().]/g, '');
	if (!/^\+?\d+$/.test(d)) return null;
	d = d.replace(/^\+/, '');
	if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
	else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
	return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

const phone = z.string().transform((v, ctx) => {
	const p = normalizeIndianPhone(v);
	if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number.' });
	return p ?? '';
});
const optPhone = z.preprocess((v) => (v === '' ? undefined : v), phone.optional());
const httpsUrl = z.preprocess((v) => (v === '' ? undefined : v), z.url({ protocol: /^https$/ }).optional());

// ---------- settings ----------
/** Every admin-editable site setting. One settings row per key; unknown keys are rejected. */
export const settingsSchema = z.object({
	contactPhone: optPhone,
	whatsappNumber: optPhone,
	email: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
	address: z.string().trim().max(500).optional(),
	mapUrl: httpsUrl,
	socials: z
		.object({ youtube: httpsUrl, instagram: httpsUrl, facebook: httpsUrl, telegram: httpsUrl, x: httpsUrl })
		.partial()
		.optional(),
	heroHeadline: z.string().trim().max(120).optional(),
	heroSubline: z.string().trim().max(300).optional(),
	stats: z
		.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(20) }))
		.max(8)
		.optional()
});
export const settingsPatch = settingsSchema.strict();
export type SiteSettings = z.output<typeof settingsSchema>;
export type SettingKey = keyof SiteSettings;
export const SETTING_KEYS = Object.keys(settingsSchema.shape) as SettingKey[];

// ---------- toppers / faculty ----------
export const topperInput = z.object({
	name: z.string().trim().min(1, 'Add a name.').max(80),
	exam: z.string().trim().min(1, 'Add the exam.').max(80),
	result: z.string().trim().min(1, 'Add the result.').max(60),
	quote: z.string().trim().max(300).default(''),
	photoFileId: z.uuid().nullable().default(null),
	published: z.boolean().default(true)
});
export type TopperInput = z.input<typeof topperInput>;
export type TopperDto = z.output<typeof topperInput> & { id: string; photo: string | null; sortOrder: number };

export const facultyInput = z.object({
	name: z.string().trim().min(1, 'Add a name.').max(80),
	subject: z.string().trim().min(1, 'Add the subject.').max(80),
	bio: z.string().trim().max(600).default(''),
	photoFileId: z.uuid().nullable().default(null),
	published: z.boolean().default(true)
});
export type FacultyInput = z.input<typeof facultyInput>;
export type FacultyDto = z.output<typeof facultyInput> & { id: string; photo: string | null; sortOrder: number };

export type PublicSite = { settings: SiteSettings; toppers: TopperDto[]; faculty: FacultyDto[] };

// ---------- leads ----------
export const LEAD_STATUSES = ['new', 'contacted', 'enrolled', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const leadInput = z.object({
	name: z.string().trim().min(2, 'Add your name.').max(80),
	phone,
	examInterest: z.string().trim().max(80).default(''),
	message: z.string().trim().max(1000).default('')
});
export type LeadInput = z.input<typeof leadInput>;
export type LeadDto = z.output<typeof leadInput> & { id: string; status: LeadStatus; createdAt: string };
