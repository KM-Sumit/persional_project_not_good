import { expect, test } from 'bun:test';
import { allowRequest, hit, matchRule } from './rate-limit';

// The local .env turns limits off for browser test runs; these tests exercise the real limiter.
delete process.env.RATE_LIMIT;

test('hit allows up to the limit, then blocks, per key', async () => {
	const key = `test:${crypto.randomUUID()}`;
	for (let i = 0; i < 3; i++) expect(await hit(key, 3, 60)).toBe(true);
	expect(await hit(key, 3, 60)).toBe(false);
	expect(await hit(`${key}:other`, 3, 60)).toBe(true);
});

test('rules cover auth, contact, test unlock and the API only', () => {
	expect(matchRule('GET', '/auth/google?next=/app')?.name).toBe('auth');
	expect(matchRule('GET', '/auth/google/callback?code=x')?.name).toBe('auth');
	expect(matchRule('POST', '/contact')?.name).toBe('contact');
	expect(matchRule('POST', '/contact?/send')?.name).toBe('contact');
	expect(matchRule('GET', '/contact')).toBeNull();
	expect(matchRule('POST', '/app/tests/abc?/unlock')?.name).toBe('test_unlock');
	expect(matchRule('POST', '/app/tests/abc/attempt/x?/save')).toBeNull();
	expect(matchRule('GET', '/api/files/x')?.name).toBe('api');
	expect(matchRule('POST', '/api/attempts/x/answer')?.name).toBe('api');
	expect(matchRule('GET', '/app')).toBeNull();
});

test('allowRequest keys by user when signed in, else by IP', async () => {
	const ev = (user: { id: string } | null, ip: string) =>
		({
			request: new Request('http://x/app/tests/abc?/unlock', { method: 'POST' }),
			url: new URL('http://x/app/tests/abc?/unlock'),
			locals: { user },
			getClientAddress: () => ip
		}) as unknown as Parameters<typeof allowRequest>[0];
	const ip = `10.${Math.random()}`;
	const a = { id: crypto.randomUUID() };
	for (let i = 0; i < 30; i++) expect(await allowRequest(ev(a, ip))).toBe(true);
	expect(await allowRequest(ev(a, ip))).toBe(false);
	expect(await allowRequest(ev({ id: crypto.randomUUID() }, ip))).toBe(true); // same IP, other student
	expect(await allowRequest(ev(null, ip))).toBe(true);
});
