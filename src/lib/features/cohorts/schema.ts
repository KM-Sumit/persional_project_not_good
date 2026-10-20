// Academic sessions + batches: Zod inputs, DTOs, join-code helpers (client-safe).
import { patchOf } from '#lib/zod.ts';
import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-04-01.');

export const sessionInput = z
	.object({
		name: z.string().trim().min(1, 'Name is required.').max(40), // "2026-27"
		startsOn: ymd,
		endsOn: ymd
	})
	.refine((v) => v.startsOn < v.endsOn, { message: 'The session must end after it starts.', path: ['endsOn'] });

const optUuid = z.preprocess((v) => (v === '' ? null : v), z.uuid().nullable().optional());

export const batchInput = z.object({
	sessionId: z.uuid(),
	examId: optUuid,
	name: z.string().trim().min(1, 'Name is required.').max(120)
});
export const batchUpdate = patchOf(batchInput.omit({ sessionId: true }));

/** No 0/O, 1/I/L: codes get read out loud in class. */
export const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normalizeJoinCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const joinCodeInput = z.object({
	code: z
		.string()
		.transform(normalizeJoinCode)
		.pipe(z.string().length(6, 'Join codes have 6 characters.'))
});

export function newJoinCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	// 256 % 31 bias is ~1%: fine for a non-secret, uniqueness-checked code.
	return Array.from(bytes, (b) => JOIN_ALPHABET[b % JOIN_ALPHABET.length]).join('');
}

export type SessionDTO = { id: string; name: string; startsOn: string; endsOn: string; isCurrent: boolean; createdAt: string };
export type BatchDTO = {
	id: string;
	sessionId: string;
	sessionName: string;
	examId: string | null;
	name: string;
	joinCode: string;
	archived: boolean;
	memberCount: number;
	createdAt: string;
};
export type MemberDTO = { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; joinedAt: string };
