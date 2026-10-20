import { expect, test } from 'bun:test';
import { parseEnv } from './env';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', AUTH_SECRET: 'x'.repeat(32) };

test('ORIGIN is required in production', () => {
	expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow();
	expect(() => parseEnv({ ...base, NODE_ENV: 'production', ORIGIN: '' })).toThrow();
	expect(parseEnv({ ...base, NODE_ENV: 'production', ORIGIN: 'https://uci.divyanshshukla.com' }).ORIGIN).toBe('https://uci.divyanshshukla.com');
	expect(parseEnv({ ...base, NODE_ENV: 'development' }).ORIGIN).toBeUndefined();
});

test('blank optional values count as unset', () => {
	const e = parseEnv({ ...base, REDIS_URL: '', GEMINI_API_KEY: '' });
	expect(e.REDIS_URL).toBeUndefined();
	expect(e.GEMINI_API_KEY).toBeUndefined();
});
