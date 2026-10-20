import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { adminEmails } from '$lib/server/env';
import type { SessionUser } from '../schema';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

export async function upsertGoogleUser(profile: { sub: string; email: string; name: string }): Promise<SessionUser> {
	const email = profile.email.toLowerCase();
	const role = adminEmails().includes(email) ? 'admin' : 'student';
	const [row] = await db()
		.insert(users)
		.values({ googleSub: profile.sub, email, name: profile.name, role })
		.onConflictDoUpdate({
			target: users.googleSub,
			set: { email, name: profile.name, role, updatedAt: new Date() }
		})
		.returning({ id: users.id, name: users.name, email: users.email, role: users.role });
	return row!;
}

export async function openSession(userId: string) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_MS);
	await db().insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
	return { token, expiresAt };
}

export async function validateSession(token: string): Promise<{ user: SessionUser; expiresAt: Date } | null> {
	const tokenHash = hashToken(token);
	const [row] = await db()
		.select({
			expiresAt: sessions.expiresAt,
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.tokenHash, tokenHash))
		.limit(1);
	if (!row) return null;
	if (row.expiresAt.getTime() <= Date.now()) {
		await db().delete(sessions).where(eq(sessions.tokenHash, tokenHash));
		return null;
	}
	let expiresAt = row.expiresAt;
	if (expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) {
		expiresAt = new Date(Date.now() + SESSION_MS);
		await db().update(sessions).set({ expiresAt }).where(eq(sessions.tokenHash, tokenHash));
	}
	return { user: { id: row.id, name: row.name, email: row.email, role: row.role }, expiresAt };
}

export async function destroySession(token: string) {
	await db().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
