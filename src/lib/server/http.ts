// Route guards and helpers. Every +server.ts / form action: guard -> body(zod) -> service -> json.
import { error, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import type { User } from './db/schema';

/** Teachers and admins manage content; only admins manage people, roles and settings. */
export const isStaff = (u: Pick<User, 'role'> | null | undefined) => u?.role === 'teacher' || u?.role === 'admin';

export function requireUser(event: Pick<RequestEvent, 'locals'>): User {
	const u = event.locals.user;
	if (!u) error(401, 'Sign in to continue.');
	return u;
}

export function requireStaff(event: Pick<RequestEvent, 'locals'>): User {
	const u = requireUser(event);
	if (!isStaff(u)) error(403, 'Only teachers can do this.');
	return u;
}

export function requireAdmin(event: Pick<RequestEvent, 'locals'>): User {
	const u = requireUser(event);
	if (u.role !== 'admin') error(403, 'Only admins can do this.');
	return u;
}

/** Parses a JSON body with a Zod schema; 400 with the first issue on failure. */
export async function body<S extends z.ZodType>(event: Pick<RequestEvent, 'request'>, schema: S): Promise<z.infer<S>> {
	const raw = await event.request.json().catch(() => undefined);
	const r = schema.safeParse(raw);
	if (!r.success) error(400, r.error.issues[0]?.message ?? 'Invalid request.');
	return r.data;
}

/** Parses FormData (form actions) into an object, then validates. */
export function form<S extends z.ZodType>(data: FormData, schema: S): { ok: true; data: z.infer<S> } | { ok: false; message: string } {
	const obj: Record<string, unknown> = {};
	for (const [k, v] of data) obj[k] = typeof v === 'string' ? v : v;
	const r = schema.safeParse(obj);
	return r.success ? { ok: true, data: r.data } : { ok: false, message: r.error.issues[0]?.message ?? 'Check the form.' };
}

/** Domain errors thrown by services; routes map them to HTTP with toHttp(). */
export class DomainError extends Error {
	constructor(
		public status: 400 | 403 | 404 | 409 | 410 | 422 | 423 | 429 | 503,
		message: string
	) {
		super(message);
	}
}

export function toHttp(e: unknown): never {
	if (e instanceof DomainError) error(e.status, e.message);
	throw e;
}
