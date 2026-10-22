<script lang="ts">
	// Home poster slider: one snap slide, swipe on phones, autoplay when there are several.
	import type { BannerDto } from '#lib/features/engage/schema';
	import { reducedMotion } from '#lib/client/platform';

	let { banners }: { banners: BannerDto[] } = $props();

	const placeholder: BannerDto = {
		id: 'placeholder',
		title: 'All India Live Mock Test Series',
		subtitle: 'Scheduled mocks with rank, percentile and full solutions.',
		ctaLabel: 'See tests',
		href: '/app/tests',
		imageFileId: null,
		image: null,
		enabled: true,
		sortOrder: 0,
		createdAt: ''
	};

	const slides = $derived(banners.length ? banners : [placeholder]);
	const many = $derived(slides.length > 1);

	let track = $state<HTMLDivElement | undefined>();
	let active = $state(0);
	let holding = $state(false);
	const current = $derived(Math.min(active, slides.length - 1));

	const external = (h: string) => h.startsWith('https://');

	function go(i: number) {
		const el = track;
		if (!el?.clientWidth) return;
		const n = slides.length;
		const next = ((i % n) + n) % n;
		active = next;
		el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
	}

	function onScroll() {
		const el = track;
		if (!el?.clientWidth) return;
		active = Math.round(el.scrollLeft / el.clientWidth);
	}

	function hold() {
		holding = true;
	}
	function release() {
		holding = false;
	}

	$effect(() => {
		if (!many || holding || reducedMotion()) return;
		const id = setInterval(() => {
			const el = track;
			if (!el?.clientWidth) return;
			const i = Math.round(el.scrollLeft / el.clientWidth);
			go(i + 1);
		}, 3800);
		return () => clearInterval(id);
	});
</script>

<svelte:window onpointerup={release} onpointercancel={release} />

<div class="banners" aria-label="Announcements" role="region" onpointerdown={hold}>
	<div class="track" bind:this={track} onscroll={onScroll}>
		{#each slides as b, i (b.id)}
			<a
				href={b.href}
				class={['slide', b.image && 'has-image']}
				aria-label={b.title}
				aria-current={i === current ? 'true' : undefined}
				target={external(b.href) ? '_blank' : undefined}
				rel={external(b.href) ? 'noopener' : undefined}
			>
				{#if b.image}
					<img
						src={b.image}
						alt=""
						loading={i === 0 ? 'eager' : 'lazy'}
						decoding="async"
						draggable="false"
					/>
				{:else}
					<div class="copy">
						<p class="title">{b.title}</p>
						{#if b.subtitle}<p class="sub">{b.subtitle}</p>{/if}
						<span class="cta">{b.ctaLabel}</span>
					</div>
				{/if}
			</a>
		{/each}
	</div>
	{#if many}
		<div class="dots">
			{#each slides as b, i (b.id)}
				<button
					type="button"
					class={['dot', i === current && 'is-on']}
					aria-label="Slide {i + 1}"
					onclick={() => go(i)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.banners {
		display: grid;
		gap: 0.75rem;
	}
	.track {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
		touch-action: pan-x;
		border-radius: 1.5rem;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: 0 0 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		min-height: 11.5rem;
		border-radius: 1.5rem;
		overflow: hidden;
		display: block;
		background:
			radial-gradient(90% 120% at 12% 0%, hsl(var(--sun) / 0.95), transparent 58%),
			linear-gradient(160deg, hsl(24 88% 42%) 0%, hsl(24 50% 22%) 48%, hsl(222 22% 8%) 100%);
		color: hsl(0 0% 100%);
	}
	.slide.has-image {
		aspect-ratio: 16 / 9;
		min-height: 0;
		background: hsl(222 22% 10%);
	}
	.slide img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
	.copy {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 0.45rem;
		padding: 1.35rem 1.25rem 1.5rem;
		max-width: 22rem;
	}
	.title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: clamp(1.2rem, 1.05rem + 0.9vw, 1.55rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.sub {
		font-size: 0.875rem;
		line-height: 1.4;
		opacity: 0.88;
	}
	.cta {
		margin-top: 0.55rem;
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1.05rem;
		border-radius: 999px;
		background: hsl(0 0% 100%);
		color: hsl(222 18% 10%);
		font-size: 0.875rem;
		font-weight: 700;
	}
	.dots {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.35rem;
	}
	.dot {
		width: 1.5rem;
		height: 1.5rem;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.dot::after {
		content: '';
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: hsl(var(--foreground) / 0.22);
		transition:
			width 0.28s var(--ease-smooth),
			background 0.28s var(--ease-smooth);
	}
	.dot.is-on::after {
		width: 1.15rem;
		background: hsl(var(--sun));
	}
</style>
