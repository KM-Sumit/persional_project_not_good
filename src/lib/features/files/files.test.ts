import { expect, test } from 'bun:test';
import { checkUpload, sniffMime } from './schema';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { files, toppers } from '#lib/server/db/schema';
import { presign } from './server/r2';
import { isPublic } from './server/service';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webp = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0))));
const pdf = new TextEncoder().encode('%PDF-1.7');
const MB = 1024 * 1024;

test('sniffs real types from magic bytes', () => {
	expect(sniffMime(png)).toBe('image/png');
	expect(sniffMime(jpeg)).toBe('image/jpeg');
	expect(sniffMime(webp)).toBe('image/webp');
	expect(sniffMime(pdf)).toBe('application/pdf');
	expect(sniffMime(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
	expect(sniffMime(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe('video/mp4');
	expect(sniffMime(new TextEncoder().encode('<svg'))).toBeNull();
});

test('enforces kind, size and type limits', () => {
	expect(checkUpload('image', 1000, png)).toEqual({ mime: 'image/png', ext: 'png' });
	expect(checkUpload('image', 15 * MB, jpeg)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
	expect(checkUpload('image', 15 * MB + 1, jpeg)).toHaveProperty('error');
	expect(checkUpload('image', 1000, pdf)).toEqual({ error: 'Use a JPEG, PNG, WebP or GIF photo.' });
	expect(checkUpload('pdf', 40 * MB, pdf)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
	expect(checkUpload('pdf', 40 * MB + 1, pdf)).toHaveProperty('error');
	expect(checkUpload('pdf', 1000, png)).toEqual({ error: 'Use a PDF file.' });
	expect(checkUpload('pdf', 0, pdf)).toEqual({ error: 'The file is empty.' });
});

test('presigned GET URL is query-signed SigV4 for the bucket path', async () => {
	const cfg = { accountId: 'acc123', accessKeyId: 'AKIDTEST', secretAccessKey: 'secret', bucket: 'uci' };
	const u = new URL(await presign(cfg, 'image/2026-10/a b.png', 120));
	expect(u.origin).toBe('https://acc123.r2.cloudflarestorage.com');
	expect(u.pathname).toBe('/uci/image/2026-10/a%20b.png');
	expect(u.searchParams.get('X-Amz-Expires')).toBe('120');
	expect(u.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
	expect(u.searchParams.get('X-Amz-Credential')).toMatch(/^AKIDTEST\/\d{8}\/auto\/s3\/aws4_request$/);
	expect(u.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
});

test('a file is public only while a public-site record uses it', async () => {
	const id = crypto.randomUUID();
	await db().insert(files).values({ id, key: `test/${id}.png`, name: 'x.png', mime: 'image/png', size: 1 });
	try {
		expect(await isPublic(id)).toBe(false);
		const [t] = await db().insert(toppers).values({ name: 'T', exam: 'E', result: 'R', photoFileId: id }).returning();
		expect(await isPublic(id)).toBe(true);
		await db().delete(toppers).where(eq(toppers.id, t.id));
	} finally {
		await db().delete(files).where(eq(files.id, id));
	}
});
