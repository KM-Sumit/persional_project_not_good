<script lang="ts">
	// One home banner, fixed 2.4:1 box (no layout shift). With an image: photo + ink scrim under the text.
	// Without: a designed orange-to-ink card. Purely visual; the caller wraps it in a link.
	import { ArrowRight } from '@lucide/svelte';

	let { title, subtitle = '', ctaLabel, imageSrc = null }: { title: string; subtitle?: string; ctaLabel: string; imageSrc?: string | null } =
		$props();
</script>

<div class="banner" class:has-image={!!imageSrc}>
	{#if imageSrc}<img src={imageSrc} alt="" loading="lazy" decoding="async" />{/if}
	<div class="copy">
		<p class="title line-clamp-2">{title}</p>
		{#if subtitle}<p class="sub line-clamp-1">{subtitle}</p>{/if}
		<span class="cta">{ctaLabel}<ArrowRight class="size-4" /></span>
	</div>
</div>

<style>
	.banner {
		--ink: 222 22% 10%;
		position: relative;
		aspect-ratio: 2.4 / 1;
		border-radius: var(--radius);
		overflow: hidden;
		color: hsl(0 0% 100%);
		background:
			radial-gradient(120% 140% at 100% 0%, hsl(var(--sun) / 0.55), transparent 55%),
			linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--ink)) 78%);
		isolation: isolate;
	}
	.banner img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -2;
	}
	.banner.has-image::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(90deg, hsl(var(--ink) / 0.85) 0%, hsl(var(--ink) / 0.35) 70%, transparent);
	}
	.copy {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		padding: clamp(0.875rem, 0.6rem + 1.2vw, 1.25rem);
		max-width: 88%;
	}
	.title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: 1.125rem;
		line-height: 1.12;
		letter-spacing: -0.01em;
	}
	.sub {
		font-size: 0.8125rem;
		line-height: 1.35;
		opacity: 0.85;
	}
	.cta {
		align-self: flex-start;
		margin-top: 0.25rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		background: hsl(0 0% 100%);
		color: hsl(var(--ink));
		font-size: 0.8125rem;
		font-weight: 600;
	}
	@media (max-width: 359px) {
		.sub {
			display: none;
		}
	}
</style>
