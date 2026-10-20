// PDF text layer via unpdf (pdf.js serverless build, no native deps, runs under Bun).
import { extractText, getDocumentProxy } from 'unpdf';
import { pdfText } from './input';

export type PdfInfo = {
	pages: number;
	/** Clean text when the PDF has a real text layer; null for scans (send the pages instead). */
	text: string | null;
};

/** Reads a PDF once (optionally only pages from..to, 1-based). Broken / encrypted PDFs come back as a 0-page scan. */
export async function readPdf(bytes: Uint8Array, range: { from?: number; to?: number } = {}): Promise<PdfInfo> {
	try {
		// pdf.js may detach the buffer it is given: hand it a copy
		const doc = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
		try {
			const { totalPages, text } = await extractText(doc, { mergePages: false });
			return { pages: totalPages, text: pdfText(text.slice((range.from ?? 1) - 1, range.to ?? totalPages)) };
		} finally {
			// free pdf.js page caches (the method is missing on some builds)
			await (doc as { destroy?: () => Promise<void> }).destroy?.().catch(() => {});
		}
	} catch {
		return { pages: 0, text: null };
	}
}
