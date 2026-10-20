<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	type Crumb = { label: string; href?: string };

	let { items }: { items: Crumb[] } = $props();

	const parent = $derived(items.filter((item) => item.href).at(-1));
</script>

<nav class="trail" aria-label="Breadcrumb">
	{#if parent}
		<a class="trail-back" href={parent.href} data-back aria-label="Back to {parent.label}">
			<ChevronLeft class="size-4" aria-hidden="true" />
		</a>
	{/if}
	<ol>
		{#each items as item, index (item.label + index)}
			<li>
				{#if index > 0}
					<span class="sep" aria-hidden="true">/</span>
				{/if}
				{#if item.href}
					<a href={item.href} data-back>{item.label}</a>
				{:else}
					<span aria-current="page">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
