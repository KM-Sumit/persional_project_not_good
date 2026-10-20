<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { CalendarClock, PlayCircle, Radio } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import LiveRow from '#lib/features/live/components/LiveRow.svelte';

	let { data } = $props();
	const t = $derived(data.timetable);
	const tab = $derived(page.url.searchParams.get('tab') === 'recordings' ? 'recordings' : 'schedule');
	const hasSchedule = $derived(t.live.length + t.today.length + t.week.length > 0);

	// Classes go live when the teacher presses the button: refresh the timetable every minute.
	onMount(() => {
		const i = setInterval(() => document.visibilityState === 'visible' && invalidateAll(), 60_000);
		return () => clearInterval(i);
	});
</script>

<svelte:head><title>Live classes · UCI</title></svelte:head>

<div class="page page-narrow">
	<PageHeader title="Live classes" subtitle="Times are in IST. Join from here when the class starts." />

	<div class="segmented mb-4" role="tablist" aria-label="Live classes">
		<a role="tab" aria-selected={tab === 'schedule'} href="?tab=schedule" data-sveltekit-replacestate data-sveltekit-reset="false">Schedule</a>
		<a role="tab" aria-selected={tab === 'recordings'} href="?tab=recordings" data-sveltekit-replacestate data-sveltekit-reset="false">
			Recordings{#if t.recordings.length}<span class="seg-count tabular">{t.recordings.length}</span>{/if}
		</a>
	</div>

	{#if tab === 'schedule'}
		{#if !hasSchedule}
			<div class="empty card rise">
				<div class="empty-icon"><CalendarClock /></div>
				<h3>No live classes this week</h3>
				<p>New classes show here as soon as your teachers schedule them.</p>
				{#if t.recordings.length}<a class="btn btn-secondary" href="?tab=recordings"><PlayCircle /> Watch recordings</a>{/if}
			</div>
		{/if}
		{#if t.live.length}
			<section class="mb-6 rise" aria-labelledby="now-h">
				<div class="section-head"><h2 id="now-h" class="section-title flex items-center gap-2"><Radio class="size-5 text-primary" />Live now</h2></div>
				<div class="list">{#each t.live as c (c.id)}<LiveRow {c} serverNow={data.serverNow} />{/each}</div>
			</section>
		{/if}
		{#if t.today.length}
			<section class="mb-6 rise" style="--i: 1" aria-labelledby="today-h">
				<div class="section-head"><h2 id="today-h" class="section-title">Today</h2></div>
				<div class="list">{#each t.today as c (c.id)}<LiveRow {c} serverNow={data.serverNow} />{/each}</div>
			</section>
		{/if}
		{#each t.week as d, i (d.key)}
			<section class="mb-6 rise" style="--i: {i + 2}" aria-labelledby="d-{d.key}">
				<div class="section-head"><h2 id="d-{d.key}" class="section-title">{d.label}</h2></div>
				<div class="list">{#each d.items as c (c.id)}<LiveRow {c} serverNow={data.serverNow} />{/each}</div>
			</section>
		{/each}
	{:else if t.recordings.length}
		<div class="list rise">{#each t.recordings as c (c.id)}<LiveRow {c} serverNow={data.serverNow} showDate />{/each}</div>
	{:else}
		<div class="empty card rise">
			<div class="empty-icon"><PlayCircle /></div>
			<h3>No recordings yet</h3>
			<p>After a class ends, its recording shows here.</p>
		</div>
	{/if}
</div>
