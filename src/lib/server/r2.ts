import { AwsClient } from 'aws4fetch';
import { env, r2Configured } from './env';

export class StorageError extends Error {
	constructor(message = 'File storage is not configured.') {
		super(message);
	}
}

function client() {
	if (!r2Configured()) throw new StorageError();
	const current = env();
	return {
		aws: new AwsClient({
			accessKeyId: current.R2_ACCESS_KEY_ID!,
			secretAccessKey: current.R2_SECRET_ACCESS_KEY!,
			service: 's3',
			region: 'auto'
		}),
		bucket: current.R2_BUCKET!,
		account: current.R2_ACCOUNT_ID!
	};
}

function objectUrl(account: string, bucket: string, key: string) {
	const path = key.split('/').map(encodeURIComponent).join('/');
	return new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${path}`);
}

async function presign(method: 'GET' | 'PUT', key: string, expiresSec: number, contentType?: string) {
	const { aws, bucket, account } = client();
	const url = objectUrl(account, bucket, key);
	url.searchParams.set('X-Amz-Expires', String(expiresSec));
	const headers = contentType ? { 'content-type': contentType } : undefined;
	const signed = await aws.sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
	return signed.url;
}

export const presignGet = (key: string, expiresSec = 300) => presign('GET', key, expiresSec);

export const presignPut = (key: string, contentType: string, expiresSec = 120) =>
	presign('PUT', key, expiresSec, contentType);
