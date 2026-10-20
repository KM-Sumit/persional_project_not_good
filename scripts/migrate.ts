// Applies drizzle/ migrations at container start (production has no drizzle-kit).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Migrations take a session-level lock, so they must bypass PgBouncer (transaction pooling) and hit Postgres directly.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL / DATABASE_URL is not set');
const client = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
console.log('[boot] migrations applied');
