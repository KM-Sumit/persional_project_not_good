/** Parse a YouTube watch / share / embed / shorts URL into an 11-char video id. */
export function youtubeId(url: string): string | null {
	const raw = url.trim();
	if (!raw) return null;
	try {
		const u = new URL(raw);
		const host = u.hostname.replace(/^www\./, '');
		if (host === 'youtu.be') {
			const id = u.pathname.split('/').filter(Boolean)[0];
			return id && /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
			const v = u.searchParams.get('v');
			if (v && /^[\w-]{11}$/.test(v)) return v;
			const parts = u.pathname.split('/').filter(Boolean);
			const i = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live');
			if (i >= 0 && parts[i + 1] && /^[\w-]{11}$/.test(parts[i + 1]!)) return parts[i + 1]!;
		}
	} catch {
		/* fall through */
	}
	return /^[\w-]{11}$/.test(raw) ? raw : null;
}

export function youtubeEmbedSrc(url: string): string | null {
	const id = youtubeId(url);
	if (!id) return null;
	return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}
