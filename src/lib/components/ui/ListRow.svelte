<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { ChevronRight } from '@lucide/svelte';

	// One row inside <div class="list">: leading icon, title, meta line, optional trailing content.
	// With href it's a link with a chevron; with onclick it's a button; otherwise plain.
	let {
		title,
		meta,
		href,
		onclick,
		icon: Icon,
		trail,
		children
	}: {
		title: string;
		meta?: string;
		href?: string;
		onclick?: () => void;
		icon?: Component<{ class?: string }>;
		/** Right-hand side: a badge, score, button. */
		trail?: Snippet;
		/** Extra content under the meta line. */
		children?: Snippet;
	} = $props();
</script>

{#snippet inner()}
	{#if Icon}<span class="leading-icon"><Icon /></span>{/if}
	<span class="grow">
		<span class="title block">{title}</span>
		{#if meta}<span class="meta block">{meta}</span>{/if}
		{@render children?.()}
	</span>
	{#if trail}<span class="trail">{@render trail()}</span>{/if}
	{#if href}<ChevronRight class="chev" />{/if}
{/snippet}

{#if href}
	<a {href} class="list-row">{@render inner()}</a>
{:else if onclick}
	<button type="button" class="list-row" {onclick}>{@render inner()}</button>
{:else}
	<div class="list-row">{@render inner()}</div>
{/if}
