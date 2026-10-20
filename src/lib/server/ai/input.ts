// Keeps what we send to the model small: clean + dedupe + budget text, size images to what the model actually uses,
// and estimate input tokens so the savings are measurable. Pure functions only (no I/O), so they are unit-tested.
//
// Numbers (checked 2026-10):
// - OpenAI gpt-5.4+ / gpt-6 vision is patch based: ceil(w/32) * ceil(h/32) patches * 1.2 tokens. detail "high" caps an
//   image at 2,500 patches (~3,000 tokens); on gpt-5.5+ "auto" (the default) means "original": full size, up to
//   30,000 patches. So we always send "high" and pre-shrink photos on the phone.
// - Native PDF input sends the extracted text AND an image of every page, so a text PDF costs text + ~3k tokens/page.
//   We extract the text layer ourselves and send only that; real scans still go as PDF (pages are the content).
// - ~4 characters per token for English prose is the usual rule of thumb.

/** Long side the wizard shrinks photos to: 42 x 32px patches. Handwriting on an A4 page stays legible (~120 dpi). */
export const PHOTO_MAX_SIDE = 1344;
/** Total pasted + extracted text sent per draft (~30k tokens). Plenty for 20 questions; beyond it we sample. */
export const TEXT_BUDGET_CHARS = 120_000;
/** Most page-images (photos + scanned PDF pages) sent in one draft. */
export const VISUAL_BUDGET = 40;
/** Scanned PDFs over this many pages are refused at upload (we can't send part of a scan). */
export const MAX_SCANNED_PAGES = 20;

const CHARS_PER_TOKEN = 4;
const PATCH = 32;
const PATCH_MULT = 1.2;
// gpt-6 limits (the default AI_MODEL is gpt-6-luna): "high" = 2,500 patches; "original" keeps the size (65,535px side).
const HIGH_MAX_PATCHES = 2500;
const ORIGINAL_MAX_PATCHES = 30_000;
const MAX_SIDE = 65_535;

export const textTokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);

/** Billable tokens for one image on patch-based OpenAI models (gpt-6; gpt-5.x is the same or a little lower). */
export function imageTokens(width: number, height: number, detail: 'high' | 'auto' = 'high'): number {
	const maxPatches = detail === 'high' ? HIGH_MAX_PATCHES : ORIGINAL_MAX_PATCHES;
	let k = Math.min(1, MAX_SIDE / Math.max(width, height));
	let w = width * k;
	let h = height * k;
	let patches = Math.ceil(w / PATCH) * Math.ceil(h / PATCH);
	if (patches > maxPatches) {
		k = Math.sqrt(maxPatches / patches);
		w *= k;
		h *= k;
		patches = Math.min(maxPatches, Math.ceil(w / PATCH) * Math.ceil(h / PATCH));
	}
	return Math.ceil(patches * PATCH_MULT);
}

