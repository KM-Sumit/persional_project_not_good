// People: student directory (search, filters, keyset paging), profiles + stats, onboarding, roles, suspension, CSV.
import { and, asc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { academicSessions, attempts, batchMembers, batches, lessonProgress, users, type User } from '../../../server/db/schema';
import { DomainError } from '../../../server/http';
import { coursesInProgressCount } from '../../courses/server/service';
import {
	onboardingInput,
	peopleFilter,
	profileUpdate,
	roles,
	type PeopleFilter,
	type PersonRow,
	type ProfileDTO,
	type Role
} from '../schema';
import type { z } from 'zod';

type Actor = Pick<User, 'id' | 'role'>;

const toPerson = (u: User): PersonRow => ({
	id: u.id,
	name: u.name,
	email: u.email,
	phone: u.phone,
	city: u.city,
	avatarUrl: u.avatarUrl,
	role: u.role,
	targetExamId: u.targetExamId,
	onboarded: Boolean(u.onboardedAt),
	suspended: Boolean(u.suspendedAt),
	lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
	createdAt: u.createdAt.toISOString()
});

const SORTS = {
	newest: { key: sql`${users.createdAt}`, cast: sql`timestamptz`, dir: 'desc' },
	oldest: { key: sql`${users.createdAt}`, cast: sql`timestamptz`, dir: 'asc' },
	name: { key: sql`lower(${users.name})`, cast: sql`text`, dir: 'asc' },
	active: { key: sql`coalesce(${users.lastSeenAt}, 'epoch'::timestamptz)`, cast: sql`timestamptz`, dir: 'desc' }
} as const;

const encodeCursor = (v: string, id: string) => Buffer.from(JSON.stringify([v, id])).toString('base64url');
function decodeCursor(c: string): [string, string] | null {
	try {
		const v = JSON.parse(Buffer.from(c, 'base64url').toString());
		return Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && /^[0-9a-f-]{36}$/i.test(v[1]) ? [v[0], v[1]] : null;
	} catch {
		return null;
	}
}

/** One page of people. `nextCursor` is null on the last page. */
export async function listPeople(raw: PeopleFilter = {}) {
	const f = peopleFilter.parse(raw);
	const s = SORTS[f.sort];
	const conds: (SQL | undefined)[] = [];
	if (f.q) {
		const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		const digits = f.q.replace(/\D/g, '');
		conds.push(or(ilike(users.name, like), ilike(users.email, like), digits.length >= 3 ? ilike(users.phone, `%${digits}%`) : undefined));
	}
	if (f.role) conds.push(eq(users.role, f.role));
	if (f.onboarded !== undefined) conds.push(f.onboarded ? isNotNull(users.onboardedAt) : isNull(users.onboardedAt));
	if (f.suspended !== undefined) conds.push(f.suspended ? isNotNull(users.suspendedAt) : isNull(users.suspendedAt));
	if (f.batchId)
		conds.push(sql`exists (select 1 from ${batchMembers} bm where bm.user_id = ${users.id} and bm.batch_id = ${f.batchId})`);
	if (f.sessionId)
		conds.push(
			sql`exists (select 1 from ${batchMembers} bm join ${batches} b on b.id = bm.batch_id where bm.user_id = ${users.id} and b.session_id = ${f.sessionId})`
		);
	const cur = f.cursor ? decodeCursor(f.cursor) : null;
	if (f.cursor && !cur) throw new DomainError(400, 'Bad page cursor.');
	if (cur)
		conds.push(
			s.dir === 'desc'
				? sql`(${s.key}, ${users.id}) < (${cur[0]}::${s.cast}, ${cur[1]}::uuid)`
				: sql`(${s.key}, ${users.id}) > (${cur[0]}::${s.cast}, ${cur[1]}::uuid)`
		);
	const order = s.dir === 'desc' ? [sql`${s.key} desc`, sql`${users.id} desc`] : [sql`${s.key} asc`, sql`${users.id} asc`];
	const rows = await db()
		.select({ u: users, k: sql<string>`(${s.key})::text` })
		.from(users)
		.where(and(...conds))
		.orderBy(...order)
		.limit(f.limit + 1);
	const page = rows.slice(0, f.limit);
	const last = page.at(-1);
	return {
		items: page.map((r) => toPerson(r.u)),
		nextCursor: rows.length > f.limit && last ? encodeCursor(last.k, last.u.id) : null
	};
}

export async function getProfile(userId: string): Promise<ProfileDTO> {
	const [u] = await db().select().from(users).where(eq(users.id, userId));
	if (!u) throw new DomainError(404, 'Person not found.');
	const [bs, [att], [lp], coursesInProgress] = await Promise.all([
		db()
			.select({ id: batches.id, name: batches.name, sessionName: academicSessions.name })
			.from(batchMembers)
			.innerJoin(batches, eq(batches.id, batchMembers.batchId))
			.innerJoin(academicSessions, eq(academicSessions.id, batches.sessionId))
			.where(eq(batchMembers.userId, userId))
			.orderBy(asc(batches.name)),
		db()
			.select({
				n: sql<number>`count(*)::int`,
				avg: sql<number | null>`avg(case when ${attempts.maxScore} > 0 then ${attempts.score} * 100.0 / ${attempts.maxScore} end)::float8`
			})
			.from(attempts)
			.where(and(eq(attempts.userId, userId), sql`${attempts.status} <> 'in_progress'`)),
		db()
			.select({ n: sql<number>`count(*)::int` })
			.from(lessonProgress)
			.where(and(eq(lessonProgress.userId, userId), isNotNull(lessonProgress.completedAt))),
		coursesInProgressCount(userId)
	]);
	return {
		...toPerson(u),
		batches: bs,
		stats: {
			attempts: att?.n ?? 0,
			avgPercent: att?.avg == null ? null : Math.round(att.avg * 10) / 10,
			coursesInProgress,
			lessonsCompleted: lp?.n ?? 0
		}
	};
}

export async function updateProfile(userId: string, raw: z.input<typeof profileUpdate>) {
	const input = profileUpdate.parse(raw);
	const [u] = await db().update(users).set(input).where(eq(users.id, userId)).returning();
	if (!u) throw new DomainError(404, 'Person not found.');
	return toPerson(u);
}

export async function completeOnboarding(userId: string, raw: z.input<typeof onboardingInput>) {
	const input = onboardingInput.parse(raw);
	const [u] = await db()
		.update(users)
		.set({ ...input, onboardedAt: sql`coalesce(${users.onboardedAt}, now())` })
		.where(eq(users.id, userId))
		.returning();
	if (!u) throw new DomainError(404, 'Person not found.');
	return toPerson(u);
}

/** Admin only. The last admin can never be demoted (checked in the same statement, so two admins can't demote each other at once). */
export async function setRole(actor: Actor, userId: string, role: Role) {
	if (actor.role !== 'admin') throw new DomainError(403, 'Only admins can change roles.');
	if (!roles.includes(role)) throw new DomainError(400, 'Unknown role.');
	const [u] = await db()
		.update(users)
		.set({ role, sessionVersion: sql`${users.sessionVersion} + 1` })
		.where(
			and(
				eq(users.id, userId),
				role === 'admin'
					? undefined
					: sql`(${users.role} <> 'admin' or (select count(*) from ${users} a where a.role = 'admin' and a.suspended_at is null) > 1)`
			)
		)
		.returning();
	if (u) return toPerson(u);
	const [exists] = await db().select({ id: users.id }).from(users).where(eq(users.id, userId));
	if (!exists) throw new DomainError(404, 'Person not found.');
	throw new DomainError(409, 'This is the last admin. Make someone else an admin first.');
}

/** Suspension signs the person out everywhere (sessionVersion bump). Teachers can suspend students only. */
export async function setSuspended(actor: Actor, userId: string, suspended: boolean) {
	if (actor.id === userId) throw new DomainError(400, 'You cannot suspend yourself.');
	const [t] = await db().select({ role: users.role }).from(users).where(eq(users.id, userId));
	if (!t) throw new DomainError(404, 'Person not found.');
	if (actor.role !== 'admin' && t.role !== 'student') throw new DomainError(403, 'Only admins can suspend staff.');
	if (actor.role === 'student') throw new DomainError(403, 'Not allowed.');
	const [u] = await db()
		.update(users)
		.set(
			suspended
				? { suspendedAt: sql`coalesce(${users.suspendedAt}, now())`, sessionVersion: sql`${users.sessionVersion} + 1` }
				: { suspendedAt: null }
		)
		.where(eq(users.id, userId))
		.returning();
	return toPerson(u!);
}

/** Spreadsheet-safe CSV of every row matching the filter (formula-injection guarded). */
export async function exportPeopleCsv(raw: Omit<PeopleFilter, 'cursor' | 'limit'> = {}) {
	const cell = (v: unknown) => {
		let s = v == null ? '' : String(v);
		if (/^[=+\-@\t\r]/.test(s) && !/^\+?\d+$/.test(s)) s = `'${s}`; // plain numbers like +91... are safe
		return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const head = ['Name', 'Email', 'Phone', 'City', 'Role', 'Onboarded', 'Suspended', 'Joined', 'Last seen'];
	const lines = [head.join(',')];
	let cursor: string | undefined;
	do {
		const page = await listPeople({ ...raw, cursor, limit: 200 });
		for (const p of page.items)
			lines.push(
				[p.name, p.email, p.phone, p.city, p.role, p.onboarded ? 'yes' : 'no', p.suspended ? 'yes' : 'no', p.createdAt.slice(0, 10), p.lastSeenAt?.slice(0, 10)]
					.map(cell)
					.join(',')
			);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return lines.join('\r\n') + '\r\n';
}
