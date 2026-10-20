<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { FileText, ListChecks, Newspaper, Plus } from '@lucide/svelte';
	import { toast } from '#lib/components/ui';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import { withToast } from '#lib/features/courses/components/admin/submit';
	import { fmtDay, istDate, kindLabel } from '#lib/features/posts/format';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	onMount(() => {
		if (!page.url.searchParams.has('deleted')) return;
		toast('Post deleted');
		const u = new URL(page.url.href);
		u.searchParams.delete('deleted');
		replaceState(u, page.state);
	});

	const filters = [
		{
			key: 'kind',
			label: 'Type',
			options: (['current_affairs', 'job_alert', 'syllabus'] as const).map((k) => ({ value: k, label: kindLabel[k] }))
		},
		{ key: 'status', label: 'Status', options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }
	];
	const today = istDate();
	const todayCa = $derived(data.rows.find((r) => r.kind === 'current_affairs' && r.publishedOn === today));
	const day = (d: string) => (d === today ? 'Today' : fmtDay(d, { day: 'numeric', month: 'short' }));
</script>

<svelte:head><title>Daily posts · UCI staff</title></svelte:head>

<div class="page stack">
	<PageHeader title="Daily posts" subtitle="Current affairs with a daily AI quiz, job alerts and exam syllabus pages." crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<a href="/admin/posts/new" class="btn btn-primary"><Plus aria-hidden="true" />New post</a>
		{/snippet}
	</PageHeader>

	{#if !data.filtered}
		<a class="card card-pad today rise" href={todayCa ? `/admin/posts/${todayCa.id}` : '/admin/posts/new?kind=current_affairs'}>
			<span class="today-icon"><Newspaper aria-hidden="true" /></span>
			<span class="min-w-0 flex-1">
				<span class="eyebrow">Today, {fmtDay(today, { day: 'numeric', month: 'short' })}</span>
				<span class="block truncate font-semibold">
					{#if !todayCa}Write today's current affairs{:else if !todayCa.quizTestId}{todayCa.title}: generate the quiz{:else}{todayCa.title}{/if}
				</span>
				<span class="block text-sm text-muted-foreground">
					{#if !todayCa}Paste the summary; the AI drafts a 10-question quiz from it.{:else if todayCa.quizTestId}Quiz is live for students.{:else}{todayCa.published ? 'Published' : 'Draft'} · no quiz yet{/if}
				</span>
			</span>
			<span class="btn btn-secondary btn-sm flex-none">{todayCa ? 'Open' : 'Write'}</span>
		</a>
	{/if}

	<FilterBar search={false} {filters} />

	{#snippet titleCell(r: Row)}
		<span class="block min-w-0">
			<span class="flex items-center gap-1.5 font-semibold">
				<span class="truncate">{r.title}</span>
				{#if r.fileId}<FileText class="size-4 flex-none text-muted-foreground" aria-label="Has PDF" />{/if}
				{#if r.quizTestId}<ListChecks class="size-4 flex-none text-success" aria-label="Has quiz" />{/if}
			</span>
			<span class="flex items-center gap-1.5 text-sm text-muted-foreground">
				<span class="badge {r.published ? 'badge-success' : 'badge-draft'} flex-none md:hidden">{r.published ? 'Published' : 'Draft'}</span>
				<span class="truncate">{kindLabel[r.kind]} · {day(r.publishedOn)}{r.examName ? ` · ${r.examName}` : ''}</span>
			</span>
		</span>
	{/snippet}
	{#snippet statusCell(r: Row)}
		<form method="POST" action="?/publish" class="inline-flex items-center gap-1.5" use:enhance={withToast(null)}>
			<input type="hidden" name="id" value={r.id} />
			<input type="hidden" name="on" value={String(!r.published)} />
			<span class="badge {r.published ? 'badge-success' : 'badge-draft'}">{r.published ? 'Published' : 'Draft'}</span>
			<button class="btn btn-ghost btn-sm">{r.published ? 'Unpublish' : 'Publish'}</button>
		</form>
	{/snippet}
	{#snippet emptyState()}
		{#if data.filtered}
			<EmptyState icon={Newspaper} title="No post matches" body="Try another type, or clear the filters." compact />
		{:else}
			<EmptyState icon={Newspaper} title="No posts yet" body="Start with today's current affairs; the quiz is one click after." compact />
		{/if}
	{/snippet}

	<DataTable
		rows={data.rows}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/posts/${r.id}`}
		empty={emptyState}
		columns={[
			{ key: 'title', label: 'Post', cell: titleCell },
			{ key: 'published', label: 'Status', cell: statusCell, hideOnPhone: true }
		]}
	/>
</div>

<style>
	.today {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		text-decoration: none;
		color: inherit;
	}
	.today-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 10px;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
</style>