/** Size a phone photo ends up at after the wizard's shrink step. */
export function shrunkSize(width: number, height: number, maxSide = PHOTO_MAX_SIDE) {
	const k = Math.min(1, maxSide / Math.max(width, height));
	return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** What one request part costs. `pdf` = native PDF input (text layer + one image per page). */
export type InputItem =
	| { kind: 'text'; chars: number }
	| { kind: 'image'; width: number; height: number; detail?: 'high' | 'auto' }
	| { kind: 'pdf'; pages: number; textChars: number; pageWidth?: number; pageHeight?: number };

/** Estimated input tokens for a set of request parts (the measuring stick for this module). */
export function estimateInputTokens(items: InputItem[]): number {
	let t = 0;
	for (const i of items) {
		if (i.kind === 'text') t += textTokens(i.chars);
		else if (i.kind === 'image') t += imageTokens(i.width, i.height, i.detail ?? 'high');
		// page images are rendered at high detail (A4 at ~150dpi is 1240x1754 -> capped at 2,500 patches)
		else t += textTokens(i.textChars) + i.pages * imageTokens(i.pageWidth ?? 1240, i.pageHeight ?? 1754, 'high');
	}
	return t;
}

// ---------- images ----------

/** Pixel size from the file header (PNG, JPEG, WebP), or null. Cheap: no decoding. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
	const u16 = (i: number) => (b[i] << 8) | b[i + 1];
	const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
	if (b[0] === 0x89 && b[1] === 0x50 && b.length >= 24) return { width: u32(16), height: u32(20) };
	if (b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) return null;
			const m = b[i + 1];
			// SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
			if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: u16(i + 5), width: u16(i + 7) };
			i += 2 + u16(i + 2);
		}
		return null;
	}
	if (String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
		const fmt = String.fromCharCode(...b.slice(12, 16));
		if (fmt === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
		if (fmt === 'VP8 ') return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
		if (fmt === 'VP8L') {
			const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
			return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
		}
	}
	return null;
}

// ---------- text ----------

/** Tidies extracted / pasted text: unify line ends, squeeze spaces and blank lines. */
export function cleanText(s: string): string {
	return s
		.replace(/\r\n?/g, '\n')
		.replace(/[\u00a0\t\f\v ]+/g, ' ')
		.replace(/ {2,}/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

const PAGE_NO = /^(page|pg\.?|p\.)?\s*\d+\s*((of|\/)\s*\d+)?$/i;

/** Drops page numbers and running headers/footers (the same short line on at least half the pages, 3+ pages). */
export function stripRepeatedLines(pages: string[]): string[] {
	const key = (l: string) => l.trim().toLowerCase();
	const seen = new Map<string, number>();
	for (const p of pages) for (const k of new Set(p.split('\n').map(key))) if (k && k.length <= 80) seen.set(k, (seen.get(k) ?? 0) + 1);
	const min = pages.length < 3 ? Infinity : Math.max(3, Math.ceil(pages.length / 2));
	return pages.map((p) =>
		p
			.split('\n')
			.filter((l) => !PAGE_NO.test(l.trim()) && (seen.get(key(l)) ?? 0) < min)
			.join('\n')
	);
}

/** Text PDF -> one clean string. Pages under ~40 chars count as picture pages. Null when it's really a scan. */
export function pdfText(pageTexts: string[]): string | null {
	const pages = stripRepeatedLines(pageTexts.map(cleanText));
	const texty = pages.filter((p) => p.replace(/\s/g, '').length >= 40).length;
	const chars = pages.reduce((n, p) => n + p.length, 0);
	// mostly real text (some diagram pages are fine): send text. Otherwise the pages ARE the content.
	if (!pages.length || texty / pages.length < 0.6 || chars / pages.length < 150) return null;
	return pages
		.map((p) => p.trim())
		.filter(Boolean)
		.join('\n\n');
}

/** Picks k items spread evenly across the list (keeps first and last). */
export function spread<T>(items: T[], k: number): T[] {
	if (items.length <= k) return items;
	if (k <= 1) return items.slice(0, k);
	return Array.from({ length: k }, (_, i) => items[Math.round((i * (items.length - 1)) / (k - 1))]);
}

const BLOCK = 1500;
const GAP = '\n[...]\n';

/** Shortens text to maxChars keeping the beginning (often the summary / definitions) plus evenly spread blocks. */
export function fitText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	if (maxChars < BLOCK * 2) return text.slice(0, maxChars);
	// paragraph-aligned blocks of about BLOCK chars
	const blocks: string[] = [];
	let cur = '';
	for (const para of text.split(/\n\n+/)) {
		for (let i = 0; i < para.length; i += BLOCK * 2) {
			const piece = para.slice(i, i + BLOCK * 2);
			if (cur && cur.length + piece.length > BLOCK) {
				blocks.push(cur);
				cur = '';
			}
			cur = cur ? `${cur}\n\n${piece}` : piece;
		}
	}
	if (cur) blocks.push(cur);
	const avg = text.length / blocks.length;
	const k = Math.max(2, Math.floor(maxChars / (avg + GAP.length)));
	const head = Math.max(1, Math.round(k * 0.25));
	const picked = [...blocks.slice(0, head), ...spread(blocks.slice(head), k - head)];
	let out = '';
	for (const b of picked) {
		const next = out ? out + GAP + b : b;
		if (next.length > maxChars) break;
		out = next;
	}
	return out || text.slice(0, maxChars);
}

/**
 * Cleans, dedupes (identical sources and repeated paragraphs) and fits several texts into one budget.
 * Short texts are kept whole; the budget left over is shared evenly by the long ones.
 */
export function budgetTexts(texts: string[], maxChars = TEXT_BUDGET_CHARS): string[] {
	const seen = new Set<string>();
	const cleaned = texts
		.map((t) =>
			cleanText(t)
				.split(/\n\n+/)
				.filter((p) => {
					if (p.length < 40) return true; // short lines (headings, "Q1") repeat legitimately
					const k = p.toLowerCase().replace(/\W+/g, ' ').trim();
					return !seen.has(k) && !!seen.add(k);
				})
				.join('\n\n')
				.trim()
		)
		.filter(Boolean);
	const order = cleaned.map((t, i) => [t.length, i] as const).sort((a, b) => a[0] - b[0]);
	const out = [...cleaned];
	let left = maxChars;
	order.forEach(([len, i], n) => {
		const share = Math.floor(left / (order.length - n));
		out[i] = len <= share ? cleaned[i] : fitText(cleaned[i], share);
		left -= out[i].length;
	});
	return out;
}
