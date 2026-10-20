import { z } from 'zod';

/** Empty env values ("FOO=" in .env) count as unset. */
const blank = (v: unknown) => (v === '' ? undefined : v);
const optionalUrl = () => z.preprocess(blank, z.url().optional());
const optionalStr = () => z.preprocess(blank, z.string().optional());

const schema = z
	.object({
		DATABASE_URL: z.url(),
		MIGRATION_DATABASE_URL: optionalUrl(), // direct Postgres (skips PgBouncer); defaults to DATABASE_URL
		REDIS_URL: optionalUrl(), // optional: without it, cache and rate limits stay in-process
		AUTH_SECRET: z.string().min(32), // HS256 key for the session JWT and OAuth state cookie
		// Public origin (https://uci.divyanshshukla.com). The Google redirect URI is built from it,
		// never from the request's Host header.
		ORIGIN: optionalUrl(),
		GOOGLE_CLIENT_ID: optionalStr(),
		GOOGLE_CLIENT_SECRET: optionalStr(),
		GOOGLE_REDIRECT_URI: optionalUrl(), // default ${ORIGIN}/auth/google/callback
		GOOGLE_OAUTH_MOCK: optionalStr(), // "1" in dev/tests: /auth/google signs in a fake account
		ADMIN_EMAILS: optionalStr(), // comma-separated; these Google accounts become admins on sign-in
		GEMINI_API_KEY: optionalStr(), // primary AI provider
		GEMINI_MODEL: z.string().default('gemini-3-flash-preview'),
		OPENROUTER_API_KEY: optionalStr(), // fallback when Gemini fails
		OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),
		AI_MAX_QUESTIONS: z.coerce.number().int().positive().default(30),
		R2_ACCOUNT_ID: optionalStr(), // uploads refuse with "storage not configured" unless all four are set
		R2_ACCESS_KEY_ID: optionalStr(),
		R2_SECRET_ACCESS_KEY: optionalStr(),
		R2_BUCKET: optionalStr(),
		VAPID_PUBLIC_KEY: optionalStr(), // Web Push (scripts/vapid.ts generates them)
		VAPID_PRIVATE_KEY: optionalStr(),
		VAPID_SUBJECT: optionalStr(),
		RAZORPAY_KEY_ID: optionalStr(), // checkout off unless all three are set
		RAZORPAY_KEY_SECRET: optionalStr(),
		RAZORPAY_WEBHOOK_SECRET: optionalStr(),
		NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
	})
	.refine((e) => e.NODE_ENV !== 'production' || Boolean(e.ORIGIN), {
		message: 'ORIGIN is required in production (e.g. https://uci.divyanshshukla.com)',
		path: ['ORIGIN']
	});

let parsed: z.infer<typeof schema> | undefined;

/** Validates an env object (exported for tests). Throws on bad config so production fails fast. */
export const parseEnv = (src: Record<string, string | undefined>) => schema.parse(src);

/** Parsed on first use (not at import) so `vite build` works without env configured. */
export const env = () => (parsed ??= parseEnv(process.env));
export type Env = z.infer<typeof schema>;

export const adminEmails = () =>
	new Set(
		(process.env.ADMIN_EMAILS ?? '') // read live, not from the parsed snapshot, so tests can set it
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
	);
export const googleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
export const googleMock = () => env().NODE_ENV !== 'production' && env().GOOGLE_OAUTH_MOCK === '1';
export const r2Enabled = () => {
	const e = env();
	return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET);
};
export const razorpayEnabled = () => {
	const e = env();
	return Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET && e.RAZORPAY_WEBHOOK_SECRET);
};
