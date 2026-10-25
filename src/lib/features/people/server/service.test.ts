import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { users } from '../../../server/db/schema';
import { profileInput } from '../schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const ids: string[] = [];
afterAll(async () => {
	if (ids.length) await db().delete(users).where(inArray(users.id, ids));
});

async function mk(name: string, role: 'student' | 'teacher' | 'admin' = 'student') {
	const [u] = await db().insert(users).values({ email: `${name.toLowerCase()}-${tag}@test.local`, name: `${name} ${tag}`, role }).returning();
	ids.push(u!.id);
	return u!;
}

test('phone normalisation', () => {
	expect(profileInput.parse({ name: 'Asha', phone: '+91 98765-43210' }).phone).toBe('+919876543210');
	expect(profileInput.parse({ name: 'Asha', phone: '' }).phone).toBeNull();
	expect(profileInput.safeParse({ name: 'Asha', phone: '12345' }).success).toBe(false);
});

test('list: search, filter, keyset paging without gaps or repeats', async () => {
	const people = [];
	for (const n of ['Cara', 'Abel', 'Bina', 'Dev', 'Esha']) people.push(await mk(n));
	await svc.updateProfile(people[1]!.id, { phone: '9876501234' });

	for (const sort of ['name', 'newest', 'oldest', 'active'] as const) {
		const seen: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await svc.listPeople({ q: tag, sort, limit: 2, cursor });
			seen.push(...page.items.map((p) => p.name));
			cursor = page.nextCursor ?? undefined;
		} while (cursor);
		expect(seen).toHaveLength(5);
		expect(new Set(seen).size).toBe(5);
		if (sort === 'name') expect(seen[0]).toBe(`Abel ${tag}`);
	}
	expect((await svc.listPeople({ q: '98765 01234' })).items.map((p) => p.id)).toEqual([people[1]!.id]);
	expect((await svc.listPeople({ q: tag, onboarded: true })).items).toHaveLength(0);
	await expect(svc.listPeople({ cursor: 'garbage' })).rejects.toThrow('cursor');

	const csv = await svc.exportPeopleCsv({ q: tag, sort: 'name' });
	expect(csv.split('\r\n')[1]).toStartWith(`Abel ${tag},abel-${tag}@test.local,+919876501234`);
});

test('onboarding, profile stats, roles, suspension', async () => {
	const s = await mk('Stu');
	const t = await mk('Tea', 'teacher');
	const a = await mk('Adm', 'admin');
	await expect(svc.completeOnboarding(s.id, { phone: '9876500000' } as never)).rejects.toThrow();
	const onboarded = await svc.completeOnboarding(s.id, { name: 'Stu Dent', phone: '9876500000' });
	expect(onboarded.onboarded).toBe(true);
	expect(onboarded.targetExamId).toBeNull();

	const prof = await svc.getProfile(s.id);
	expect(prof.stats).toEqual({ attempts: 0, avgPercent: null, coursesInProgress: 0, lessonsCompleted: 0 });

	await expect(svc.setRole(t, s.id, 'teacher')).rejects.toThrow('Only admins');
	expect((await svc.setRole(a, s.id, 'teacher')).role).toBe('teacher');
	await svc.setRole(a, s.id, 'student');
	const a2 = await mk('Adm2', 'admin');
	expect((await svc.setRole(a, a2.id, 'student')).role).toBe('student'); // other admins exist

	await expect(svc.setSuspended(t, a.id, true)).rejects.toThrow('Only admins');
	await expect(svc.setSuspended(a, a.id, true)).rejects.toThrow('yourself');
	const sus = await svc.setSuspended(t, s.id, true);
	expect(sus.suspended).toBe(true);
	const [row] = await db().select().from(users).where(inArray(users.id, [s.id]));
	expect(row!.sessionVersion).toBeGreaterThan(s.sessionVersion);
	expect((await svc.setSuspended(t, s.id, false)).suspended).toBe(false);
});
