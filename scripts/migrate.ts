import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../src/lib/server/env.ts';

const sql = postgres(env().MIGRATION_DATABASE_URL ?? env().DATABASE_URL, { max: 1 });

try {
	await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
} finally {
	await sql.end();
}
