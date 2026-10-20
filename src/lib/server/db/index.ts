import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

const connect = () =>
	// prepare:false keeps it compatible with PgBouncer transaction pooling in production.
	// max 20: a full class starting together + advisory locks on start must not queue behind 10 slots.
	drizzle(postgres(env().DATABASE_URL, { prepare: false, max: 20, idle_timeout: 30 }), { schema, casing: 'snake_case' });

// Kept on globalThis so Vite dev reloads reuse one pool instead of leaking a new one per reload
// (several dev servers otherwise exhaust Postgres max_connections).
const g = globalThis as typeof globalThis & { __cqDb?: ReturnType<typeof connect> };

/** Created on first use so `vite build` (which imports server modules) never needs a database. */
export const db = () => (g.__cqDb ??= connect());
export type DB = ReturnType<typeof db>;
export { schema };

export async function dbReady() {
	try {
		await db().execute('select 1');
		return true;
	} catch {
		return false;
	}
}
