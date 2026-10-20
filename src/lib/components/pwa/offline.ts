// "Save offline": note pages and PDFs copied into the SAVED Cache Storage bucket (see cache-route.ts).
// Metadata rides on the cached response's headers, so the bucket is the only store (no IndexedDB).
import { SAVED } from './cache-route';

export type SavedKind = 'note' | 'file';
export type SavedItem = { url: string; kind: SavedKind; title: string; size: number; savedAt: string };

export const savedUrl = (kind: SavedKind, id: string) => `/app/downloads/${kind}/${encodeURIComponent(id)}`;
export const offlineSupported = () => typeof caches !== 'undefined';

export async function saveOffline(kind: SavedKind, id: string, title: string): Promise<SavedItem> {
	const url = savedUrl(kind, id);
	const cache = await caches.open(SAVED);
	await cache.delete(url); // the SW serves saved copies first: drop it so we fetch fresh
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(res.status === 503 ? 'File storage is not available right now.' : 'Could not download this. Try again.');
	const blob = await res.blob();
	const item: SavedItem = { url, kind, title, size: blob.size, savedAt: new Date().toISOString() };
	await cache.put(
		url,
		new Response(blob, {
			headers: {
				'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
				'x-saved': encodeURIComponent(JSON.stringify({ kind, title, size: item.size, savedAt: item.savedAt }))
			}
		})
	);
	navigator.storage?.persist?.().catch(() => {}); // ask the browser not to evict downloads under storage pressure
	return item;
}

export async function listSaved(): Promise<SavedItem[]> {
	if (!offlineSupported()) return [];
	const cache = await caches.open(SAVED);
	const items = await Promise.all(
		(await cache.keys()).map(async (req) => {
			const meta = (await cache.match(req))?.headers.get('x-saved');
			if (!meta) return null;
			return { url: new URL(req.url).pathname, ...JSON.parse(decodeURIComponent(meta)) } as SavedItem;
		})
	);
	return items.filter((i): i is SavedItem => i !== null).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function isSaved(kind: SavedKind, id: string) {
	return offlineSupported() && Boolean(await (await caches.open(SAVED)).match(savedUrl(kind, id)));
}

export async function removeSaved(url: string) {
	return (await caches.open(SAVED)).delete(url);
}

export function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
