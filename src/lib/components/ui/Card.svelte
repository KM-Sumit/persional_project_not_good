<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		/** Small line under the title. */
		subtitle?: string;
		pad?: boolean;
		/** Makes the whole card a link. */
		href?: string;
		actions?: Snippet;
		class?: string;
		children: Snippet;
	}

	let { title, subtitle, pad = true, href, actions, class: cls = '', children }: Props = $props();
</script>

{#snippet body()}
	{#if title || actions}
		<div class="card-head">
			<div class="min-w-0">
				{#if title}<h2>{title}</h2>{/if}
				{#if subtitle}<p class="card-sub">{subtitle}</p>{/if}
			</div>
			{#if actions}<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>{/if}
		</div>
	{/if}
	<div class:card-pad={pad}>{@render children()}</div>
{/snippet}

{#if href}
	<a {href} class="card {cls}">{@render body()}</a>
{:else}
	<section class="card {cls}">{@render body()}</section>
{/if}
