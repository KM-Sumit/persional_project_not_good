// Form-action helpers for the staff tests + bank screens: service DomainErrors become fail() with a message.
import { fail, isRedirect } from '@sveltejs/kit';
import { DomainError } from '#lib/server/http';

export async function act<T>(fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (e) {
		if (isRedirect(e)) throw e;
		if (e instanceof DomainError) return fail(e.status, { message: e.message });
		throw e;
	}
}

/** FormData -> plain object (last value wins); use fd.getAll for repeated keys. */
export const formObject = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

/** The question editor posts prompt, option (repeated), correctIndex, explanation, topic, difficulty, imageFileId. */
export function questionFromForm(fd: FormData) {
	const o = formObject(fd);
	return {
		prompt: o.prompt,
		options: fd.getAll('option').map(String),
		correctIndex: o.correctIndex,
		explanation: o.explanation ?? '',
		topic: o.topic ?? '',
		difficulty: o.difficulty || undefined,
		...(fd.has('imageFileId') ? { imageFileId: o.imageFileId || null } : {})
	};
}

export const idsFrom = (fd: FormData, key = 'ids') =>
	fd
		.getAll(key)
		.flatMap((v) => String(v).split(','))
		.filter(Boolean);
