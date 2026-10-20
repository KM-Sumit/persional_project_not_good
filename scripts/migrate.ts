// Applies drizzle/ migrations at container start (production has no drizzle-kit).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Migrations take a session-level lock, so they must bypass PgBouncer (transaction pooling) and hit Postgres directly.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL / DATABASE_URL is not set');
const client = postgres(url, { max: 1, onnotice: () => {} });

// One-time cleanup of the discarded Cursor build's schema (owner approved wiping it, 2026-10-21).
// Fires only when that schema is recognisable: its `unlocks` table exists and our `attempt_answers` does not.
// ponytail: delete this block once production has booted the new build once.
const [legacy] = await client`select
	to_regclass('public.unlocks') is not null as old,
	to_regclass('public.attempt_answers') is not null as new`;
if (legacy.old && !legacy.new) {
	console.log('[boot] dropping the old Cursor schema');
	await client.unsafe('drop schema public cascade; create schema public; drop schema if exists drizzle cascade;');
}

await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
console.log('[boot] migrations applied');
