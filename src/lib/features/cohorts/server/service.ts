// Academic sessions -> batches -> members. Drizzle lives only here.
import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { academicSessions, batchMembers, batches, users } from '../../../server/db/schema';
import { cached, cacheKeys, invalidate } from '../../../server/cache/index';
import { DomainError } from '../../../server/http';
import {
	batchInput,
	batchUpdate,
	joinCodeInput,
	newJoinCode,
	sessionInput,
	type BatchDTO,
	type MemberDTO,
	type SessionDTO
} from '../schema';
import type { z } from 'zod';

const toSession = (s: typeof academicSessions.$inferSelect): SessionDTO => ({
	id: s.id,
	name: s.name,
	startsOn: s.startsOn,
	endsOn: s.endsOn,
	isCurrent: s.isCurrent,
	createdAt: s.createdAt.toISOString()
});

const isUnique = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505';

// ---------- sessions ----------
export const listSessions = () =>
	cached(cacheKeys.sessions, 600, async () =>
		(await db().select().from(academicSessions).orderBy(desc(academicSessions.startsOn))).map(toSession)
	);

export const currentSession = async () => (await listSessions()).find((s) => s.isCurrent) ?? null;

export async function createSession(raw: z.input<typeof sessionInput>) {
	const input = sessionInput.parse(raw);
	try {
		const [row] = await db().insert(academicSessions).values(input).returning();
		await invalidate(cacheKeys.sessions);
		return toSession(row!);
	} catch (e) {
		if (isUnique(e)) throw new DomainError(409, 'A session with that name exists.');
		throw e;
	}
}

export async function updateSession(id: string, raw: z.input<typeof sessionInput>) {
	const input = sessionInput.parse(raw);
	const [row] = await db().update(academicSessions).set(input).where(eq(academicSessions.id, id)).returning();
	if (!row) throw new DomainError(404, 'Session not found.');
	await invalidate(cacheKeys.sessions);
	return toSession(row);
}

/** Deleting a session deletes its batches (cascade); refuse while it still has members. */
export async function deleteSession(id: string) {
	const [{ n }] = (await db()
		.select({ n: count() })
		.from(batchMembers)
		.innerJoin(batches, eq(batches.id, batchMembers.batchId))
		.where(eq(batches.sessionId, id))) as [{ n: number }];
	if (n > 0) throw new DomainError(409, 'This session still has students in its batches. Archive it instead.');
	await db().delete(academicSessions).where(eq(academicSessions.id, id));
	await invalidate(cacheKeys.sessions);
}

/** Exactly one current session. */
export async function setCurrentSession(id: string) {
	await db().transaction(async (tx) => {
		const [row] = await tx.update(academicSessions).set({ isCurrent: true }).where(eq(academicSessions.id, id)).returning();
		if (!row) throw new DomainError(404, 'Session not found.');
		await tx
			.update(academicSessions)
			.set({ isCurrent: false })
			.where(and(eq(academicSessions.isCurrent, true), ne(academicSessions.id, id)));
	});
	await invalidate(cacheKeys.sessions);
}

// ---------- batches ----------
const batchSelect = {
	id: batches.id,
	sessionId: batches.sessionId,
	sessionName: academicSessions.name,
	examId: batches.examId,
	name: batches.name,
	joinCode: batches.joinCode,
	archived: batches.archived,
	memberCount: count(batchMembers.userId),
	createdAt: batches.createdAt
};
const toBatch = (r: Omit<BatchDTO, 'createdAt'> & { createdAt: Date }): BatchDTO => ({ ...r, createdAt: r.createdAt.toISOString() });

function batchQuery() {
	return db()
		.select(batchSelect)
		.from(batches)
		.innerJoin(academicSessions, eq(academicSessions.id, batches.sessionId))
		.leftJoin(batchMembers, eq(batchMembers.batchId, batches.id))
		.groupBy(batches.id, academicSessions.id)
		.$dynamic();
}

export async function listBatches(opts: { sessionId?: string; includeArchived?: boolean } = {}) {
	const conds = [];
	if (opts.sessionId) conds.push(eq(batches.sessionId, opts.sessionId));
	if (!opts.includeArchived) conds.push(eq(batches.archived, false));
	const rows = await batchQuery()
		.where(conds.length ? and(...conds) : undefined)
		.orderBy(desc(academicSessions.startsOn), asc(batches.name));
	return rows.map(toBatch);
}

export async function getBatch(id: string): Promise<BatchDTO> {
	const [r] = await batchQuery().where(eq(batches.id, id));
	if (!r) throw new DomainError(404, 'Batch not found.');
	return toBatch(r);
}

/** Inserts with a fresh join code, retrying on the (rare) code collision. */
async function insertBatch(values: { sessionId: string; examId?: string | null; name: string }) {
	for (let i = 0; i < 8; i++) {
		try {
			const [row] = await db()
				.insert(batches)
				.values({ ...values, joinCode: newJoinCode() })
				.returning({ id: batches.id });
			return row!.id;
		} catch (e) {
			if (!isUnique(e)) throw e;
		}
	}
	throw new DomainError(503, 'Could not generate a join code. Try again.');
}

