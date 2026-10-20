// Generates a VAPID key pair for Web Push and appends it to .env (never prints the private key).
// Usage: bun scripts/vapid.ts [mailto:you@example.com] [--env path]. Refuses if .env already has VAPID keys
// (rotating keys invalidates every existing subscription).
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { generateVapidKeys } from '../src/lib/features/push/server/webpush';

const args = process.argv.slice(2);
const i = args.indexOf('--env');
const file = i >= 0 ? args.splice(i, 2)[1]! : '.env';
const subject = args[0] ?? 'mailto:admin@uci.test';
if (!/^(mailto:|https:)/.test(subject)) throw new Error('Subject must be mailto:... or https://...');

const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
if (/^VAPID_PRIVATE_KEY=./m.test(current)) {
	console.log(`${file} already has VAPID keys; left unchanged.`);
	process.exit(0);
}
const k = await generateVapidKeys();
const nl = current && !current.endsWith('\n') ? '\n' : '';
appendFileSync(file, `${nl}# Web Push (VAPID). Rotating these drops every push subscription.\nVAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=${subject}\n`);
console.log(`Wrote VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to ${file}. Public key: ${k.publicKey}`);
