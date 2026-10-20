<script lang="ts">
	// The 11 s logo reveal. The poster (its final frame) holds the box from first paint, so nothing shifts;
	// the video mounts only after hydration and only without reduced motion, plays once, muted, no controls.
	import { onMount } from 'svelte';

	let play = $state(false);
	let ready = $state(false);

	onMount(() => {
		play = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
</script>

<figure class="intro" class:is-ready={ready} aria-label="UCI intro">
	<img src="/media/intro-poster.jpg" alt="UCI, Upendra Competition Institute logo" width="1010" height="590" fetchpriority="high" />
	{#if play}
		<video
			src="/media/intro.mp4"
			poster="/media/intro-poster.jpg"
			width="1010"
			height="590"
			autoplay
			muted
			playsinline
			preload="metadata"
			disablepictureinpicture
			aria-hidden="true"
			oncanplay={() => (ready = true)}
		></video>
		{#if !ready}<span class="intro-load" aria-hidden="true"></span>{/if}
	{/if}
</figure>

<style>
	.intro {
		position: relative;
		aspect-ratio: 1010 / 590;
		overflow: hidden;
		border-radius: calc(var(--radius) - 4px);
		background: #0b0c0e;
	}
	.intro img,
	.intro video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.intro video {
		opacity: 0;
		transition: opacity 0.4s ease-out;
	}
	.is-ready video {
		opacity: 1;
	}
	.intro-load {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, hsl(var(--sun)), transparent);
		background-size: 40% 100%;
		background-repeat: no-repeat;
		animation: intro-scan 1.2s linear infinite;
	}
	@keyframes intro-scan {
		from {
			background-position: -40% 0;
		}
		to {
			background-position: 140% 0;
		}
	}
</style>
