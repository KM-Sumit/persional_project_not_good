<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { BookOpen, CalendarX, Clock, Lock, Radio, VideoOff } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import YouTubePlayer from '#lib/components/kit/YouTubePlayer.svelte';
	import Countdown from '#lib/components/kit/Countdown.svelte';
	import { dayLabel, istTime } from '#lib/features/live/format';

	let { data } = $props();
	const c = $derived(data.live);
	const now = $derived(Date.parse(data.serverNow));
	const started = $derived(Date.parse(c.startsAt) <= now);

	// Waiting room: check every 20 s whether the teacher has gone live.
	onMount(() => {
		const i = setInterval(() => {
			if (data.live.status === 'scheduled' && document.visibilityState === 'visible') invalidateAll();
		}, 20_000);
		return () => clearInterval(i);
	});
</script>

<svelte:head><title>{c.title} · Live · UCI</title></svelte:head>

<div class="page page-narrow">
	<PageHeader title={c.title} eyebrow="{dayLabel(c.startsAt, now)}, {istTime(c.startsAt)} IST · {c.durationMin} min" crumbs={[{ href: '/app/live', label: 'Live' }]} />

	{#if c.locked}
		<div class="card card-pad stage rise">
			<Lock class="size-7 text-primary" />
			<p class="font-semibold">This class is part of a paid course</p>
			<p class="muted small">Get the course or the exam pass to watch it live and see the recording.</p>
			{#if c.courseHref}<a class="btn btn-primary" href={c.courseHref}>See the course</a>{/if}
		</div>
	{:else if (c.status === 'live' || c.status === 'ended') && c.youtubeId}
		<div class="rise">
			{#key c.youtubeId}<YouTubePlayer videoId={c.youtubeId} />{/key}
		</div>
	{:else if c.status === 'cancelled'}
		<div class="card card-pad stage rise">
			<CalendarX class="size-7 muted" />
			<p class="font-semibold">This class was cancelled</p>
			<p class="muted small">Check the timetable for the new time.</p>
			<a class="btn btn-secondary" href="/app/live">Open timetable</a>
		</div>
	{:else if c.status === 'ended'}
		<div class="card card-pad stage rise">
			<VideoOff class="size-7 muted" />
			<p class="font-semibold">This class has ended</p>
			<p class="muted small">There is no recording for it.</p>
		</div>
	{:else}
		<div class="card card-pad stage wait rise">
			{#if started}
				<Clock class="size-7 text-primary" />
				<p class="font-semibold">Starting any moment</p>
				<p class="muted small">Keep this page open. The class appears here as soon as your teacher goes live.</p>
			{:else if Date.parse(c.startsAt) - now > 86_400_000}
				<span class="tiny muted uppercase tracking-wide">Starts</span>
				<span class="big tabular">{dayLabel(c.startsAt, now)}, {istTime(c.startsAt)}</span>
				<p class="muted small">Come back a few minutes before the class. The countdown starts a day before.</p>
			{:else}
				<span class="tiny muted uppercase tracking-wide">Starts in</span>
				<span class="big font-mono tabular"><Countdown to={c.startsAt} serverNow={data.serverNow} warnAt={0} onend={() => invalidateAll()} /></span>
				<p class="muted small">Keep this page open. The class appears here when it starts.</p>
			{/if}
		</div>
	{/if}

	<div class="facts mt-4 rise" style="--i: 1">
		<div class="flex flex-wrap items-center gap-2">
			{#if c.status === 'live'}<span class="badge badge-live">Live now</span>
			{:else if c.status === 'ended'}<span class="badge badge-closed">Recording</span>{/if}
			<span class="small muted">with <b class="text-foreground">{c.teacher}</b></span>
		</div>
		{#if c.description}<p class="mt-2 whitespace-pre-line">{c.description}</p>{/if}
		{#if c.lessonHref}<a class="btn btn-secondary mt-3" href={c.lessonHref}><BookOpen /> Open as lesson</a>{/if}
		{#if c.status === 'live'}<p class="tiny muted mt-3 flex items-center gap-1.5"><Radio class="size-3.5" />Chat and questions happen on YouTube during the class.</p>{/if}
	</div>
</div>

<style>
	.stage { display: grid; justify-items: center; text-align: center; gap: .5rem; padding-block: 2.5rem; }
	.stage p { max-width: 32rem; }
	.big { font-size: clamp(2rem, 8vw, 3rem); font-weight: 600; line-height: 1.1; }
</style>
