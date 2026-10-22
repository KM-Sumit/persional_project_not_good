<script lang="ts">
	// Meesho-style poster slider: one full-width snap slide, swipe on phones, autoplay when there are several.
	import type { BannerDto } from '#lib/features/engage/schema';
	import { reducedMotion } from '#lib/client/platform';

	let { banners }: { banners: BannerDto[] } = $props();

	const placeholder: BannerDto = {
		id: 'placeholder',
		title: 'UCI exam prep',
		subtitle: 'Courses, notes and live mock tests',
		ctaLabel: 'Explore courses',
		href: '/app/learn',
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
				class="slide"
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
		margin-inline: calc(-1 * var(--gutter));
		padding-inline: 0.75rem;
	}
	.track {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
		touch-action: pan-x;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: 0 0 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		aspect-ratio: 16 / 9;
		border-radius: var(--radius);
		overflow: hidden;
		display: block;
		background:
			radial-gradient(120% 140% at 100% 0%, hsl(var(--sun) / 0.55), transparent 55%),
			linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(222 22% 10%) 78%);
		color: hsl(0 0% 100%);
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
		gap: 0.35rem;
		padding: clamp(1rem, 0.7rem + 1.5vw, 1.5rem);
		max-width: 88%;
	}
	.title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: clamp(1.25rem, 1.05rem + 1vw, 1.75rem);
		line-height: 1.12;
		letter-spacing: -0.01em;
	}
	.sub {
		font-size: 0.875rem;
		line-height: 1.35;
		opacity: 0.85;
	}
	.cta {
		align-self: flex-start;
		margin-top: 0.35rem;
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		background: hsl(0 0% 100%);
		color: hsl(222 22% 10%);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.dots {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.125rem;
		margin-top: 0.5rem;
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
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 999px;
		background: hsl(var(--foreground) / 0.22);
		transition:
			width 0.28s var(--ease-smooth),
			background 0.28s var(--ease-smooth);
	}
	.dot.is-on::after {
		width: 1rem;
		background: hsl(var(--primary));
	}
	@media (min-width: 1024px) {
		.banners {
			margin-inline: 0;
			padding-inline: 0;
		}
		.slide {
			aspect-ratio: 2.2 / 1;
		}
	}
</style>
