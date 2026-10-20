import { z } from 'zod';

/**
 * Update schema from a create schema: every field optional and NO defaults, so a partial update only
 * touches the fields it sends. (`schema.partial()` keeps `.default()`s, which silently reset omitted
 * fields such as a course description to '' on any unrelated edit.)
 */
export function patchOf<S extends z.ZodObject>(schema: S) {
	const shape = Object.fromEntries(
		Object.entries(schema.shape).map(([k, v]) => [k, z.optional((v instanceof z.ZodDefault ? v.unwrap() : v) as z.ZodType)])
	);
	return z.object(shape) as unknown as z.ZodObject<{ [K in keyof S['shape']]: z.ZodOptional<S['shape'][K]> }>;
}
