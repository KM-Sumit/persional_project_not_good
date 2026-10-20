// Markdown -> safe HTML for notes and reading lessons.
// Raw HTML is escaped (never passed through), links/images are scheme-allowlisted, headings get ids for a TOC,
// $...$ and $$...$$ render with KaTeX. Page owns the <h1>, so "#" renders as <h2>.
import katex from 'katex';
import { Marked, type Tokens } from 'marked';
import { slugify } from '../../courses/schema';

export type TocItem = { id: string; text: string; level: 2 | 3 | 4 };
export type RenderedDoc = { html: string; toc: TocItem[]; readingMinutes: number };

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** http(s), mailto, site-relative and in-page anchors only. */
function safeUrl(href: string | null | undefined, images = false): string | null {
	const h = (href ?? '').trim();
	if (/^\/(?!\/)/.test(h) || (!images && h.startsWith('#'))) return h;
	if (/^https?:\/\//i.test(h) || (!images && /^mailto:/i.test(h))) return h;
	return null;
}

const plain = (s: string) =>
	s
		.replace(/<[^>]*>/g, '')
		.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]!)
		.trim();

function tex(src: string, displayMode: boolean) {
	try {
		return katex.renderToString(src, { displayMode, throwOnError: false, trust: false, strict: 'ignore', output: 'html' });
	} catch {
		return `<code>${esc(src)}</code>`;
	}
}

const mathExtensions = [
	{
		name: 'mathBlock',
		level: 'block' as const,
		start: (src: string) => src.indexOf('$$'),
		tokenizer(src: string) {
			const m = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src);
			return m ? { type: 'mathBlock', raw: m[0], text: m[1]!.trim() } : undefined;
		},
		renderer: (t: Tokens.Generic) => `<div class="math-block">${tex(t.text as string, true)}</div>\n`
	},
	{
		name: 'mathInline',
		level: 'inline' as const,
		start: (src: string) => src.indexOf('$'),
		tokenizer(src: string) {
			// $$x$$ inline, or $x$ where the content does not start/end with a space (so "$5 and $10" stays text).
			const m = /^\$\$([^$\n]+?)\$\$/.exec(src) ?? /^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src);
			return m ? { type: 'mathInline', raw: m[0], text: m[1]!, display: m[0].startsWith('$$') } : undefined;
		},
		renderer: (t: Tokens.Generic) => tex(t.text as string, Boolean(t.display))
	}
];

export function renderDoc(md: string): RenderedDoc {
	const toc: TocItem[] = [];
	const used = new Map<string, number>();
	const marked = new Marked({
		gfm: true,
		breaks: false,
		extensions: mathExtensions,
		renderer: {
			html: ({ text }) => esc(text),
			heading({ tokens, depth }) {
				const inner = this.parser.parseInline(tokens);
				const level = Math.min(4, Math.max(2, depth + (depth === 1 ? 1 : 0))) as 2 | 3 | 4;
				const text = plain(inner);
				const base = slugify(text);
				const n = (used.get(base) ?? 0) + 1;
				used.set(base, n);
				const id = n === 1 ? base : `${base}-${n}`;
				if (level <= 3) toc.push({ id, text, level });
				return `<h${level} id="${id}">${inner}</h${level}>\n`;
			},
			link({ href, title, tokens }) {
				const inner = this.parser.parseInline(tokens);
				const url = safeUrl(href);
				if (!url) return inner;
				const ext = /^https?:/i.test(url);
				return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>${inner}</a>`;
			},
			image({ href, title, text }) {
				const url = safeUrl(href, true);
				if (!url) return esc(text);
				return `<img src="${esc(url)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy" decoding="async">`;
			},
			table(token) {
				// Wrap so wide tables scroll inside the column instead of the page.
				const head = token.header.map((c) => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`).join('');
				const body = token.rows
					.map((r) => `<tr>${r.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`)
					.join('');
				return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
			}
		}
	});
	const html = marked.parse(md ?? '', { async: false }) as string;
	return { html, toc, readingMinutes: readingMinutes(md) };
}

/** Safe HTML for a markdown string. */
export const renderMarkdown = (md: string) => renderDoc(md).html;

/** h2/h3 entries with the same ids renderMarkdown puts on the headings. */
export const extractToc = (md: string) => renderDoc(md).toc;

/** ~200 words/min (study reading is slower than leisure reading); at least 1 minute. */
export function readingMinutes(md: string): number {
	const words = (md ?? '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/\$\$[\s\S]*?\$\$/g, ' x ')
		.replace(/[#>*_`|[\]()-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}
