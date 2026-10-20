// Session token rules (sessionVersion revocation, typ check), homeFor and safeNext.
import { describe, expect, test } from 'bun:test';
process.env.AUTH_SECRET ??= 'test-secret-test-secret-test-secret-123';
const { homeFor, parseSessionToken, safeNext, sessionToken, signToken } = await import('./session');

describe('session tokens', () => {
	test('carry the user id and sessionVersion', async () => {
		const p = await parseSessionToken(await sessionToken({ id: 'u1', sessionVersion: 3 }));
		expect(p?.sub).toBe('u1');
		expect(p?.sv).toBe(3);
	});

	test('OAuth flow tokens signed with the same key are not sessions', async () => {
		expect(await parseSessionToken(await signToken({ state: 's', verifier: 'v', nonce: 'n', next: '' }, 60))).toBeNull();
	});

	test('a token without sv never matches a sessionVersion', async () => {
		const p = await parseSessionToken(await signToken({ sub: 'u1', typ: 'session' }, 60));
		expect(p?.sv).toBe(-1);
	});

	test('tampered or garbage tokens are rejected', async () => {
		const t = await sessionToken({ id: 'u1', sessionVersion: 0 });
		expect(await parseSessionToken(t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA'))).toBeNull();
		expect(await parseSessionToken('nope')).toBeNull();
		expect(await parseSessionToken(undefined)).toBeNull();
	});
});

describe('homeFor', () => {
	test('staff -> /admin, students onboard first, then /app', () => {
		expect(homeFor({ role: 'admin', onboardedAt: null })).toBe('/admin');
		expect(homeFor({ role: 'teacher', onboardedAt: null })).toBe('/admin');
		expect(homeFor({ role: 'student', onboardedAt: null })).toBe('/onboarding');
		expect(homeFor({ role: 'student', onboardedAt: new Date() })).toBe('/app');
	});
});

test('safeNext never points back at an auth page (no /login?next=/login loop)', () => {
	expect(safeNext('/login', '/app')).toBe('/app');
	expect(safeNext('/logout', '/app')).toBe('/app');
	expect(safeNext('/auth/google', '/app')).toBe('/app');
	expect(safeNext('/auth/google/callback?code=x', '/app')).toBe('/app');
	expect(safeNext('/loginx', '/app')).toBe('/loginx');
	expect(safeNext('/app/tests/abc?x=1', '/app')).toBe('/app/tests/abc?x=1');
	expect(safeNext('//evil.com', '/app')).toBe('/app');
	expect(safeNext('/\\evil.com', '/app')).toBe('/app');
	expect(safeNext('https://evil.com', '/app')).toBe('/app');
});
