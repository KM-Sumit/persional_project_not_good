import { describe, expect, test } from 'bun:test';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	test('headings, lists, and a table', () => {
		const html = renderMarkdown(`## Conversions

| Fraction | Percent |
| --- | --- |
| 1/2 | 50 |

- A percent **of** a number uses that number as the base.
`);
		expect(html).toContain('<h2>Conversions</h2>');
		expect(html).toContain('<th>Fraction</th>');
		expect(html).toContain('<td>1/2</td>');
		expect(html).toContain('<strong>of</strong>');
	});

	test('escapes raw html and drops unsafe links', () => {
		const html = renderMarkdown(`<script>alert(1)</script>

[ok](https://example.com/a)

[no](javascript:alert(1))
`);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('href="https://example.com/a"');
		expect(html).not.toContain('javascript:');
	});
});