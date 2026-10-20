// Web Push without a dependency: RFC 8291 message encryption (aes128gcm, RFC 8188) and RFC 8292 VAPID,
// all on Web Crypto. Pure: keys come in as arguments (unit-tested against the RFC 8291 Appendix A vector).

const enc = new TextEncoder();

export const b64u = {
	encode(bytes: Uint8Array | ArrayBuffer): string {
		return Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString('base64url');
	},
	decode(s: string): Uint8Array<ArrayBuffer> {
		return new Uint8Array(Buffer.from(s, 'base64url'));
	}
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let o = 0;
	for (const p of parts) out.set(p, (o += p.length) - p.length);
	return out;
};

/** P-256 key from a base64url uncompressed public point (65 bytes) and optional private scalar. */
function jwk(publicKey: string, privateKey?: string): JsonWebKey {
	const pub = b64u.decode(publicKey);
	if (pub.length !== 65 || pub[0] !== 4) throw new Error('Push key must be an uncompressed P-256 point.');
	return {
		kty: 'EC',
		crv: 'P-256',
		x: b64u.encode(pub.slice(1, 33)),
		y: b64u.encode(pub.slice(33)),
		...(privateKey ? { d: privateKey } : {}),
		ext: true
	};
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number) {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

export type Sender = { publicKey: string; privateKey: string };

/**
 * Encrypts one push message (single aes128gcm record). `sender` (ephemeral ECDH pair) and `salt`
 * are random per message; they are parameters only so the RFC test vector can pin them.
 */
export async function encrypt(
	plaintext: Uint8Array,
	sub: { p256dh: string; auth: string },
	opts: { sender?: Sender; salt?: Uint8Array<ArrayBuffer> } = {}
): Promise<Uint8Array<ArrayBuffer>> {
	const uaPublic = b64u.decode(sub.p256dh);
	const authSecret = b64u.decode(sub.auth);
	const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));

	let asPrivate: CryptoKey;
	let asPublic: Uint8Array<ArrayBuffer>;
	if (opts.sender) {
		asPrivate = await crypto.subtle.importKey('jwk', jwk(opts.sender.publicKey, opts.sender.privateKey), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
		asPublic = b64u.decode(opts.sender.publicKey);
	} else {
		const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
		asPrivate = pair.privateKey;
		asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	}
	const uaKey = await crypto.subtle.importKey('jwk', jwk(sub.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

	const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
	const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	const padded = concat(plaintext, new Uint8Array([2])); // 0x02: last (only) record, no padding
	const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, padded));

	const header = new Uint8Array(16 + 4 + 1);
	header.set(salt);
	new DataView(header.buffer).setUint32(16, 4096); // record size
	header[20] = asPublic.length;
	return concat(header, asPublic, cipher);
}

/** `Authorization` header value for RFC 8292 VAPID (ES256 JWT, valid 12 h). */
export async function vapidAuth(endpoint: string, vapid: { publicKey: string; privateKey: string; subject: string }, now = Date.now()) {
	const key = await crypto.subtle.importKey('jwk', jwk(vapid.publicKey, vapid.privateKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
	const part = (o: object) => b64u.encode(enc.encode(JSON.stringify(o)));
	const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })}`;
	// Web Crypto emits raw r||s (IEEE P1363), which is exactly the JWS ES256 format.
	const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
	return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${vapid.publicKey}`;
}

/** A fresh VAPID key pair as base64url (public: uncompressed point, private: scalar d). */
export async function generateVapidKeys() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair;
	const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	const priv = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;
	return { publicKey: b64u.encode(pub), privateKey: priv };
}
