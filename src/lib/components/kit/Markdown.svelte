<script lang="ts">
	// Renders server-rendered safe HTML (notes renderMarkdown: raw HTML escaped, URLs allowlisted)
	// with reading typography. Never pass user HTML that did not come from that renderer.
	import 'katex/dist/katex.min.css';

	let { html }: { html: string } = $props();
</script>

<div class="prose-uci">{@html html}</div>

<style>
	.prose-uci {
		min-width: 0;
		max-width: 70ch;
		font-size: 1rem;
		line-height: 1.7;
		overflow-wrap: anywhere;
		color: hsl(var(--foreground));
	}
	.prose-uci :global(> * + *) {
		margin-top: 1em;
	}
	.prose-uci :global(:is(h2, h3, h4)) {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.01em;
		scroll-margin-top: calc(var(--appbar-h) + 1rem);
	}
	.prose-uci :global(h2) {
		font-size: 1.5rem;
		margin-top: 1.75em;
	}
	.prose-uci :global(h3) {
		font-size: 1.25rem;
		margin-top: 1.5em;
	}
	.prose-uci :global(h4) {
		font-size: 1.0625rem;
		margin-top: 1.25em;
	}
	.prose-uci :global(> :first-child) {
		margin-top: 0;
	}
	.prose-uci :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.prose-uci :global(strong) {
		font-weight: 700;
	}
	.prose-uci :global(:is(ul, ol)) {
		padding-left: 1.5em;
	}
	.prose-uci :global(ul) {
		list-style: disc;
	}
	.prose-uci :global(ol) {
		list-style: decimal;
	}
	.prose-uci :global(li + li) {
		margin-top: 0.375em;
	}
	.prose-uci :global(li::marker) {
		color: hsl(var(--muted-foreground));
	}
	.prose-uci :global(blockquote) {
		padding: 0.25em 0 0.25em 1em;
		border-left: 3px solid hsl(var(--sun));
		color: hsl(var(--muted-foreground));
	}
	.prose-uci :global(:not(pre) > code) {
		font-family: var(--font-mono);
		font-size: 0.875em;
		padding: 0.1em 0.35em;
		border-radius: 6px;
		background: hsl(var(--muted));
	}
	.prose-uci :global(pre) {
		overflow-x: auto;
		padding: 0.875rem 1rem;
		border-radius: 12px;
		background: hsl(var(--muted));
		font-size: 0.8125rem;
		line-height: 1.55;
	}
	.prose-uci :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 12px;
	}
	.prose-uci :global(hr) {
		border: 0;
		border-top: 1px solid hsl(var(--border));
		margin: 2em 0;
	}
	.prose-uci :global(.table-wrap) {
		overflow-x: auto;
		border: 1px solid hsl(var(--border));
		border-radius: 12px;
	}
	.prose-uci :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}
	.prose-uci :global(:is(th, td)) {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
		text-align: left;
	}
	.prose-uci :global(th) {
		background: hsl(var(--muted));
		font-weight: 600;
	}
	.prose-uci :global(tr:last-child td) {
		border-bottom: 0;
	}
	.prose-uci :global(.math-block),
	.prose-uci :global(.katex-display) {
		overflow-x: auto;
		overflow-y: hidden;
		padding: 0.25rem 0;
	}
</style>
