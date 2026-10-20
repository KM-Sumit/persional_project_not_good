<script lang="ts">
	import { youtubeEmbedSrc } from '$lib/features/catalog/youtube';

	let { url, title = 'Lesson video' }: { url: string; title?: string } = $props();
	const src = $derived(youtubeEmbedSrc(url));
</script>

{#if src}
	<div class="player">
		<iframe
			src={src}
			title={title}
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
			allowfullscreen
			loading="lazy"
			referrerpolicy="strict-origin-when-cross-origin"
		></iframe>
	</div>
{:else}
	<div class="fallback card">
		<p class="meta">This video link could not be embedded.</p>
		{#if url}
			<a class="btn-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
		{/if}
	</div>
{/if}

<style>
	.player {
		aspect-ratio: 16 / 9;
		width: 100%;
		overflow: hidden;
		border-radius: var(--radius);
		border: 1px solid hsl(var(--border));
		background: #0a0a0a;
		box-shadow: var(--shadow-sm);
	}
	.player iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.fallback {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		padding: 1.25rem;
	}
</style>
