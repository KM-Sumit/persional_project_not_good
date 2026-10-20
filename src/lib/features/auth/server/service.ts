// Accounts are Google-only: a verified Google identity signs in, links to an existing row with the same
// email, or creates a student. ADMIN_EMAILS are promoted to admin on every sign-in.
import { eq, sql } from 'drizzle-orm';
import type { GoogleIdentity } from '#lib/server/auth/google';
import { db } from '#lib/server/db';
import { users, type User } from '#lib/server/db/schema';
import { adminEmails } from '#lib/server/env';

const SEEN_EVERY_MS = 5 * 60_000;

export async function getUser(id: string): Promise<User | null> {
	const [u] = await db().select().from(users).where(eq(users.id, id)).limit(1);
	return u ?? null;
}

export async function signInWithGoogle(g: GoogleIdentity): Promise<{ user: User } | { error: 'suspended' }> {
	const email = g.email.toLowerCase();
	const name = `${g.firstName} ${g.lastName}`.trim();
	const admin = adminEmails().has(email);
	const [bySub] = await db().select().from(users).where(eq(users.googleSub, g.sub)).limit(1);
	const existing = bySub ?? (await db().select().from(users).where(eq(users.email, email)).limit(1))[0];

	if (existing) {
		if (existing.suspendedAt) return { error: 'suspended' };
		const [user] = await db()
			.update(users)
			.set({
				googleSub: g.sub, // Google verified this email, so the address owner is this Google account
				name: existing.name || name, // a name edited in the profile wins
				avatarUrl: g.picture ?? existing.avatarUrl,
				...(admin && { role: 'admin' as const }),
				lastSeenAt: new Date()
			})
			.where(eq(users.id, existing.id))
			.returning();
		return { user: user! };
	}

	const [user] = await db()
		.insert(users)
		.values({ email, googleSub: g.sub, name, avatarUrl: g.picture, role: admin ? 'admin' : 'student', lastSeenAt: new Date() })
		.returning();
	return { user: user! };
}

/** Logout: every token issued before this stops matching, on every device. */
export async function bumpSessionVersion(userId: string) {
	await db()
		.update(users)
		.set({ sessionVersion: sql`${users.sessionVersion} + 1` })
		.where(eq(users.id, userId));
}

/** Throttled presence: at most one write per user per 5 minutes. */
export async function touchLastSeen(u: Pick<User, 'id' | 'lastSeenAt'>, now = new Date()) {
	if (u.lastSeenAt && now.getTime() - u.lastSeenAt.getTime() < SEEN_EVERY_MS) return false;
	await db().update(users).set({ lastSeenAt: now }).where(eq(users.id, u.id));
	return true;
}
