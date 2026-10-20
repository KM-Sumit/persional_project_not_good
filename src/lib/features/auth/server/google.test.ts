import { describe, expect, test } from 'bun:test';
import { safeNext, seal, unseal } from './google';

test('seal round-trips and rejects a bad signature', () => {
	const secret = 'a'.repeat(32);
	const token = seal({ next: '/home' }, secret, 60);
	expect(unseal<{ next: string }>(token, secret)?.next).toBe('/home');
	expect(unseal(token, 'b'.repeat(32))).toBeNull();
});

test('safeNext keeps relative paths', () => {
	expect(safeNext('/tests/1')).toBe('/tests/1');
	expect(safeNext('//evil.example')).toBe('/home');
	expect(safeNext('https://evil.example')).toBe('/home');
});
