import { describe, expect, test } from 'bun:test';
import { mockAuthAllowed, resetEnv } from './env';

const keys = ['NODE_ENV', 'GOOGLE_OAUTH_MOCK', 'DATABASE_URL'] as const;

function withEnv(values: Record<(typeof keys)[number], string | undefined>, fn: () => void) {
	const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
	try {
		for (const k of keys) {
			const v = values[k];
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
		resetEnv();
		fn();
	} finally {
		for (const k of keys) {
			const v = saved[k];
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
		resetEnv();
	}
}

describe('mock auth', () => {
	test('refuses the mock chooser in production', () => {
		withEnv(
			{
				NODE_ENV: 'production',
				GOOGLE_OAUTH_MOCK: '1',
				DATABASE_URL: 'postgres://uci:uci@localhost:5436/uci'
			},
			() => expect(mockAuthAllowed()).toBe(false)
		);
	});

	test('allows the mock chooser in development', () => {
		withEnv(
			{
				NODE_ENV: 'development',
				GOOGLE_OAUTH_MOCK: '1',
				DATABASE_URL: 'postgres://uci:uci@localhost:5436/uci'
			},
			() => expect(mockAuthAllowed()).toBe(true)
		);
	});
});
