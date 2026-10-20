import { expect, test } from 'bun:test';
import { extractToc, readingMinutes, renderDoc, renderMarkdown } from './markdown';

test('raw HTML is escaped, never passed through', () => {
	const html = renderMarkdown('<script>alert(1)</script>\n\nHi <img src=x onerror=alert(1)> <b onclick="x()">b</b>');
	expect(html).not.toContain('<script');
	expect(html).not.toContain('<img src=x');
	expect(html).not.toContain('<b ');
	expect(html).toContain('&lt;script&gt;');
});

test('dangerous link and image schemes are dropped', () => {
	const html = renderMarkdown('[a](javascript:alert(1)) [b](data:text/html,x) ![i](javascript:x) [c](vbscript:x) <javascript:alert(1)>');
	expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
	expect(html).not.toMatch(/src="javascript:/i);
});

test('safe links get rel and attribute escaping', () => {
	const html = renderMarkdown('[ok](https://example.com/a?b="c") [in](/app/notes) [top](#intro)');
	expect(html).toContain('href="https://example.com/a?b=&quot;c&quot;"');
	expect(html).toContain('rel="noopener noreferrer nofollow"');
	expect(html).toContain('href="/app/notes"');
	expect(html).toContain('href="#intro"');
});

test('code is escaped and math inside code is left alone', () => {
	const html = renderMarkdown('`<b>$x$</b>`\n\n```html\n<script>1</script>\n```');
	expect(html).toContain('<code>&lt;b&gt;$x$&lt;/b&gt;</code>');
	expect(html).toContain('&lt;script&gt;1&lt;/script&gt;');
});

test('KaTeX renders inline and block math; prices stay text', () => {
	const html = renderMarkdown('Area $\\pi r^2$ costs $5 and $10.\n\n$$\\frac{a}{b}$$');
	expect(html).toContain('class="katex"');
	expect(html).toContain('class="math-block"');
	expect(html).toContain('costs $5 and $10.');
});

test('headings get unique ids that match the TOC; h1 renders as h2', () => {
	const md = '# Percentages\n\n## Basics\n\ntext\n\n## Basics\n\n### Tricks & tips';
	const { html, toc } = renderDoc(md);
	expect(html).toContain('<h2 id="percentages">');
	expect(html).toContain('<h2 id="basics-2">');
	expect(html).toContain('<h3 id="tricks-and-tips">Tricks &amp; tips</h3>');
	expect(toc.map((t) => t.id)).toEqual(['percentages', 'basics', 'basics-2', 'tricks-and-tips']);
	expect(extractToc(md)).toEqual(toc);
});

test('reading time', () => {
	expect(readingMinutes('')).toBe(1);
	expect(readingMinutes('word '.repeat(1000))).toBe(5);
});
