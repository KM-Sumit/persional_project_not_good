import type { PeopleFilter } from '#lib/features/people/schema';

export const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

export function peopleQuery(url: URL): Omit<PeopleFilter, 'cursor' | 'limit'> {
	const p = url.searchParams;
	const onboarded = p.get('onboarded');
	const sort = p.get('sort');
	return {
		role: 'student',
		q: p.get('q')?.trim() || undefined,
		batchId: uuid(p.get('batch')),
		sessionId: uuid(p.get('session')),
		onboarded: onboarded === 'yes' ? true : onboarded === 'no' ? false : undefined,
		suspended: p.get('status') === 'suspended' ? true : undefined,
		sort: sort === 'active' || sort === 'name' || sort === 'oldest' ? sort : 'newest'
	};
}
