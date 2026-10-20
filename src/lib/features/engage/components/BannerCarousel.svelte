<script lang="ts">
	// Home banners: a native scroll-snap row (swipe on phones, two up on wide screens). No autoplay: it steals focus.
	import type { BannerDto } from '#lib/features/engage/schema';
	import BannerCard from './BannerCard.svelte';

	let { banners }: { banners: BannerDto[] } = $props();
	const external = (h: string) => h.startsWith('https://');
</script>

{#if banners.length}
	<div class="banners" aria-label="Announcements" role="region">
		{#each banners as b (b.id)}
			<a href={b.href} class="slide" target={external(b.href) ? '_blank' : undefined} rel={external(b.href) ? 'noopener' : undefined}>
				<BannerCard title={b.title} subtitle={b.subtitle} ctaLabel={b.ctaLabel} imageSrc={b.image} />
			</a>
		{/each}
	</div>
{/if}

<style>
	.banners {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: min(88%, 26rem);
		gap: 0.75rem;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		margin-inline: calc(-1 * var(--gutter));
		padding-inline: var(--gutter);
		scroll-padding-inline: var(--gutter);
	}
	.banners::-webkit-scrollbar {
		display: none;
	}
	.slide {
		scroll-snap-align: start;
		display: block;
		border-radius: var(--radius);
	}
	@media (min-width: 1024px) {
		.banners {
			grid-auto-columns: calc((100% - 0.75rem) / 2);
			margin-inline: 0;
			padding-inline: 0;
		}
	}
</style>
