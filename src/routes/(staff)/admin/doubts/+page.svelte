<script lang="ts">
	import { page } from '$app/state';
	import { ImageIcon, MessageCircleQuestion } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Tabs } from '#lib/components/ui';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import { ago } from '#lib/features/courses/components/format';

	let { data } = $props();
	type Row = (typeof data.doubts)[number];

	/** Status tabs keep the search and exam filters. */
	const tabHref = (s: string) => {
		const u = new URLSearchParams(page.url.search);
		u.delete('cursor');
		if (s === 'open') u.delete('status');
		else u.set('status', s);
		const q = u.toString();
		return `/admin/doubts${q ? `?${q}` : ''}`;
	};
	const tabs = $derived([
		{ value: 'open', label: 'Open', href: tabHref('open'), count: data.open },
		{ value: 'answered', label: 'Answered', href: tabHref('answered') },
		{ value: 'all', label: 'All', href: tabHref('all') }
	]);
</script>

<svelte:head><title>Doubts · UCI staff</title></svelte:head>

<div class="page">
	<PageHeader title="Doubts" subtitle={data.open ? `${data.open} waiting for an answer.` : 'All doubts answered.'} />

	<div class="mb-3"><Tabs items={tabs} value={data.status} label="Doubt status" /></div>
	<div class="mb-4"><FilterBar placeholder="Search doubts or students" filters={[{ key: 'exam', label: 'Exam', options: data.examOptions }]} /></div>

	{#snippet doubt(d: Row)}
		<span class="block font-medium line-clamp-2 body">{d.body}</span>
		{#if d.imageUrl || d.context}
			<span class="flex items-center gap-1.5 tiny muted min-w-0">
				{#if d.imageUrl}<ImageIcon class="size-3.5 shrink-0" aria-label="Has photo" />{/if}
				{#if d.context}<span class="truncate">{d.context}</span>{:else}<span>Photo attached</span>{/if}
			</span>
		{/if}
	{/snippet}
	{#snippet student(d: Row)}
		<span class="block small font-semibold truncate">{d.student.name}</span>
		<span class="block tiny muted truncate">{d.exam ?? '–'}</span>
	{/snippet}
	{#snippet asked(d: Row)}<span class="small muted whitespace-nowrap">{ago(d.createdAt, data.now)}</span>{/snippet}
	{#snippet status(d: Row)}
		{#if d.status === 'open'}<Badge tone="warning">Open</Badge>{:else if d.status === 'answered'}<Badge tone="success">Answered</Badge>{:else}<Badge tone="closed">Read</Badge>{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState
			icon={MessageCircleQuestion}
			title={data.status === 'open' ? 'No open doubts' : 'No doubts match'}
			body={data.status === 'open' ? 'New doubts from students land here.' : 'Try another filter or clear the search.'}
		/>
	{/snippet}

	<DataTable
		rows={data.doubts}
		getId={(d) => d.id}
		rowHref={(d) => `/admin/doubts/${d.id}`}
		nextCursor={data.next}
		{empty}
		columns={[
			{ key: 'body', label: 'Doubt', cell: doubt },
			{ key: 'student', label: 'Student', cell: student },
			{ key: 'createdAt', label: 'Asked', cell: asked },
			{ key: 'status', label: 'Status', cell: status, align: 'right' }
		]}
	/>
</div>

<style>
	.body {
		overflow-wrap: anywhere;
	}
</style>
