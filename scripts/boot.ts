import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const started = Date.now();
process.env.BOOT_STARTED = String(started);

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
	console.error('[boot] missing database url');
	process.exit(1);
}

console.log('[boot] migrations');
const sql = postgres(url, { max: 1 });
try {
	await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
} catch (error) {
	const message = error instanceof Error ? error.message : 'failed';
	console.error('[boot] migrations failed', message.replace(/postgres:\/\/\S+/g, 'postgres://…'));
	process.exit(1);
} finally {
	await sql.end();
}
console.log(`[boot] migrations done in ${Date.now() - started} ms`);
await import('../server.js');
