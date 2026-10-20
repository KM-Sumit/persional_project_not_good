import { expect, test } from 'bun:test';
import { z } from 'zod';
import { patchOf } from './zod';

test('patchOf drops defaults so omitted fields stay untouched', () => {
	const s = z.object({ title: z.string(), summary: z.string().default(''), paid: z.boolean().default(false) });
	expect(patchOf(s).parse({ title: 'x' })).toEqual({ title: 'x' });
	expect(patchOf(s).parse({ paid: true })).toEqual({ paid: true });
});
