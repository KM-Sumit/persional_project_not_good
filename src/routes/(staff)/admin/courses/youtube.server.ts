// YouTube link -> { id, title, thumb } for the course builder. Title comes from YouTube's keyless oEmbed;
// a slow or failed lookup just leaves the title empty (the admin types one).
import { parseYouTubeId } from '#lib/features/courses/schema';

export type YtInfo = { id: string; title: string; thumb: string };

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export async function ytInfo(url: string, fetcher: typeof fetch = fetch): Promise<YtInfo | null> {
	const id = parseYouTubeId(url);
	if (!id) return null;
	let title = '';
	try {
		const res = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
			signal: AbortSignal.timeout(3000)
		});
		if (res.ok) title = String(((await res.json()) as { title?: unknown }).title ?? '').slice(0, 200);
	} catch {
		/* offline or blocked: no title */
	}
	return { id, title, thumb: ytThumb(id) };
}