export async function createBatch(raw: z.input<typeof batchInput>) {
	return getBatch(await insertBatch(batchInput.parse(raw)));
}

export async function updateBatch(id: string, raw: z.input<typeof batchUpdate>) {
	const input = batchUpdate.parse(raw);
	const [row] = await db().update(batches).set(input).where(eq(batches.id, id)).returning({ id: batches.id });
	if (!row) throw new DomainError(404, 'Batch not found.');
	return getBatch(id);
}

export async function setBatchArchived(id: string, archived: boolean) {
	await db().update(batches).set({ archived }).where(eq(batches.id, id));
}

export async function deleteBatch(id: string) {
	await db().delete(batches).where(eq(batches.id, id));
}

/** New code; the old one stops working (leaked code). */
export async function regenerateJoinCode(id: string) {
	for (let i = 0; i < 8; i++) {
		try {
			const [row] = await db().update(batches).set({ joinCode: newJoinCode() }).where(eq(batches.id, id)).returning({ code: batches.joinCode });
			if (!row) throw new DomainError(404, 'Batch not found.');
			return row.code;
		} catch (e) {
			if (!isUnique(e)) throw e;
		}
	}
	throw new DomainError(503, 'Could not generate a join code. Try again.');
}

/** Student self-join. Rate-limit at the route (codes are guessable by brute force). */
export async function joinByCode(userId: string, raw: z.input<typeof joinCodeInput>) {
	const { code } = joinCodeInput.parse(raw);
	const [b] = await db().select({ id: batches.id, archived: batches.archived }).from(batches).where(eq(batches.joinCode, code));
	if (!b || b.archived) throw new DomainError(404, 'No open batch has that code.');
	await db().insert(batchMembers).values({ batchId: b.id, userId }).onConflictDoNothing();
	return getBatch(b.id);
}

// ---------- members ----------
export async function listMembers(batchId: string): Promise<MemberDTO[]> {
	const rows = await db()
		.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, avatarUrl: users.avatarUrl, joinedAt: batchMembers.joinedAt })
		.from(batchMembers)
		.innerJoin(users, eq(users.id, batchMembers.userId))
		.where(eq(batchMembers.batchId, batchId))
		.orderBy(asc(users.name));
	return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}

export async function addMembers(batchId: string, userIds: string[]) {
	if (!userIds.length) return 0;
	const rows = await db()
		.insert(batchMembers)
		.values(userIds.map((userId) => ({ batchId, userId })))
		.onConflictDoNothing()
		.returning({ userId: batchMembers.userId });
	return rows.length;
}

export async function removeMembers(batchId: string, userIds: string[]) {
	if (!userIds.length) return;
	await db().delete(batchMembers).where(and(eq(batchMembers.batchId, batchId), inArray(batchMembers.userId, userIds)));
}

export async function moveMembers(fromBatchId: string, toBatchId: string, userIds: string[]) {
	if (fromBatchId === toBatchId || !userIds.length) return;
	await db().transaction(async (tx) => {
		await tx.delete(batchMembers).where(and(eq(batchMembers.batchId, fromBatchId), inArray(batchMembers.userId, userIds)));
		await tx
			.insert(batchMembers)
			.values(userIds.map((userId) => ({ batchId: toBatchId, userId })))
			.onConflictDoNothing();
	});
}

/** Non-archived batches the user belongs to (drives course/note/test visibility). */
export async function userBatchIds(userId: string): Promise<string[]> {
	const rows = await db()
		.select({ id: batchMembers.batchId })
		.from(batchMembers)
		.innerJoin(batches, eq(batches.id, batchMembers.batchId))
		.where(and(eq(batchMembers.userId, userId), eq(batches.archived, false)));
	return rows.map((r) => r.id);
}

export async function userBatches(userId: string): Promise<BatchDTO[]> {
	const ids = (await db().select({ id: batchMembers.batchId }).from(batchMembers).where(eq(batchMembers.userId, userId))).map((r) => r.id);
	if (!ids.length) return [];
	return (await batchQuery().where(inArray(batches.id, ids)).orderBy(desc(academicSessions.startsOn), asc(batches.name))).map(toBatch);
}

/** New session: copy the old session's open batches (fresh codes, no members). Re-runnable: skips names already there. */
export async function rollover(fromSessionId: string, toSessionId: string) {
	if (fromSessionId === toSessionId) throw new DomainError(400, 'Pick two different sessions.');
	const src = await db().select().from(batches).where(and(eq(batches.sessionId, fromSessionId), eq(batches.archived, false)));
	const existing = new Set(
		(await db().select({ name: batches.name }).from(batches).where(eq(batches.sessionId, toSessionId))).map((r) => r.name)
	);
	const created: string[] = [];
	for (const b of src) {
		if (existing.has(b.name)) continue;
		created.push(await insertBatch({ sessionId: toSessionId, examId: b.examId, name: b.name }));
	}
	return created;
}
