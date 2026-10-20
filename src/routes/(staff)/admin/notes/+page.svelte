<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { toast } from '#lib/components/ui';
	import { enhance } from '$app/forms';
	import { FileText, NotebookText, Plus } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import { withToast } from '#lib/features/courses/components/admin/submit';

	let { data } = $props();

	onMount(() => {
		if (!page.url.searchParams.has('deleted')) return;
		toast('Note deleted');
		const u = new URL(page.url.href);
		u.searchParams.delete('deleted');
		replaceState(u, page.state);
	});
	type Row = (typeof data.rows)[number];

	const filters = $derived([
		{ key: 'exam', label: 'Exam', options: data.exams.map((e) => ({ value: e.value, label: e.label })) },
		{ key: 'subject', label: 'Subject', options: data.subjects },
		{ key: 'status', label: 'Status', options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }
	]);
	const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
</script>

<svelte:head><title>Notes · UCI staff</title></svelte:head>

<div class="page stack">
	<PageHeader title="Notes" subtitle="Markdown study notes with maths, and optional PDFs." crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<a href="/admin/notes/new" class="btn btn-primary"><Plus aria-hidden="true" />New note</a>
		{/snippet}
	</PageHeader>

	<FilterBar search placeholder="Search notes" {filters} />

	{#snippet titleCell(r: Row)}
		<span class="block min-w-0">
			<span class="flex items-center gap-1.5 font-semibold">
				<span class="truncate">{r.title}</span>
				{#if r.hasPdf}<FileText class="size-4 flex-none text-muted-foreground" aria-label="Has PDF" />{/if}
			</span>
			<span class="flex items-center gap-1.5 text-sm text-muted-foreground">
				<span class="badge {r.published ? 'badge-success' : 'badge-draft'} flex-none md:hidden">{r.published ? 'Published' : 'Draft'}</span>
				<span class="truncate">{[r.examName, r.subjectName].filter(Boolean).join(' · ') || 'No exam'} · {r.readingMinutes} min · {date(r.updatedAt)}</span>
			</span>
		</span>
	{/snippet}
	{#snippet statusCell(r: Row)}
		<form method="POST" action="?/publish" class="inline-flex flex-wrap items-center gap-1.5" use:enhance={withToast(null)}>
			<input type="hidden" name="id" value={r.id} />
			<input type="hidden" name="on" value={String(!r.published)} />
			<span class="badge {r.published ? 'badge-success' : 'badge-draft'}">{r.published ? 'Published' : 'Draft'}</span>
			{#if r.paid}<span class="badge badge-primary">Paid</span>{/if}
			<button class="btn btn-ghost btn-sm">{r.published ? 'Unpublish' : 'Publish'}</button>
		</form>
	{/snippet}
	{#snippet emptyState()}
		{#if data.filtered}
			<EmptyState icon={NotebookText} title="No note matches" body="Try another exam or subject, or clear the filters." compact />
		{:else}
			<EmptyState icon={NotebookText} title="No notes yet" body="Write one in Markdown, or upload a .md file or a PDF." compact>
				{#snippet action()}<a href="/admin/notes/new" class="btn btn-primary">Write the first note</a>{/snippet}
			</EmptyState>
		{/if}
	{/snippet}

	<DataTable
		rows={data.rows}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/notes/${r.id}`}
		empty={emptyState}
		columns={[
			{ key: 'title', label: 'Note', cell: titleCell },
			{ key: 'subjectName', label: 'Subject', hideOnPhone: true },
			{ key: 'published', label: 'Status', cell: statusCell, hideOnPhone: true }
		]}
	/>
</div>
