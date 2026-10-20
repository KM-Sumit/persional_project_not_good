<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	interface Props {
		icon: Component<{ class?: string; strokeWidth?: number }>;
		title: string;
		body?: string;
		action?: Snippet;
		/** Less padding, for empty states inside a card. */
		compact?: boolean;
	}

	let { icon: Icon, title, body, action, compact = false }: Props = $props();
</script>

<div class="empty" class:empty-compact={compact}>
	<div class="empty-icon"><Icon strokeWidth={1.75} /></div>
	<h2 class="empty-title">{title}</h2>
	{#if body}<p>{body}</p>{/if}
	{#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>
