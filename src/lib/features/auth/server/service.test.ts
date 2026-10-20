// Runs against the local DB (DATABASE_URL); every row uses a unique email and is deleted afterwards.
import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { mockIdentity } from '#lib/server/auth/google';
import { db } from '#lib/server/db';
import { users } from '#lib/server/db/schema';
import { bumpSessionVersion, getUser, signInWithGoogle, touchLastSeen } from './service';

const tag = crypto.randomUUID().slice(0, 8);
const emails: string[] = [];
const mail = (n: string) => {
	const e = `${n}-${tag}@uci.test`;
	emails.push(e);
	return e;
};
const ok = async (r: ReturnType<typeof signInWithGoogle>) => {
	const v = await r;
	if ('error' in v) throw new Error(v.error);
	return v.user;
};

afterAll(async () => {
	await db().delete(users).where(inArray(users.email, emails));
});

test('first sign-in creates a student; the second finds the same row by sub', async () => {
	const g = mockIdentity(mail('new'));
	const a = await ok(signInWithGoogle(g));
	expect(a.role).toBe('student');
	expect(a.googleSub).toBe(g.sub);
	expect(a.name).toContain('new-');
	const b = await ok(signInWithGoogle({ ...g, picture: 'https://lh3.googleusercontent.com/x' }));
	expect(b.id).toBe(a.id);
	expect(b.avatarUrl).toBe('https://lh3.googleusercontent.com/x');
});

test('links an existing row by email and keeps an edited name', async () => {
	const email = mail('link');
	const [row] = await db().insert(users).values({ email, name: 'Edited Name' }).returning();
	const u = await ok(signInWithGoogle(mockIdentity(email)));
	expect(u.id).toBe(row!.id);
	expect(u.googleSub).toBe(`mock:${email}`);
	expect(u.name).toBe('Edited Name');
});

test('ADMIN_EMAILS are promoted to admin', async () => {
	const email = mail('boss');
	const prev = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = `someone@else.test, ${email.toUpperCase()}`;
	try {
		expect((await ok(signInWithGoogle(mockIdentity(email)))).role).toBe('admin');
	} finally {
		process.env.ADMIN_EMAILS = prev;
	}
});

test('suspended users are refused', async () => {
	const email = mail('banned');
	await db().insert(users).values({ email, suspendedAt: new Date() });
	expect(await signInWithGoogle(mockIdentity(email))).toEqual({ error: 'suspended' });
});

test('logout bumps sessionVersion; lastSeen writes at most every 5 minutes', async () => {
	const u = await ok(signInWithGoogle(mockIdentity(mail('seen'))));
	await bumpSessionVersion(u.id);
	expect((await getUser(u.id))!.sessionVersion).toBe(u.sessionVersion + 1);
	expect(await touchLastSeen({ id: u.id, lastSeenAt: new Date() })).toBe(false);
	expect(await touchLastSeen({ id: u.id, lastSeenAt: new Date(Date.now() - 6 * 60_000) })).toBe(true);
	expect(await touchLastSeen({ id: u.id, lastSeenAt: null })).toBe(true);
});
