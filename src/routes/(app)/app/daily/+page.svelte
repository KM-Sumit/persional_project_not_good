<script lang="ts">
	import { CalendarX, ChevronLeft, ChevronRight, Clock, Flame, ListChecks } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import PdfViewer from '#lib/components/kit/PdfViewer.svelte';
	import { fmtDay } from '#lib/features/posts/format';

	let { data } = $props();
	const f = $derived(data.feed);
	const monthLabel = $derived(fmtDay(`${f.month}-01`, { month: 'long', year: 'numeric' }));
</script>

<svelte:head><title>Current affairs · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<PageHeader title="Current affairs" crumbs={[{ href: '/app', label: 'Home' }]}>
		{#snippet actions()}
			{#if f.streak > 0}
				<span class="streak" title="Days in a row with a daily quiz done">
					<Flame class="size-4" aria-hidden="true" /><span class="font-mono tabular">{f.streak}</span>-day streak
				</span>
			{/if}
		{/snippet}
	</PageHeader>

	{#if f.months.length}
		<nav class="months" aria-label="Pick a month">
			{#each f.months as m (m.value)}
				<a href="?m={m.value}" aria-current={m.value === f.month ? 'true' : undefined} data-sveltekit-noscroll>
					{fmtDay(`${m.value}-01`, { month: 'short', year: 'numeric' })}
					<span class="count font-mono tabular">{m.count}</span>
				</a>
			{/each}
		</nav>
	{/if}

	{#if f.post}
		{@const p = f.post}
		<a class="back" href="?m={f.month}"><ChevronLeft class="size-4" aria-hidden="true" />{monthLabel}</a>
		{#if f.quiz}
			{@const q = f.quiz}
			<section class="card card-pad quiz rise" aria-label="Daily quiz">
				<span class="quiz-icon" class:done={q.status === 'done'}><ListChecks aria-hidden="true" /></span>
				<div class="min-w-0 flex-1">
					{#if q.status === 'done'}
						<p class="font-semibold">Quiz done</p>
						<p class="text-sm text-muted-foreground">
							{#if q.score != null}Score <span class="font-mono tabular">{q.score}</span> · {/if}see answers and your rank
						</p>
					{:else}
						<p class="font-semibold">Quiz for {fmtDay(p.publishedOn, { day: 'numeric', month: 'short' })}</p>
						<p class="text-sm text-muted-foreground">10 quick questions on this page. Keeps your streak going.</p>
					{/if}
				</div>
				{#if q.status === 'done' && q.attemptId}
					<a class="btn btn-secondary btn-sm flex-none" href="/app/results/{q.attemptId}">Result<ChevronRight class="size-4" aria-hidden="true" /></a>
				{:else}
					<a class="btn btn-primary btn-sm flex-none" href="/app/tests/{q.testId}">{q.status === 'in_progress' ? 'Continue quiz' : 'Take quiz'}</a>
				{/if}
			</section>
		{/if}

		<article class="post rise" style="--i: 1">
			<h2 class="post-title">{p.title}</h2>
			<p class="meta">
				<span>{fmtDay(p.publishedOn)}</span>
				{#if p.examName}<span>{p.examName}</span>{/if}
				<span class="inline-flex items-center gap-1"><Clock class="size-3.5" aria-hidden="true" />{p.readingMinutes} min</span>
			</p>
			{#if p.fileId}
				<PdfViewer src="/api/files/{p.fileId}" title={p.title} />
			{/if}
			{#if p.html}<Markdown html={p.html} />{/if}
		</article>
	{:else if f.posts.length}
		<h2 class="month-title">{monthLabel}</h2>
		<ul class="list">
			{#each f.posts as p (p.id)}
				<li>
					<a class="row" href="?m={f.month}&p={p.slug}">
						<span class="when">
							<span class="num font-mono tabular">{Number(p.publishedOn.slice(8))}</span>
							<span class="dow">{fmtDay(p.publishedOn, { month: 'short' })}</span>
						</span>
						<span class="min-w-0 flex-1">
							<span class="title">{p.title}</span>
							{#if p.examName}<span class="exam">{p.examName}</span>{/if}
						</span>
						{#if p.quiz?.status === 'done'}<span class="badge">Quiz done</span>{/if}
						<ChevronRight class="size-4 flex-none text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState icon={CalendarX} title="Nothing posted this month" body="Pick another month, or check back when a new post is published." />
	{/if}
</div>

<style>
	.streak {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 999px;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.months {
		display: flex;
		gap: 0.375rem;
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: 1rem;
		padding: 0.25rem 0;
	}
	.months::-webkit-scrollbar {
		display: none;
	}
	.months a {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		background: hsl(var(--surface));
		color: hsl(var(--foreground));
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 650;
	}
	.months a[aria-current='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
	.count {
		font-size: 0.75rem;
		opacity: 0.75;
	}
	.month-title {
		font-size: 1.125rem;
		margin-bottom: 0.75rem;
	}
	.list {
		list-style: none;
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 1rem;
		background: hsl(var(--surface));
		color: inherit;
		text-decoration: none;
	}
	.when {
		display: grid;
		justify-items: center;
		min-width: 2.75rem;
		line-height: 1.1;
	}
	.num {
		font-size: 1.125rem;
		font-weight: 700;
	}
	.dow {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.title {
		display: block;
		font-weight: 650;
		line-height: 1.3;
	}
	.exam {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.badge {
		flex: none;
		font-size: 0.6875rem;
		font-weight: 700;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		background: hsl(var(--success) / 0.12);
		color: hsl(var(--success));
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		font-weight: 650;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
	}
	.quiz {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 0.875rem;
		margin-bottom: 1.25rem;
	}
	.quiz-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 10px;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
	.quiz-icon.done {
		background: hsl(var(--success) / 0.12);
		color: hsl(var(--success));
	}
	.post-title {
		font-size: 1.375rem;
		line-height: 1.25;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.875rem;
		margin: 0.375rem 0 1rem;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
</style>
