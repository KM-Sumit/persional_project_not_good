import { z } from 'zod';

const schema = z.object({
	DATABASE_URL: z.string().min(1),
	MIGRATION_DATABASE_URL: z.string().min(1).optional(),
	REDIS_URL: z.string().min(1).optional(),
	AUTH_SECRET: z.string().min(32).optional(),
	ORIGIN: z.string().min(1).optional(),
	ADMIN_EMAILS: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_OAUTH_MOCK: z.string().optional(),
	OPENROUTER_API_KEY: z.string().optional(),
	OPENROUTER_MODEL: z.string().optional(),
	GEMINI_API_KEY: z.string().optional(),
	R2_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET: z.string().optional(),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

/** Parsed on first use so `vite build` never needs a database or secrets. */
export const env = () => (parsed ??= schema.parse(process.env));

export const resetEnv = () => {
	parsed = undefined;
};

/** Dev/test only. Production ignores the flag even if it is set. */
export function mockAuthAllowed(e: Env = env()) {
	return e.GOOGLE_OAUTH_MOCK === '1' && (e.NODE_ENV === 'development' || e.NODE_ENV === 'test');
}

export function googleConfigured(e: Env = env()) {
	return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.AUTH_SECRET);
}

export function r2Configured(e: Env = env()) {
	return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET);
}

export function adminEmails(e: Env = env()) {
	return (e.ADMIN_EMAILS ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}
