<script lang="ts" module>
	// One shared loader for the YouTube IFrame API (it calls a single global callback).
	type YTPlayer = { getCurrentTime(): number; getDuration(): number; destroy(): void };
	type YTNamespace = { Player: new (el: HTMLElement, opts: object) => YTPlayer; PlayerState: { PLAYING: number; ENDED: number } };
	let api: Promise<YTNamespace> | null = null;
	function loadApi(): Promise<YTNamespace> {
		const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
		if (w.YT?.Player) return Promise.resolve(w.YT);
		api ??= new Promise((resolve, reject) => {
			const prev = w.onYouTubeIframeAPIReady;
			w.onYouTubeIframeAPIReady = () => (prev?.(), resolve(w.YT!));
			const s = document.createElement('script');
			s.src = 'https://www.youtube.com/iframe_api';
			s.async = true;
			s.onerror = () => ((api = null), reject(new Error('YouTube could not load')));
			document.head.append(s);
		});
		return api;
	}
</script>

<script lang="ts">
	// youtube-nocookie player in a reserved 16:9 box with the video thumbnail as poster (no layout shift).
	// Reports progress every second while playing and when paused/ended, for lesson resume + completion.
	import { onMount } from 'svelte';

	interface Props {
		videoId: string;
		start?: number;
		onprogress?: (sec: number, duration: number) => void;
		onended?: () => void;
	}
	let { videoId, start = 0, onprogress, onended }: Props = $props();

	let host = $state<HTMLDivElement>();
	let ready = $state(false);
	let failed = $state(false);

	onMount(() => {
		let player: YTPlayer | null = null;
		let timer: ReturnType<typeof setInterval> | undefined;
		let gone = false;
		const report = () => player && onprogress?.(Math.floor(player.getCurrentTime()), Math.floor(player.getDuration()));
		loadApi().then(
			(YT) => {
				if (gone || !host) return;
				player = new YT.Player(host, {
					host: 'https://www.youtube-nocookie.com',
					videoId,
					width: '100%',
					height: '100%',
					playerVars: { start: Math.floor(start), rel: 0, modestbranding: 1, playsinline: 1 },
					events: {
						onReady: () => (ready = true),
						onStateChange: (e: { data: number }) => {
							clearInterval(timer);
							if (e.data === YT.PlayerState.PLAYING) timer = setInterval(report, 1000);
							else report();
							if (e.data === YT.PlayerState.ENDED) onended?.();
						}
					}
				});
			},
			() => (failed = true)
		);
		return () => {
			gone = true;
			clearInterval(timer);
			report();
			player?.destroy();
		};
	});
</script>

<div class="kit-yt" style:background-image="url(https://i.ytimg.com/vi/{encodeURIComponent(videoId)}/hqdefault.jpg)">
	<div class="kit-yt-frame" class:is-ready={ready}><div bind:this={host}></div></div>
	{#if failed}
		<a class="kit-yt-fallback" href="https://www.youtube.com/watch?v={encodeURIComponent(videoId)}" target="_blank" rel="noopener">
			The player could not load. Watch on YouTube
		</a>
	{/if}
</div>

<style>
	.kit-yt {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius);
		background-color: hsl(var(--foreground));
		background-size: cover;
		background-position: center;
	}
	.kit-yt-frame {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.kit-yt-frame.is-ready {
		opacity: 1;
	}
	.kit-yt-frame :global(iframe) {
		width: 100%;
		height: 100%;
		border: 0;
	}
	.kit-yt-fallback {
		position: absolute;
		inset: auto 0.75rem 0.75rem;
		padding: 0.625rem 0.875rem;
		border-radius: 10px;
		background: hsl(var(--surface));
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		font-weight: 600;
		text-align: center;
	}
</style>
