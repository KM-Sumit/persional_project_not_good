// Shared by the U4 staff pages: run a service call inside a form action and turn domain/validation
// errors into `fail()` so the page can toast them instead of showing an error page.
import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { DomainError } from '#lib/server/http';

export async function act(fn: () => Promise<unknown>, message: string | ((result: never) => string) = 'Saved') {
	try {
		const result = await fn();
		return { message: typeof message === 'function' ? message(result as never) : message };
	} catch (e) {
		if (e instanceof DomainError) return fail(e.status, { message: e.message });
		if (e instanceof ZodError) return fail(400, { message: e.issues[0]?.message ?? 'Check the form.' });
		throw e;
	}
}

/** FormData helpers: trimmed string or '' / ids list / checkbox. */
export const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
export const ids = (d: FormData, k = 'ids') =>
	d
		.getAll(k)
		.flatMap((v) => String(v).split(','))
		.map((s) => s.trim())
		.filter(Boolean);
export const on = (d: FormData, k: string) => d.get(k) === 'on' || d.get(k) === 'true';
