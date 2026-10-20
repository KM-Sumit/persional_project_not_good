// UI gate: screenshots pages at phone / tablet / desktop (light, plus dark with --dark) and fails on
// horizontal overflow, console errors, error pages or hydration warnings.
// Usage: bun scripts/shots.ts --as admin@uci.test /admin /admin/tests [--base http://127.0.0.1:5174] [--out dir] [--dark]
// --as signs in through the dev mock (GOOGLE_OAUTH_MOCK=1). Students need onboarding done: use --as student@uci.test.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => {
	const i = args.indexOf(k);
	if (i < 0) return d;
	const v = args[i + 1];
	args.splice(i, 2);
	return v;
};
const flag = (k: string) => {
	const i = args.indexOf(k);
	if (i >= 0) args.splice(i, 1);
	return i >= 0;
};
const base = opt('--base', 'http://127.0.0.1:5174');
const out = opt('--out', 'shots');
const as = opt('--as', '');
const dark = flag('--dark');
const paths = args.length ? args : ['/'];
mkdirSync(out, { recursive: true });

const sizes = [
	{ name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
	{ name: 'tablet', width: 820, height: 1180, isMobile: true, hasTouch: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 Chrome/130 Safari/537.36' },
	{ name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, ua: undefined }
];

const browser = await chromium.launch();
let failed = 0;
for (const s of sizes) {
	const ctx = await browser.newContext({
		viewport: { width: s.width, height: s.height },
		isMobile: s.isMobile,
		hasTouch: s.hasTouch,
		userAgent: s.ua,
		colorScheme: dark ? 'dark' : 'light',
		deviceScaleFactor: 1
	});
	const page = await ctx.newPage();
	const errors: string[] = [];
	page.on('console', (m) => {
		if ((m.type() === 'error' && !/Permissions policy violation/.test(m.text())) || /hydration/i.test(m.text())) errors.push(m.text().slice(0, 200));
	});
	page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
	if (as) await page.goto(`${base}/auth/google?mock=${encodeURIComponent(as)}`);
	for (const p of paths) {
		errors.length = 0;
		const res = await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => null);
		await page.waitForTimeout(350);
		const file = `${out}/${(p.replace(/[/?=&]+/g, '_').replace(/^_|_$/g, '') || 'home')}-${s.name}${dark ? '-dark' : ''}.png`;
		await page.screenshot({ path: file, fullPage: true });
		// html has overflow-x: clip, so scrollWidth hides overflow: measure elements that poke past the viewport
		// instead, ignoring ones inside their own horizontal scroller (chip rows, tables) or off-canvas/fixed UI.
		const overflow = await page.evaluate(() => {
			const W = innerWidth;
			let worst = Math.max(0, document.documentElement.scrollWidth - W);
			const clipped = (el: Element) => {
				for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
					const ox = getComputedStyle(a).overflowX;
					if (ox !== 'visible') return true;
					if (getComputedStyle(a).position === 'fixed') return true;
				}
				return false;
			};
			for (const el of document.body.querySelectorAll('*')) {
				const r = el.getBoundingClientRect();
				if (!r.width || r.right <= W + 1) continue;
				const cs = getComputedStyle(el);
				if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
				if (clipped(el)) continue;
				worst = Math.max(worst, Math.round(r.right - W));
			}
			return worst;
		});
		const status = res?.status() ?? 200; // null = same-document navigation
		const bad = overflow > 0 || status >= 400 || errors.length > 0;
		if (bad) failed++;
		console.log(
			`${bad ? 'FAIL' : 'ok  '} ${s.name.padEnd(7)} ${p} -> ${new URL(page.url()).pathname} [${status}]` +
				(overflow > 0 ? ` overflowX=${overflow}px` : '') +
				(errors.length ? ` errors=${JSON.stringify(errors)}` : '') +
				` ${file}`
		);
	}
	await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
