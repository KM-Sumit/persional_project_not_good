// Private Cloudflare R2 bucket over its S3 API, signed with aws4fetch (no AWS SDK).
import { AwsClient } from 'aws4fetch';
import { env, r2Enabled } from '#lib/server/env';
import { DomainError } from '#lib/server/http';

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

/** Signed GET URLs live this long; /api/files/[id] mints a fresh one per request. */
export const SIGNED_TTL_SEC = 300;

function config(): R2Config {
	if (!r2Enabled()) throw new DomainError(503, 'Storage is not configured');
	const e = env();
	return { accountId: e.R2_ACCOUNT_ID!, accessKeyId: e.R2_ACCESS_KEY_ID!, secretAccessKey: e.R2_SECRET_ACCESS_KEY!, bucket: e.R2_BUCKET! };
}

const clients = new Map<string, AwsClient>();
const client = (c: R2Config) => {
	let a = clients.get(c.accessKeyId);
	if (!a) clients.set(c.accessKeyId, (a = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: 's3', region: 'auto' })));
	return a;
};

const objectUrl = (c: R2Config, key: string) =>
	`https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Presigned GET (query-string SigV4). Pure apart from the clock; exported for tests. */
export async function presign(c: R2Config, key: string, ttlSec = SIGNED_TTL_SEC): Promise<string> {
	const req = await client(c).sign(`${objectUrl(c, key)}?X-Amz-Expires=${ttlSec}`, { method: 'GET', aws: { signQuery: true } });
	return req.url;
}

async function ok(res: Response, what: string) {
	if (!res.ok) throw new Error(`R2 ${what} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function putObject(key: string, body: ArrayBuffer | string, contentType: string, c = config()) {
	await ok(await client(c).fetch(objectUrl(c, key), { method: 'PUT', body, headers: { 'content-type': contentType } }), 'put');
}

export const signedGetUrl = (key: string, ttlSec = SIGNED_TTL_SEC, c = config()) => presign(c, key, ttlSec);

export async function deleteObject(key: string, c = config()) {
	const res = await client(c).fetch(objectUrl(c, key), { method: 'DELETE' });
	if (res.status !== 404) await ok(res, 'delete');
}
