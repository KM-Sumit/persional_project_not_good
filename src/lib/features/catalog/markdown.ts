import { Marked, type Tokens } from 'marked';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** http(s), mailto, or a same-site path. Drops javascript: and protocol-relative URLs. */
function safeHref(href: string): string | null {
	const value = href.trim();
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	try {
		const url = new URL(value);
		if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
			return url.href;
		}
	} catch {
		return null;
	}
	return null;
}

const marked = new Marked({
	gfm: true,
	renderer: {
		html({ text }: Tokens.HTML | Tokens.Tag) {
			return escapeHtml(text);
		},
		heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
			const level = Math.min(Math.max(token.depth, 2), 3);
			return `<h${level}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
		},
		link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Link) {
			const text = this.parser.parseInline(token.tokens);
			const href = safeHref(token.href);
			if (!href) return text;
			return `<a href="${escapeHtml(href)}">${text}</a>`;
		},
		image(token: Tokens.Image) {
			const href = safeHref(token.href);
			const alt = escapeHtml(token.text);
			if (!href) return alt;
			return `<img src="${escapeHtml(href)}" alt="${alt}">`;
		}
	}
});

/** Renders a note or lesson body. Raw HTML in the source is escaped. */
export function renderMarkdown(source: string): string {
	const html = marked.parse(source, { async: false });
	return typeof html === 'string' ? html.trim() : '';
}
