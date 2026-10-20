import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

const connect = () =>
	drizzle(postgres(env().DATABASE_URL, { prepare: false, max: 10 }), { schema, casing: 'snake_case' });

let instance: ReturnType<typeof connect> | undefined;

export const db = () => (instance ??= connect());

export async function dbReady() {
	try {
		await db().execute(sql`select 1`);
		return true;
	} catch {
		return false;
	}
}

export type Db = ReturnType<typeof db>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
