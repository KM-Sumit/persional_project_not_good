<script lang="ts">
	import { navigating } from '$app/state';
	import UpdatePrompt from '$lib/components/pwa/UpdatePrompt.svelte';
	import type { LayoutProps } from './$types';
	import '../app.css';

	let { children }: LayoutProps = $props();
</script>

{#if navigating.to}
	<div class="nav-progress" role="progressbar" aria-label="Loading"></div>
{/if}

{@render children()}
<UpdatePrompt />
