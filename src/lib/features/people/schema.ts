// People (students, teachers, admins): Zod inputs + DTOs (client-safe).
import { patchOf } from '#lib/zod.ts';
import { z } from 'zod';
import { normalizeIndianPhone } from '../site/schema';

export const roles = ['student', 'teacher', 'admin'] as const;
export type Role = (typeof roles)[number];

const blankNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const profileInput = z.object({
	name: z.string().trim().min(2, 'Enter your full name.').max(80),
	/** Indian mobile, stored as +91XXXXXXXXXX (same format as site settings). */
	phone: z.preprocess(
		blankNull,
		z
			.string()
			.transform((v, ctx) => normalizeIndianPhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number.' }), z.NEVER))
			.nullable()
			.optional()
	),
	city: z.preprocess(blankNull, z.string().trim().max(80).nullable().optional()),
	targetExamId: z.preprocess(blankNull, z.uuid().nullable().optional())
});
export const profileUpdate = patchOf(profileInput);

/** Onboarding asks for name and mobile. The target exam is chosen later in the profile. */
export const onboardingInput = profileInput.extend({
	phone: profileInput.shape.phone.refine((v) => Boolean(v), 'Enter your mobile number.')
});

export const peopleSorts = ['newest', 'oldest', 'name', 'active'] as const;
export const peopleFilter = z.object({
	q: z.string().trim().max(100).optional(),
	role: z.enum(roles).optional(),
	batchId: z.uuid().optional(),
	sessionId: z.uuid().optional(),
	onboarded: z.boolean().optional(),
	suspended: z.boolean().optional(),
	sort: z.enum(peopleSorts).default('newest'),
	cursor: z.string().max(400).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50)
});
export type PeopleFilter = z.input<typeof peopleFilter>;

export type PersonRow = {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	city: string | null;
	avatarUrl: string | null;
	role: Role;
	targetExamId: string | null;
	onboarded: boolean;
	suspended: boolean;
	lastSeenAt: string | null;
	createdAt: string;
};
export type ProfileDTO = PersonRow & {
	batches: { id: string; name: string; sessionName: string }[];
	stats: { attempts: number; avgPercent: number | null; coursesInProgress: number; lessonsCompleted: number };
};
