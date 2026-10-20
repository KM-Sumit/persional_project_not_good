import { redirect } from '@sveltejs/kit';
import { getResult, testDetail } from '#lib/features/tests/server/attempt';
import { DomainError, isStaff, toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();
	let result;
	try {
		result = await getResult(params.attemptId, { userId: user.id, staff: isStaff(user) });
	} catch (e) {
		// Still running: send the student back into it.
		if (e instanceof DomainError && e.status === 409) redirect(303, '/app/tests');
		toHttp(e);
	}
	// Retake only for the student's own attempt; a missing/hidden test just hides the button.
	const detail = result.userId === user.id ? await testDetail(result.test.id, user.id).catch(() => null) : null;
	return {
		result,
		retake: detail ? { canStart: detail.canStart && !detail.inProgressAttemptId && detail.lock !== 'password', password: detail.lock === 'password' && detail.canStart } : null
	};
};
