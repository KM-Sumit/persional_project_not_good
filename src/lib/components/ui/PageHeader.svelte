<script lang="ts">
	// Every non-tab page: breadcrumbs on desktop, a smart back link on touch widths (returns to the real
	// previous screen, falls back to the parent). Tab roots pass no crumbs and get a large title only.
	import type { Snippet } from 'svelte';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { goBack } from '#lib/client/history';

	type Crumb = { href: string; label: string };
	interface Props {
		title: string;
		subtitle?: string;
		/** Ancestors, root first. The last one is the back target. */
		crumbs?: Crumb[];
		/** Small label above the title (e.g. "Live test", "Chapter 2"). */
		eyebrow?: string;
		actions?: Snippet;
	}

	let { title, subtitle, crumbs = [], eyebrow, actions }: Props = $props();
	const parent = $derived(crumbs.at(-1));
</script>

<header class="page-head">
	<div class="min-w-0">
		{#if crumbs.length}
			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as c (c.href)}
					<a href={c.href}>{c.label}</a><ChevronRight aria-hidden="true" />
				{/each}
				<span aria-current="page">{title}</span>
			</nav>
		{/if}
		{#if parent}
			<a href={parent.href} class="back-link touch-only" data-back onclick={(e) => goBack(e, parent.href)}><ChevronLeft /><span>{parent.label}</span></a>
		{/if}
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1 class="page-title">{title}</h1>
		{#if subtitle}<p class="page-sub">{subtitle}</p>{/if}
	</div>
	{#if actions}<div class="page-actions">{@render actions()}</div>{/if}
</header>
