import { describe, expect, test } from 'bun:test';
import {
	budgetTexts,
	cleanText,
	estimateInputTokens,
	fitText,
	imageSize,
	imageTokens,
	pdfText,
	shrunkSize,
	spread,
	stripRepeatedLines,
	TEXT_BUDGET_CHARS,
	type InputItem
} from './input';
import { makePdf } from './make-pdf';
import { readPdf } from './pdf';

const sentence = (p: number, l: number) => `Page ${p} line ${l}: Ohm law states that current through a conductor is proportional to voltage at constant temperature`;
const textPage = (p: number) => ['Physics Notes - Chapter 3', ...Array.from({ length: 40 }, (_, l) => sentence(p, l)), `Page ${p} of 30`];

describe('image tokens', () => {
	test('patch maths matches the OpenAI examples', () => {
		expect(imageTokens(1024, 1024)).toBe(1229);
		expect(imageTokens(2048, 2048)).toBe(3000); // capped at 2,500 patches
		expect(imageTokens(4096, 512)).toBe(2458); // gpt-6 high has no 2048px side cap
	});
	test('a 12 MP phone photo: raw "auto" vs high vs shrunk', () => {
		const raw = imageTokens(4032, 3024, 'auto');
		const s = shrunkSize(4032, 3024);
		expect(s).toEqual({ width: 1344, height: 1008 });
		expect(raw).toBeGreaterThan(11_000);
		expect(imageTokens(4032, 3024, 'high')).toBe(3000);
		expect(imageTokens(s.width, s.height)).toBe(1613);
	});
	test('reads sizes from PNG / JPEG headers', () => {
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47], 0);
		png.set([0, 0, 5, 0, 0, 0, 3, 0], 16);
		expect(imageSize(png)).toEqual({ width: 1280, height: 768 });
		const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x03, 0xf0, 0x05, 0x40, 3, 0, 0, 0]);
		expect(imageSize(jpg)).toEqual({ width: 1344, height: 1008 });
	});
});

describe('text', () => {
	test('cleanText squeezes whitespace', () => {
		expect(cleanText('a\r\n\r\n\r\n\r\nb   c \t d e  \n  f')).toBe('a\n\nb c d e\nf');
	});
	test('running headers, footers and page numbers are dropped', () => {
		const pages = stripRepeatedLines([1, 2, 3, 4].map((p) => `Chapter 3\nreal content ${p}\nPage ${p} of 4`));
		expect(pages).toEqual(['real content 1', 'real content 2', 'real content 3', 'real content 4']);
	});
	test('pdfText: text PDF gives text, scan gives null', () => {
		expect(pdfText(Array.from({ length: 5 }, (_, p) => textPage(p).join('\n')))).toContain('Ohm law');
		expect(pdfText(['', '', '  ', ''])).toBeNull();
		expect(pdfText(['Scanned by CamScanner', 'Scanned by CamScanner'])).toBeNull();
	});
	test('fitText keeps the start and samples the rest within budget', () => {
		const text = Array.from({ length: 200 }, (_, i) => `Paragraph ${i}. ${'x'.repeat(400)}`).join('\n\n');
		const out = fitText(text, 20_000);
		expect(out.length).toBeLessThanOrEqual(20_000);
		expect(out.startsWith('Paragraph 0.')).toBe(true);
		expect(out).toContain('Paragraph 199.');
		expect(out).toContain('[...]');
	});
	test('budgetTexts dedupes repeats and shares the budget', () => {
		const para = 'Newton second law: force equals mass times acceleration, measured in newtons.';
		const [a, b, c] = budgetTexts([para, `${para}\n\nOnly in b, a long enough paragraph to count as content.`, 'y'.repeat(50_000)], 10_000);
		expect(a).toBe(para);
		expect(b).toBe('Only in b, a long enough paragraph to count as content.');
		expect(c.length).toBeLessThanOrEqual(10_000 - a.length - b.length);
	});
	test('spread keeps first and last', () => {
		expect(spread([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 5, 9]);
	});
});

describe('pdf', () => {
	test('readPdf extracts the text layer and spots scans', async () => {
		const text = await readPdf(makePdf([1, 2, 3].map(textPage)));
		expect(text.pages).toBe(3);
		expect(text.text).toContain('Page 2 line 5: Ohm law');
		expect(text.text).not.toContain('Physics Notes - Chapter 3'); // header on every page
		const scan = await readPdf(makePdf([[], [], []]));
		expect(scan).toEqual({ pages: 3, text: null });
		expect(await readPdf(new TextEncoder().encode('%PDF-1.4 junk'))).toEqual({ pages: 0, text: null });
	});
});

// The measurement asked for: 5 phone photos + a 30-page text PDF + a short pasted note, before vs after this change.
test('estimate: 5 phone photos + 30-page text PDF', async () => {
	const pdf = makePdf(Array.from({ length: 30 }, (_, p) => textPage(p + 1)));
	const info = await readPdf(pdf);
	const rawPdfChars = Array.from({ length: 30 }, (_, p) => textPage(p + 1).join('\n')).join('\n').length;
	const note = 'Revise Ohm law, series and parallel resistors, power P = VI.';
	// Before: photos shrunk to 1600px but sent with no detail (gpt-6 "auto" = original); PDF sent natively (text + every page as an image).
	const before: InputItem[] = [
		...Array.from({ length: 5 }, () => ({ kind: 'image' as const, width: 1600, height: 1200, detail: 'auto' as const })),
		{ kind: 'pdf', pages: 30, textChars: rawPdfChars },
		{ kind: 'text', chars: note.length }
	];
	// After: photos 1344px at detail high; PDF as its cleaned text layer, inside the text budget.
	const texts = budgetTexts([note, info.text!]);
	const s = shrunkSize(4032, 3024);
	const after: InputItem[] = [...Array.from({ length: 5 }, () => ({ kind: 'image' as const, ...s })), ...texts.map((t) => ({ kind: 'text' as const, chars: t.length }))];
	const b = estimateInputTokens(before);
	const a = estimateInputTokens(after);
	console.log(`input tokens before ~${b}, after ~${a} (${Math.round((1 - a / b) * 100)}% less)`);
	expect(texts.join('').length).toBeLessThanOrEqual(TEXT_BUDGET_CHARS);
	expect(a).toBeLessThan(b * 0.35);

	// HEIC straight off an iPhone (4032x3024), which used to go up untouched:
	expect(estimateInputTokens([{ kind: 'image', width: 4032, height: 3024, detail: 'auto' }])).toBeGreaterThan(7 * imageTokens(s.width, s.height));
});
