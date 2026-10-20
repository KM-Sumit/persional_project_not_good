import { slugify } from '../schema';

/** slugify(title), then -2, -3... until `taken` says no. Shared by courses and notes. */
export async function uniqueSlug(source: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
	const base = slugify(source);
	for (let n = 1; n < 1000; n++) {
		const s = n === 1 ? base : `${base}-${n}`;
		if (!(await taken(s))) return s;
	}
	return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
