<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';

	interface Props {
		title: string;
		href?: string;
		link?: string;
		id?: string;
	}
	let { title, href, link = 'See all', id }: Props = $props();
</script>

<div class="sh">
	<h2 {id} class="sh-title">{title}</h2>
	{#if href}<a {href} class="sh-link">{link}<ChevronRight /></a>{/if}
</div>

<style>
	.sh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
		min-height: 44px;
	}
	.sh-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		font-size: var(--text-section);
		line-height: 1.2;
		letter-spacing: -0.01em;
	}
	.sh-link {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		min-height: 44px;
		flex-shrink: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--primary));
	}
	.sh-link :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
