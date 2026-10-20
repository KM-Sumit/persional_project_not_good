<script lang="ts">
	// One timetable row: IST time stub, title + teacher, status chip, and a countdown / Join on the right.
	import { invalidateAll } from '$app/navigation';
	import { ChevronRight, Lock, PlayCircle } from '@lucide/svelte';
	import Countdown from '#lib/components/kit/Countdown.svelte';
	import { istDate, istTime } from '../format';
	import type { LiveClassDTO } from '../schema';

	let { c, serverNow, showDate = false }: { c: LiveClassDTO; serverNow: string; showDate?: boolean } = $props();
	const startsIn = $derived(Date.parse(c.startsAt) - Date.parse(serverNow));
	const [time, ampm] = $derived(istTime(c.startsAt).split(' '));
</script>

<a class="list-row live-row" class:is-live={c.status === 'live'} class:is-off={c.status === 'cancelled'} href="/app/live/{c.id}">
	<span class="stub" aria-hidden="true">
		{#if showDate}<span class="t font-mono tabular">{istDate(c.startsAt).split(' ').slice(1).join(' ')}</span>
		{:else}<span class="t font-mono tabular">{time}</span><span class="ap">{ampm}</span>{/if}
	</span>
	<span class="grow min-w-0">
		<span class="title block truncate">{c.title}</span>
		<span class="meta">
			{#if c.status === 'live'}<span class="badge badge-live">Live now</span>
			{:else if c.status === 'cancelled'}<span class="badge badge-danger">Cancelled</span>{/if}
			{#if c.locked}<Lock class="inline size-3.5 align-[-2px]" aria-label="Paid" />{/if}
			{c.teacher} · {showDate ? `${istTime(c.startsAt)} · ` : ''}{c.durationMin} min
		</span>
	</span>
	{#if c.status === 'live'}
		<span class="btn btn-primary btn-sm join"><PlayCircle />Join</span>
	{:else if c.status === 'scheduled' && startsIn > 0 && startsIn < 3 * 3600_000}
		<span class="soon"><span class="tiny muted">in</span><b><Countdown to={c.startsAt} {serverNow} warnAt={0} onend={() => invalidateAll()} /></b></span>
	{:else}
		<ChevronRight class="chev" />
	{/if}
</a>

<style>
	.live-row { gap: .75rem; }
	.stub { display: grid; place-items: center; align-content: center; width: 3.5rem; flex-shrink: 0; line-height: 1.1; padding: .25rem 0; border-right: 1px dashed hsl(var(--border)); padding-right: .75rem; }
	.stub .t { font-weight: 600; font-size: .9375rem; }
	.stub .ap { font-size: .6875rem; color: hsl(var(--muted-foreground)); letter-spacing: .04em; }
	.is-live .stub .t { color: hsl(var(--primary)); }
	.is-off .title { text-decoration: line-through; color: hsl(var(--muted-foreground)); }
	.meta { display: flex; flex-wrap: wrap; align-items: center; gap: .125rem .375rem; }
	.soon { display: grid; justify-items: end; line-height: 1.1; flex-shrink: 0; }
	.soon b { font-size: .875rem; }
	.join { flex-shrink: 0; }
</style>
