// Small pure helpers shared by bank and tests: keyset cursors, CSV.
import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

// ---------- keyset paging on (createdAt desc, id desc) ----------
// The cursor carries Postgres' own timestamp text so microseconds survive (a JS Date would drop them).
const TS = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(\.\d+)?([+-]\d\d(:?\d\d)?|Z)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const encodeCursor = (ts: string, id: string) => Buffer.from(`${ts}|${id}`).toString('base64url');
export function decodeCursor(c: string | null | undefined): { ts: string; id: string } | null {
	if (!c) return null;
	const [ts, id] = Buffer.from(c, 'base64url').toString().split('|');
	return ts && id && TS.test(ts) && UUID.test(id) ? { ts, id } : null;
}
/** WHERE clause for the page after `cursor` (null when there is no valid cursor). */
export const afterCursor = (ts: PgColumn, id: PgColumn, cursor: string | null | undefined): SQL | undefined => {
	const c = decodeCursor(cursor);
	return c ? sql`(${ts}, ${id}) < (${c.ts}::timestamptz, ${c.id}::uuid)` : undefined;
};
export const tsText = (col: PgColumn) => sql<string>`${col}::text`;

/** Trims a fetched limit+1 page and builds the next cursor. Rows carry `cur` (tsText) and `id`. */
export function pageOf<R extends { cur: string; id: string }>(rows: R[], limit: number) {
	const more = rows.length > limit;
	const items = more ? rows.slice(0, limit) : rows;
	const last = items.at(-1);
	return { items, nextCursor: more && last ? encodeCursor(last.cur, last.id) : null };
}

// ---------- CSV ----------
/** RFC 4180 parser: quoted fields, doubled quotes, CRLF/LF, embedded newlines. Drops blank lines. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const s = text.replace(/^\uFEFF/, '');
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (quoted) {
			if (ch === '"' && s[i + 1] === '"') (field += '"'), i++;
			else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') row.push(field), (field = '');
		else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && s[i + 1] === '\n') i++;
			row.push(field), (field = '');
			if (row.some((f) => f.trim())) rows.push(row);
			row = [];
		} else field += ch;
	}
	row.push(field);
	if (row.some((f) => f.trim())) rows.push(row);
	return rows;
}

const cell = (v: unknown) => {
	const s = v == null ? '' : String(v);
	// Leading = + - @ would run as a formula in Excel/Sheets.
	const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
	return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
