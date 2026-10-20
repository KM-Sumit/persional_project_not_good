<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { toast } from '#lib/components/ui';
	import { Plus, PlaySquare } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';

	let { data } = $props();

	onMount(() => {
		if (!page.url.searchParams.has('deleted')) return;
		toast('Course deleted');
		const u = new URL(page.url.href);
		u.searchParams.delete('deleted');
		replaceState(u, page.state);
	});
	type Row = (typeof data.rows)[number];

	const filters = $derived([
		{ key: 'exam', label: 'Exam', options: data.exams.map((e) => ({ value: e.value, label: e.label })) },
		{ key: 'status', label: 'Status', options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] },
		{ key: 'access', label: 'Access', options: [{ value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }] }
	]);
	const hours = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.round(s / 60)}m`);
	const initials = (t: string) =>
		t
			.split(/\s+/)
			.filter((w) => /^[A-Za-z0-9]/.test(w))
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('');
	const cover = (r: Row) => (r.coverFileId ? `/api/files/${r.coverFileId}` : r.coverUrl);
</script>

<svelte:head><title>Courses · UCI staff</title></svelte:head>

<div class="page stack">
	<PageHeader title="Courses" subtitle="{data.total} course{data.total === 1 ? '' : 's'}: video, reading and PDF lessons in chapters." crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<a href="/admin/courses/new" class="btn btn-primary"><Plus aria-hidden="true" />New course</a>
		{/snippet}
	</PageHeader>

	<FilterBar search placeholder="Search courses" {filters} />

	{#snippet titleCell(r: Row)}
		<span class="flex min-w-0 items-center gap-3">
			<span class="thumb">
				{#if cover(r)}<img src={cover(r)} alt="" loading="lazy" />{:else}<span class="initials" aria-hidden="true">{initials(r.title)}</span>{/if}
			</span>
			<span class="min-w-0">
				<span class="block truncate font-semibold">{r.title}</span>
				<span class="hidden truncate text-sm text-muted-foreground md:block">{r.summary || r.instructor}</span>
				<span class="flex items-center gap-1.5 text-sm text-muted-foreground md:hidden">
					<span class="font-mono tabular">{r.lessonCount}</span> lessons{#if r.paid} · Paid{/if}
					<span class="badge {r.published ? 'badge-success' : 'badge-draft'}">{r.published ? 'Published' : 'Draft'}</span>
				</span>
			</span>
		</span>
	{/snippet}
	{#snippet statusCell(r: Row)}
		<span class="flex flex-wrap gap-1.5">
			<span class="badge {r.published ? 'badge-success' : 'badge-draft'}">{r.published ? 'Published' : 'Draft'}</span>
			{#if r.paid}<span class="badge badge-primary">Paid</span>{/if}
			{#if r.batchId}<span class="badge">Batch only</span>{/if}
		</span>
	{/snippet}
	{#snippet lessonsCell(r: Row)}
		<span class="font-mono tabular">{r.lessonCount}</span>{#if r.durationSec}<span class="text-muted-foreground"> · {hours(r.durationSec)}</span>{/if}
	{/snippet}
	{#snippet emptyState()}
		{#if data.total}
			<EmptyState icon={PlaySquare} title="No course matches" body="Try another exam or clear the filters." compact />
		{:else}
			<EmptyState icon={PlaySquare} title="No courses yet" body="Create one, then paste a few YouTube links as lessons." compact>
				{#snippet action()}<a href="/admin/courses/new" class="btn btn-primary">Create the first course</a>{/snippet}
			</EmptyState>
		{/if}
	{/snippet}

	<DataTable
		rows={data.rows}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/courses/${r.id}`}
		empty={emptyState}
		columns={[
			{ key: 'title', label: 'Course', cell: titleCell },
			{ key: 'examName', label: 'Exam', hideOnPhone: true },
			{ key: 'lessonCount', label: 'Lessons', cell: lessonsCell, align: 'right', hideOnPhone: true },
			{ key: 'published', label: 'Status', cell: statusCell, hideOnPhone: true }
		]}
	/>
</div>

<style>
	.thumb {
		display: grid;
		place-items: center;
		flex: none;
		width: 4.5rem;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
	.initials {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.125rem;
		letter-spacing: -0.02em;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
