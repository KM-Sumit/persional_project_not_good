<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		updated,
		children
	}: {
		title: string;
		updated: string;
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} · Upendra Competition Institute</title>
</svelte:head>

<main class="page-view py-10 lg:py-14">
	<article class="mx-auto max-w-2xl">
		<Trail items={[{ label: 'Home', href: '/' }, { label: title }]} />
		<h1 class="font-display text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.25rem]">
			{title}
		</h1>
		<p class="meta mt-2">Last updated: {updated}</p>

		<aside
			class="legal-disclaimer mt-6 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)] px-4 py-3 text-[0.875rem] leading-relaxed text-[hsl(var(--muted-foreground))]"
			role="note"
		>
			This document is a plain-language draft for Upendra Competition Institute. It is not legal advice. Have a
			licensed attorney review it before you rely on it for compliance or binding obligations.
		</aside>

		<div class="legal-body mt-8">
			{@render children()}
		</div>

		<nav class="meta mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-[hsl(var(--border))] pt-6">
			<a class="text-[hsl(var(--primary))] no-underline hover:underline" href="/terms">Terms</a>
			<a class="text-[hsl(var(--primary))] no-underline hover:underline" href="/privacy">Privacy</a>
			<a class="text-[hsl(var(--primary))] no-underline hover:underline" href="/cookies">Cookies</a>
			<a class="text-[hsl(var(--primary))] no-underline hover:underline" href="/">Home</a>
		</nav>
	</article>
</main>

<style>
	.legal-body :global(h2) {
		margin: 2rem 0 0.65rem;
		font-family: var(--font-body);
		font-size: 1.0625rem;
		font-weight: 700;
		line-height: 1.35;
		color: hsl(var(--foreground));
	}

	.legal-body :global(h2:first-child) {
		margin-top: 0;
	}

	.legal-body :global(p),
	.legal-body :global(li) {
		margin: 0 0 0.85rem;
		font-size: 0.9375rem;
		line-height: 1.65;
		color: hsl(var(--foreground));
	}

	.legal-body :global(ul),
	.legal-body :global(ol) {
		margin: 0 0 1rem;
		padding-inline-start: 1.35rem;
	}

	.legal-body :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.legal-body :global(strong) {
		font-weight: 600;
	}
</style>
