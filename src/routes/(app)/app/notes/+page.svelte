<script lang="ts">
	import { page } from '$app/state';
	import { Bookmark, FileText, NotebookText } from '@lucide/svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';

	let { data } = $props();
	const tabHref = (tab: string) => {
		const u = new URL(page.url.href);
		if (tab === 'all') u.searchParams.delete('tab');
		else u.searchParams.set('tab', tab);
		return u.pathname + u.search;
	};
	const filters = $derived(
		[
			{ key: 'exam', label: 'Exam', options: data.exams },
			{ key: 'subject', label: 'Subject', options: data.subjects }
		].filter((f) => f.options.length > 1)
	);
</script>

<svelte:head><title>Notes · UCI</title></svelte:head>

<div class="page-narrow pb-10 stack">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Notes</h1>
			<p class="page-sub">Short, exam-focused notes from UCI teachers.</p>
		</div>
	</header>

	<nav class="segmented" aria-label="Notes">
		<a href={tabHref('all')} aria-current={data.tab === 'all' ? 'page' : undefined} data-sveltekit-replacestate data-sveltekit-noscroll>All notes</a>
		<a href={tabHref('saved')} aria-current={data.tab === 'saved' ? 'page' : undefined} data-sveltekit-replacestate data-sveltekit-noscroll>
			Saved{#if data.savedCount}<span class="seg-count">{data.savedCount}</span>{/if}
		</a>
	</nav>

	<FilterBar placeholder="Search notes" {filters} />

	{#if data.notes.length}
		<div class="list rise" style="--i: 1">
			{#each data.notes as n (n.id)}
				<a class="list-row" href="/app/notes/{n.slug}">
					<span class="leading-icon"><NotebookText /></span>
					<span class="grow">
						<span class="title block">{n.title}</span>
						{#if n.summary}<span class="meta block line-clamp-2">{n.summary}</span>{/if}
						<span class="tiny muted block mt-1">
							{[n.subjectId && data.names[n.subjectId], n.examId && data.names[n.examId]].filter(Boolean).join(' · ')}{n.subjectId || n.examId ? ' · ' : ''}<span class="tabular">{n.readingMinutes}</span> min read
						</span>
					</span>
					<span class="trail flex items-center gap-1.5 muted">
						{#if n.hasPdf}<FileText class="size-4" aria-label="Has PDF" />{/if}
						{#if n.bookmarked}<Bookmark class="size-4 fill-current text-primary" aria-label="Saved" />{/if}
					</span>
				</a>
			{/each}
		</div>
	{:else if data.tab === 'saved'}
		<EmptyState icon={Bookmark} title="No saved notes" body="Tap the bookmark on any note to keep it here for revision." />
	{:else}
		<EmptyState icon={NotebookText} title="No notes match" body="Try a different search or clear the filters." />
	{/if}
</div>
