// Upload rules (client-safe): the form can show the same limits the server enforces.
export type FileKind = 'image' | 'pdf';
export type FileDto = { id: string; name: string; url: string };

const MB = 1024 * 1024;
export const UPLOAD_RULES: Record<FileKind, { maxBytes: number; mimes: Record<string, string> }> = {
	image: { maxBytes: 5 * MB, mimes: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } },
	pdf: { maxBytes: 40 * MB, mimes: { 'application/pdf': 'pdf' } }
};

/** Stable app URL for a stored file; it redirects to a short-lived signed R2 URL. */
export const fileUrl = (id: string) => `/api/files/${id}`;

/** Detects the real type from magic bytes so a renamed file can't pass as an image or PDF. */
export function sniffMime(head: Uint8Array): string | null {
	const at = (i: number, ...b: number[]) => b.every((v, j) => head[i + j] === v);
	if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
	if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	if (at(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
	return null;
}

/** Validates size and real type; returns the stored mime + extension or a user-facing error. */
export function checkUpload(kind: FileKind, size: number, head: Uint8Array): { error: string } | { mime: string; ext: string } {
	const rule = UPLOAD_RULES[kind];
	if (!rule) return { error: 'Unknown file kind.' };
	if (size <= 0) return { error: 'The file is empty.' };
	if (size > rule.maxBytes) return { error: `The file is too large (max ${rule.maxBytes / MB} MB).` };
	const mime = sniffMime(head);
	const ext = mime ? rule.mimes[mime] : undefined;
	if (!mime || !ext) return { error: kind === 'image' ? 'Use a JPEG, PNG or WebP image.' : 'Use a PDF file.' };
	return { mime, ext };
}
