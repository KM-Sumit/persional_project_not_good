// Live R2 round-trip against the real bucket. Run: R2_LIVE=1 bun test src/lib/features/files/r2.live.test.ts
import { expect, test } from 'bun:test';
import { deleteObject, putObject, signedGetUrl } from './server/r2';

test.skipIf(process.env.R2_LIVE !== '1')('R2 put -> signed get -> delete', async () => {
	const key = `test/${crypto.randomUUID()}.txt`;
	const text = `uci r2 round-trip ${Date.now()}`;
	await putObject(key, text, 'text/plain');
	try {
		const res = await fetch(await signedGetUrl(key, 60));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(text);
	} finally {
		await deleteObject(key);
	}
	expect((await fetch(await signedGetUrl(key, 60))).status).toBe(404);
}, 30_000);
