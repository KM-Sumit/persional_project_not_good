<script lang="ts">
	import { Plus, Radio } from '@lucide/svelte';
	import { Badge, PageHeader, Sheet } from '#lib/components/ui';
	import DataTable, { type Column } from '#lib/components/kit/DataTable.svelte';
	import LiveForm from '#lib/features/live/components/LiveForm.svelte';
	import { dayLabel, istTime } from '#lib/features/live/format';
	import type { LiveClassDTO } from '#lib/features/live/schema';

	let { data } = $props();
	let scheduling = $state(false);

	const now = $derived(Date.parse(data.serverNow));
	const batchName = $derived(new Map(data.options.batches.map((b) => [b.value, b.label])));
	const examName = $derived(new Map(data.options.exams.map((e) => [e.value, e.label])));
	const STATUS = { scheduled: 'Scheduled', live: 'Live now', ended: 'Ended', cancelled: 'Cancelled' } as const;
	const TONE = { scheduled: 'default', live: 'live', ended: 'closed', cancelled: 'danger' } as const;

	const columns: Column<LiveClassDTO>[] = [
		{ key: 'title', label: 'Class', cell: title },
		{ key: 'when', label: 'When', cell: when },
		{ key: 'audience', label: 'For', cell: audience, hideOnPhone: true },
		{ key: 'status', label: 'Status', cell: status, align: 'right' }
	];
</script>

<svelte:head><title>Live classes · UCI Admin</title></svelte:head>

{#snippet title(c: LiveClassDTO)}
	<span class="block font-semibold">{c.title}</span>
	<span class="muted small">{c.teacher}{c.isPaid ? ' · Paid' : ''}</span>
{/snippet}
{#snippet when(c: LiveClassDTO)}
	<span class="tabular">{dayLabel(c.startsAt, now)}, {istTime(c.startsAt)} · {c.durationMin} min</span>
{/snippet}
{#snippet audience(c: LiveClassDTO)}
	{(c.batchId && batchName.get(c.batchId)) || 'Everyone'}{#if c.examId && examName.get(c.examId)}<span class="muted"> · {examName.get(c.examId)}</span>{/if}
{/snippet}
{#snippet status(c: LiveClassDTO)}
	<Badge tone={c.status === 'scheduled' && Date.parse(c.endsAt) < now ? 'warning' : TONE[c.status]}>
		{c.status === 'scheduled' && Date.parse(c.endsAt) < now ? 'Not started' : STATUS[c.status]}
	</Badge>
{/snippet}

<div class="page">
	<PageHeader title="Live classes" subtitle="Schedule classes, go live with a YouTube link, save recordings as lessons">
		{#snippet actions()}
			<button class="btn btn-primary" onclick={() => (scheduling = true)}><Plus /> Schedule class</button>
		{/snippet}
	</PageHeader>

	<div class="segmented mb-4 rise" role="tablist" aria-label="Classes">
		<a role="tab" aria-selected={data.view === 'upcoming'} href="?view=upcoming" data-sveltekit-replacestate data-sveltekit-reset="false">Upcoming</a>
		<a role="tab" aria-selected={data.view === 'past'} href="?view=past" data-sveltekit-replacestate data-sveltekit-reset="false">Past</a>
	</div>

	<div class="rise" style="--i: 1">
		<DataTable rows={data.classes} {columns} rowHref={(c) => `/admin/live/${c.id}`}>
			{#snippet empty()}
				<div class="empty">
					<div class="empty-icon"><Radio /></div>
					<h3>{data.view === 'past' ? 'No past classes yet' : 'No classes scheduled'}</h3>
					<p>{data.view === 'past' ? 'Ended and cancelled classes show here.' : 'Schedule a class and students see it on their Live tab.'}</p>
					{#if data.view === 'upcoming'}<button class="btn btn-primary" onclick={() => (scheduling = true)}><Plus /> Schedule class</button>{/if}
				</div>
			{/snippet}
		</DataTable>
	</div>
</div>

<Sheet bind:open={scheduling} title="Schedule a live class" description="Students see it on their Live tab right away.">
	{#if scheduling}
		<LiveForm action="?/create" options={data.options} submitLabel="Schedule class" ondone={() => (scheduling = false)} />
	{/if}
</Sheet>
