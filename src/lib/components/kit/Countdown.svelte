<script lang="ts">
	// Exam timer. Uses the server clock: offset = serverNow - local now at mount, so a wrong phone clock
	// can't add time. Mono tabular digits; turns warning-coloured under `warnAt` seconds (default 5 min).
	import { onMount } from 'svelte';

	interface Props {
		to: string;
		serverNow?: string;
		onend?: () => void;
		/** Seconds left at which the timer turns to the warning colour. */
		warnAt?: number;
	}
	let { to, serverNow, onend, warnAt = 300 }: Props = $props();

	const target = $derived(Date.parse(to));
	// SSR and first client render use serverNow so both print the same digits.
	const initial = () => (serverNow ? Date.parse(serverNow) : Date.now());
	let now = $state(initial());
	let ended = false;

	onMount(() => {
		const offset = serverNow ? Date.parse(serverNow) - Date.now() : 0;
		const tick = () => {
			now = Date.now() + offset;
			if (!ended && now >= target) {
				ended = true;
				onend?.();
			}
		};
		tick();
		const t = setInterval(tick, 250);
		return () => clearInterval(t);
	});

	const left = $derived(Math.max(0, Math.ceil((target - now) / 1000)));
	const text = $derived.by(() => {
		const h = Math.floor(left / 3600);
		const m = Math.floor((left % 3600) / 60);
		const s = left % 60;
		const p = (n: number) => String(n).padStart(2, '0');
		return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
	});
	const spoken = $derived(`${Math.floor(left / 60)} minutes ${left % 60} seconds left`);
</script>

<span class="kit-countdown font-mono tabular" class:is-warn={left <= warnAt && left > 0} class:is-over={left === 0} role="timer" aria-label={spoken}>
	{text}
</span>

<style>
	.kit-countdown {
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.is-warn {
		color: hsl(var(--warning));
	}
	.is-over {
		color: hsl(var(--danger));
	}
</style>
