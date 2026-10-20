<script lang="ts">
	import type { LucideProps } from '@lucide/svelte';
	import type { Component } from 'svelte';

	let {
		icon: Icon,
		title,
		body
	}: {
		icon: Component<LucideProps>;
		title: string;
		body: string;
	} = $props();
</script>

<div class="empty">
	<Icon size={28} strokeWidth={1.5} />
	<h2 class="font-display">{title}</h2>
	<p class="text-muted">{body}</p>
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--color-muted);
	}

	h2 {
		margin: 0.25rem 0 0;
		color: var(--color-foreground);
		font-size: 1.25rem;
	}

	p {
		max-width: 22rem;
		line-height: 1.45;
	}
</style>
