<script lang="ts">
	import { ClipboardList, NotebookText } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import CourseCard from '#lib/features/courses/components/CourseCard.svelte';
	import { when } from '#lib/features/courses/components/format';

	let { data } = $props();
	const e = $derived(data.exam);
</script>

<svelte:head><title>{e.name} · UCI</title></svelte:head>

<div class="page pb-10 stack-lg">
	<PageHeader title={e.name} eyebrow={e.categoryName} subtitle={e.description || undefined} crumbs={[{ href: '/app', label: 'Home' }]}>
		{#snippet actions()}
			{#if data.isTarget}<span class="badge badge-primary">Your exam</span>{/if}
		{/snippet}
	</PageHeader>

	<section class="rise" style="--i: 1">
		<div class="section-head"><h2 class="section-title">Tests</h2><a class="section-link" href="/app/tests">All tests</a></div>
		{#if data.tests.length}
			<div class="list">
				{#each data.tests as t (t.id)}
					<a class="list-row" href="/app/tests/{t.id}">
						<span class="leading-icon"><ClipboardList /></span>
						<span class="grow">
							<span class="title block">{t.title}</span>
							<span class="meta block">
								{t.window === 'upcoming' && t.startsAt ? `Starts ${when(t.startsAt)}` : `${t.questionCount} questions · ${t.durationMin} min`}
							</span>
						</span>
						{#if t.window === 'live' && t.kind === 'live'}<span class="trail"><span class="badge badge-live">Live</span></span>{/if}
					</a>
				{/each}
			</div>
		{:else}
			<div class="card card-pad muted small">No open tests for {e.name} right now.</div>
		{/if}
	</section>

	<section class="rise" style="--i: 2">
		<div class="section-head"><h2 class="section-title">Courses</h2><a class="section-link" href="/app/learn?exam={e.id}">Learn</a></div>
		{#if data.courses.length}
			<div class="grid-courses">{#each data.courses as c (c.id)}<CourseCard course={c} progress={c.progress} exam={e.name} />{/each}</div>
		{:else}
			<div class="card card-pad muted small">Courses for {e.name} are coming soon.</div>
		{/if}
	</section>

	<section class="rise" style="--i: 3">
		<div class="section-head"><h2 class="section-title">Notes</h2><a class="section-link" href="/app/notes?exam={e.id}">All notes</a></div>
		{#if data.notes.length}
			<div class="list">
				{#each data.notes as n (n.id)}
					<a class="list-row" href="/app/notes/{n.slug}">
						<span class="leading-icon"><NotebookText /></span>
						<span class="grow"><span class="title block">{n.title}</span><span class="meta block"><span class="tabular">{n.readingMinutes}</span> min read</span></span>
					</a>
				{/each}
			</div>
		{:else}
			<div class="card card-pad muted small">No notes for {e.name} yet.</div>
		{/if}
	</section>
</div>

<style>
	.grid-courses {
		display: grid;
		gap: 0.875rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
	}
</style>
