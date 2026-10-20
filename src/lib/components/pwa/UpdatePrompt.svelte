<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import X from '@lucide/svelte/icons/x';
	import { dev } from '$app/env';
	import { page } from '$app/state';

	let waiting = $state<ServiceWorker | null>(null);
	let applying = $state(false);

	const onPaper = $derived(/^\/attempts\/[^/]+$/.test(page.url.pathname));

	function paperPath(pathname: string) {
		return /^\/attempts\/[^/]+$/.test(pathname);
	}

	onMount(() => {
		if (dev || !('serviceWorker' in navigator)) return;
		const offer = (worker: ServiceWorker | null) => {
			if (worker && navigator.serviceWorker.controller && !paperPath(window.location.pathname)) {
				waiting = worker;
			}
		};
		let registration: ServiceWorkerRegistration | undefined;
		const check = () => registration?.update().catch(() => {});
		const onVisible = () => {
			if (document.visibilityState === 'visible') check();
		};
		const timer = setInterval(check, 30 * 60 * 1000);
		document.addEventListener('visibilitychange', onVisible);
		navigator.serviceWorker.ready.then((ready) => {
			registration = ready;
			offer(ready.waiting);
			ready.addEventListener('updatefound', () => {
				const worker = ready.installing;
				worker?.addEventListener('statechange', () => {
					if (worker.state === 'installed') offer(worker);
				});
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

{#if waiting && !onPaper}
	<div class="pwa-update" transition:fly={{ y: -24, duration: 280 }} role="status">
		<RefreshCw class="text-primary" aria-hidden="true" />
		<p>New version ready</p>
		<button type="button" class="btn btn-primary btn-sm" disabled={applying} onclick={update}>
			{applying ? 'Updating' : 'Update'}
		</button>
		<button type="button" class="btn btn-ghost btn-sm pwa-x" aria-label="Later" onclick={() => (waiting = null)}>
			<X />
		</button>
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
	.pwa-update :global(svg) {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	p {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.pwa-x {
		width: 44px;
		padding: 0;
		color: hsl(var(--muted-foreground));
	}
</style>
