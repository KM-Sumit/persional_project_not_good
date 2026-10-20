<script lang="ts">
	// A new build's worker installs in the background and waits (src/service-worker.ts). This shows
	// "New version ready"; Update activates it and reloads once. Checks on start, on return to the app and every 30 min.
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { RefreshCw, X } from '@lucide/svelte';
	import { dev } from '$app/env';
	import { page } from '$app/state';

	let waiting = $state<ServiceWorker | null>(null);
	let applying = $state(false);

	/** Hide on the whole student quiz tree so Start / attempt are never force-reloaded mid-flow. */
	const onQuizPath = $derived(/^\/q(\/|$)/.test(page.url.pathname));

	function isQuizPath(pathname: string) {
		return /^\/q(\/|$)/.test(pathname);
	}

	onMount(() => {
		if (dev || !('serviceWorker' in navigator)) return;
		// Only an update when a worker already controls this page (not the first install).
		const offer = (w: ServiceWorker | null) => {
			if (w && navigator.serviceWorker.controller && !isQuizPath(window.location.pathname)) waiting = w;
		};
		let reg: ServiceWorkerRegistration | undefined;
		const check = () => reg?.update().catch(() => {});
		const onVisible = () => document.visibilityState === 'visible' && check();
		const timer = setInterval(check, 30 * 60 * 1000);
		document.addEventListener('visibilitychange', onVisible);
		// ready, not getRegistration(): on a first visit SvelteKit registers the worker after this runs.
		navigator.serviceWorker.ready.then((r) => {
			reg = r;
			offer(r.waiting);
			r.addEventListener('updatefound', () => {
				const w = r.installing;
				w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
			});
		});
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	function update() {
		applying = true;
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
		waiting?.postMessage('SKIP_WAITING');
	}
</script>

{#if waiting && !onQuizPath}
	<div class="pwa-update" transition:fly={{ y: -24, duration: 280 }} role="status" data-update-bar>
		<RefreshCw class="text-primary" aria-hidden="true" />
		<p>New version ready</p>
		<button type="button" class="btn btn-primary btn-sm" disabled={applying} onclick={update}>{applying ? 'Updating' : 'Update'}</button>
		<button type="button" class="btn btn-ghost btn-sm pwa-x" aria-label="Later" onclick={() => (waiting = null)}><X /></button>
	</div>
{/if}

<style>
	.pwa-update {
		position: fixed;
		z-index: 80;
		top: calc(var(--safe-top, 0px) + 0.5rem);
		left: 50%;
		translate: -50% 0;
		width: min(24rem, calc(100% - 2rem));
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.375rem 0.375rem 0.375rem 1rem;
		background: hsl(var(--surface));
		color: hsl(var(--foreground));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
	}
	.pwa-update :global(svg) { width: 20px; height: 20px; flex-shrink: 0; }
	p { flex: 1; min-width: 0; margin: 0; font-size: 0.875rem; font-weight: 600; }
	.btn { min-height: 44px; }
	.pwa-x { width: 44px; padding: 0; color: hsl(var(--muted-foreground)); }
</style>
