import { expect, test } from 'bun:test';
import { LRU } from './lru';

test('evicts least recently used and expires entries', async () => {
	const c = new LRU<number>(2);
	c.set('a', 1, 1000);
	c.set('b', 2, 1000);
	c.get('a'); // a is now newest
	c.set('c', 3, 1000);
	expect(c.get('b')).toBeUndefined();
	expect(c.get('a')).toBe(1);
	expect(c.get('c')).toBe(3);
	c.set('x', 9, 5);
	await Bun.sleep(10);
	expect(c.get('x')).toBeUndefined();
});
