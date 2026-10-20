// Test helper: builds tiny real PDFs (no fixtures in the repo).
/** Minimal valid PDF: one page per entry, each line drawn with Helvetica (empty array = a page with no text, like a scan). */
export function makePdf(pages: string[][]): Uint8Array<ArrayBuffer> {
	const objs: string[] = [];
	const kids: number[] = [];
	const font = 3;
	objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
	objs[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
	let n = 4;
	for (const lines of pages) {
		const body = lines.length ? `BT /F1 10 Tf 12 TL 40 800 Td ${lines.map((l) => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join(' ')} ET` : '';
		objs[n] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
		objs[n + 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${n} 0 R >>`;
		kids.push(n + 1);
		n += 2;
	}
	objs[2] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
	let out = '%PDF-1.4\n';
	const offsets: number[] = [];
	for (let i = 1; i < objs.length; i++) {
		offsets[i] = out.length;
		out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
	}
	const xref = out.length;
	out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
	out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return new TextEncoder().encode(out);
}
