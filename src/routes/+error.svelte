<script lang="ts">
	import { page } from '$app/state';
	import { CircleAlert, SearchX } from '@lucide/svelte';

	const notFound = $derived(page.status === 404);
	const Icon = $derived(notFound ? SearchX : CircleAlert);
	/** Keep students on the test they were in. */
	const quizPath = $derived(/^\/app\/tests\/[^/]+/.exec(page.url.pathname)?.[0] ?? null);
</script>

<svelte:head><title>{notFound ? 'Page not found' : 'Something went wrong'} · UCI</title></svelte:head>

<div class="page-form pt-12 text-center md:pt-24">
	<div class="empty-icon-lg mx-auto"><Icon strokeWidth={1.75} /></div>
	<p class="eyebrow rise mt-5" style="--i: 1">Error {page.status}</p>
	<h1 class="page-title rise mt-2" style="--i: 2">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="page-sub rise mx-auto max-w-sm" style="--i: 3">
		{notFound ? 'The link may be old or mistyped. Check it, or head back home.' : page.error?.message || 'Please try again in a moment.'}
	</p>
	<div class="rise mt-6 flex flex-wrap justify-center gap-2" style="--i: 4">
		{#if !notFound}<button type="button" class="btn btn-secondary" onclick={() => location.reload()}>Try again</button>{/if}
		{#if quizPath}<a href={quizPath} class="btn btn-primary">Back to test</a>
		{:else}<a href="/" class="btn btn-primary">Go home</a>{/if}
	</div>
</div>

<style>
	.empty-icon-lg {
		width: 64px;
		height: 64px;
		border-radius: 999px;
		border: 2px dashed hsl(var(--border));
		display: grid;
		place-items: center;
		color: hsl(var(--muted-foreground));
		animation: cq-fade 200ms ease-out backwards;
	}
	.empty-icon-lg :global(svg) {
		width: 28px;
		height: 28px;
	}
	@keyframes err-pop {
		from {
			opacity: 0;
			transform: scale(0.6) rotate(-12deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.empty-icon-lg {
			animation: none;
		}
	}
</style>
