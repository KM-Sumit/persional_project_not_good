import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from '#lib/server/db';
import { banners, faculty, toppers } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { reorderInput, sortPlan } from '../schema';

type Sortable = typeof banners | typeof toppers | typeof faculty;

/** Sets sortOrder from the id order in one UPDATE; all ids must exist or nothing changes. */
export async function applyOrder(table: Sortable, ids: string[]) {
	const parsed = reorderInput.safeParse(ids);
	if (!parsed.success) throw new DomainError(400, parsed.error.issues[0]?.message ?? 'Invalid order.');
	const values = sql.join(
		sortPlan(parsed.data).map((p) => sql`(${p.id}::uuid, ${p.sortOrder}::int)`),
		sql`, `
	);
	await db().transaction(async (tx) => {
		const rows = await tx.execute(
			sql`update ${table as PgTable} set sort_order = v.s from (values ${values}) as v(id, s) where ${table as PgTable}.id = v.id returning 1`
		);
		if (rows.length !== parsed.data.length) throw new DomainError(404, 'Some items no longer exist. Reload and try again.');
	});
}

/** Zod-validates service input; the first issue becomes a 400 DomainError. */
export function parse<S extends z.ZodType>(schema: S, v: unknown): z.output<S> {
	const r = schema.safeParse(v);
	if (!r.success) throw new DomainError(400, r.error.issues[0]?.message ?? 'Invalid input.');
	return r.data;
}
