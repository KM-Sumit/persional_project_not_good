<script lang="ts">
	// Plays once each time the app is opened. Moving to Contact or Job Alert and back does not play it again.
	// The first open plays the full video. Later opens play the short clip.
	import { onMount, tick } from 'svelte';

	const SEEN = 'uci-intro-seen';
	const SESSION = 'uci-intro-session';
	let show = $state(false);
	let short = $state(false);
	let video = $state<HTMLVideoElement>();

	onMount(() => {
		if (sessionStorage.getItem(SESSION) === '1') return;
		const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
		const fromThisSite = document.referrer.startsWith(location.origin);
		// Contact, Job Alert and the public site share this browser tab. Only a fresh app open plays the video.
		if (nav?.type === 'back_forward' || fromThisSite) {
			sessionStorage.setItem(SESSION, '1');
			return;
		}
		sessionStorage.setItem(SESSION, '1');
		short = localStorage.getItem(SEEN) === '1';
		show = true;
		let el: HTMLVideoElement | undefined;
		let close = () => {};
		let cancel = false;
		void tick().then(() => {
			if (cancel) return;
			el = video;
			if (!el) return;
			const first = !short;
			const node = el;
			close = () => {
				if (first) localStorage.setItem(SEEN, '1');
				show = false;
				node.pause();
			};
			node.addEventListener('ended', close);
			node.play().catch(() => {
				node.muted = true;
				void node.play().catch(close);
			});
		});
		return () => {
			cancel = true;
			el?.removeEventListener('ended', close);
		};
	});
</script>

{#if show}
	<div class="intro" role="dialog" aria-label="Welcome video" aria-modal="true">
		<video bind:this={video} src={short ? '/intro-short.mp4' : '/intro.mp4'} autoplay playsinline>
			<track kind="captions" srclang="en" label="English" src="/intro.vtt" />
		</video>
	</div>
{/if}

<style>
	.intro {
		position: fixed;
		z-index: 120;
		inset: 0;
		display: grid;
		background: #000;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}
</style>
