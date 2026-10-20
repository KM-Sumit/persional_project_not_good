import { error } from '@sveltejs/kit';
import { getTest } from '#lib/features/tests/server/service';
import { DomainError, requireStaff } from '#lib/server/http';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	requireStaff(event);
	try {
		return { test: await getTest(event.params.id) };
	} catch (e) {
		if (e instanceof DomainError) error(e.status, e.message);
		throw e;
	}
};
