import { expect, test } from 'bun:test';
import { b64u, encrypt, generateVapidKeys, vapidAuth } from './webpush';

// RFC 8291 Appendix A.
const A = {
	plaintext: 'When I grow up, I want to be a watermelon',
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
	uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	auth: 'BTBZMqHH6r4Tts7J_aSIgg',
	body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};

test('RFC 8291 known-answer vector', async () => {
	const out = await encrypt(new TextEncoder().encode(A.plaintext), { p256dh: A.uaPublic, auth: A.auth }, {
		sender: { publicKey: A.asPublic, privateKey: A.asPrivate },
		salt: b64u.decode(A.salt)
	});
	expect(b64u.encode(out)).toBe(A.body);
});

test('random sender + salt: header layout and length', async () => {
	const out = await encrypt(new Uint8Array(10), { p256dh: A.uaPublic, auth: A.auth });
	expect(out.length).toBe(16 + 4 + 1 + 65 + 10 + 1 + 16);
	expect(new DataView(out.buffer).getUint32(16)).toBe(4096);
	expect(out[20]).toBe(65);
});

test('VAPID JWT verifies with the public key', async () => {
	const keys = await generateVapidKeys();
	const h = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', { ...keys, subject: 'mailto:a@b.c' }, 0);
	const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)!;
	expect(m[4]).toBe(keys.publicKey);
	expect(JSON.parse(Buffer.from(m[2]!, 'base64url').toString())).toEqual({ aud: 'https://fcm.googleapis.com', exp: 43200, sub: 'mailto:a@b.c' });
	const pub = await crypto.subtle.importKey('raw', b64u.decode(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
	const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.decode(m[3]!), new TextEncoder().encode(`${m[1]}.${m[2]}`));
	expect(ok).toBe(true);
});
