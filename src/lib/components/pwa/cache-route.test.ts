import { describe, expect, test } from 'bun:test';
import { cacheRoute } from './cache-route';

const O = 'https://uci.divyanshshukla.com';
const r = (u: string, m = 'GET', pre = new Set<string>()) => cacheRoute(m, new URL(u, O), O, pre);

describe('cacheRoute', () => {
	test('pages are network-first', () => {
		expect(r('/app')).toBe('page');
		expect(r('/app/learn/x/__data.json')).toBe('page');
		expect(r('/')).toBe('page');
	});
	test('exam screen, checkout, auth, api and POSTs never cache', () => {
		for (const p of ['/app/tests/1/attempt/2', '/app/checkout', '/app/me/billing', '/api/attempts/1/answer', '/auth/google', '/logout', '/admin/payments', '/x.csv'])
			expect(r(p)).toBe('network');
		expect(r('/app', 'POST')).toBe('network');
	});
	test('precache and fonts', () => {
		expect(r('/_app/immutable/a.js', 'GET', new Set(['/_app/immutable/a.js']))).toBe('precache');
		expect(r('https://fonts.gstatic.com/x.woff2')).toBe('font');
	});
	test('saved-offline items', () => {
		expect(r('/app/downloads/note/percent-basics')).toBe('saved');
		expect(r('/app/downloads/file/0b6c1f7e-0000-4000-8000-000000000000')).toBe('saved');
		expect(r('/app/downloads')).toBe('page');
		expect(r('/app/downloads/note/x/extra')).toBe('page');
		expect(r('/app/downloads/note/x', 'POST')).toBe('network');
	});
});
