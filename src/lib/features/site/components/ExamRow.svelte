<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { plural } from './format';

	type Counts = { tests: number; notes: number; courses: number };
	let { href, name, description, counts }: { href: string; name: string; description?: string; counts?: Counts } = $props();
	const parts = $derived(
		counts
			? [counts.tests && plural(counts.tests, 'test'), counts.courses && plural(counts.courses, 'course'), counts.notes && plural(counts.notes, 'note')].filter(Boolean)
			: []
	);
</script>

<a {href} class="exam-row card press">
	<div class="min-w-0">
		<h3>{name}</h3>
		{#if description}<p class="desc">{description}</p>{/if}
		<p class="meta font-mono tabular">{parts.length ? parts.join(' · ') : 'Tests coming soon'}</p>
	</div>
	<ChevronRight />
</a>

<style>
	.exam-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.125rem;
		min-height: 72px;
		height: 100%;
	}
	h3 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		font-size: 1.1875rem;
		line-height: 1.2;
	}
	.desc {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.125rem;
	}
	.meta {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.375rem;
	}
	.exam-row :global(svg) {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		color: hsl(var(--primary));
	}
</style>
