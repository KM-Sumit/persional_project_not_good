import { describe, expect, test } from 'bun:test';
import { LRU } from './lru';

describe('LRU', () => {
	test('drops the oldest key past capacity', () => {
		const cache = new LRU<number>(2);
		cache.set('a', 1, 10_000);
		cache.set('b', 2, 10_000);
		cache.set('c', 3, 10_000);
		expect(cache.get('a')).toBeUndefined();
		expect(cache.get('b')).toBe(2);
		expect(cache.get('c')).toBe(3);
	});

	test('expires a key', () => {
		const cache = new LRU<string>(4);
		cache.set('a', 'x', -1);
		expect(cache.get('a')).toBeUndefined();
	});
});
