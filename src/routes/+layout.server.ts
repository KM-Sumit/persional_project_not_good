import { toSessionUser } from '#lib/features/auth/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user ? toSessionUser(locals.user) : null });
