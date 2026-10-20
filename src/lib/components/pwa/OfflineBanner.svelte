<script lang="ts">
	// Tells the user they're offline: saved pages still open, live quizzes and saving need a connection.
	import { fly } from 'svelte/transition';
	import { WifiOff } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let offline = $state(false);
	onMount(() => {
		const sync = () => (offline = !navigator.onLine);
		sync();
		addEventListener('online', sync);
		addEventListener('offline', sync);
		return () => {
			removeEventListener('online', sync);
			removeEventListener('offline', sync);
		};
	});
</script>

{#if offline}
	<div class="pwa-offline" role="status" transition:fly={{ y: -16, duration: 200 }} data-offline-banner aria-label="You're offline. Saved pages still open.">
		<WifiOff aria-hidden="true" />
		<span aria-hidden="true">Offline</span>
	</div>
{/if}

<style>
	/* A small pill centred over the app bar (brand left, buttons right), clear of toasts and action bars. */
	.pwa-offline {
		position: fixed;
		z-index: 60;
		top: calc(var(--safe-top, 0px) + 0.75rem);
		left: 50%;
		translate: -50% 0;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		font-size: 0.8125rem;
		font-weight: 600;
		box-shadow: var(--shadow-lg);
		pointer-events: none;
	}
	.pwa-offline :global(svg) { width: 14px; height: 14px; flex-shrink: 0; }
</style>
