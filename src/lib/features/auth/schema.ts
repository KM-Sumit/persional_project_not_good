// Client-safe session user: what layouts hand to pages (no session version, no suspension internals).
export type Role = 'student' | 'teacher' | 'admin';

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	role: Role;
	onboarded: boolean;
};

export const toSessionUser = (u: { id: string; email: string; name: string; avatarUrl: string | null; role: Role; onboardedAt: Date | null }): SessionUser => ({
	id: u.id,
	email: u.email,
	name: u.name,
	avatarUrl: u.avatarUrl,
	role: u.role,
	onboarded: u.onboardedAt !== null
});
