<script lang="ts">
	import { CalendarX, ChevronRight, Clock, Download, Flame, ListChecks } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import { fmtDay } from '#lib/features/posts/format';

	let { data } = $props();
	const f = $derived(data.feed);
	const isToday = $derived(f.selected === f.today);
	const dayName = $derived(isToday ? 'today' : fmtDay(f.selected, { day: 'numeric', month: 'short' }));

	/** Keep the chosen day in view; the strip ends at today on the right. */
	function reveal(strip: HTMLElement, _sel: string) {
		const go = () => {
			const el = strip.querySelector<HTMLElement>('[aria-current="date"]');
			strip.scrollLeft = el ? el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2 : strip.scrollWidth;
		};
		go();
		return { update: go };
	}
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

	<nav class="strip" aria-label="Pick a day" use:reveal={f.selected}>
		{#each f.strip as d (d.date)}
			<a
				href="?d={d.date}"
				class="day"
				class:has-post={d.hasPost}
				aria-current={d.date === f.selected ? 'date' : undefined}
				data-sveltekit-noscroll
				data-sveltekit-replacestate
				aria-label="{fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}{d.hasPost ? '' : ', no post'}{d.done ? ', quiz done' : ''}"
			>
				<span class="dow">{d.date === f.today ? 'Today' : fmtDay(d.date, { weekday: 'short' })}</span>
				<span class="num font-mono tabular">{Number(d.date.slice(8))}</span>
				<span class="mark" class:done={d.done} aria-hidden="true"></span>
			</a>
		{/each}
	</nav>

	{#if f.post}
		{@const p = f.post}
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
						<p class="font-semibold">{isToday ? "Today's quiz" : `Quiz for ${dayName}`}</p>
						<p class="text-sm text-muted-foreground">10 quick questions on this page. Keeps your streak going.</p>
					{/if}
				</div>
				{#if q.status === 'done' && q.attemptId}
					<a class="btn btn-secondary btn-sm flex-none" href="/app/results/{q.attemptId}">Result<ChevronRight class="size-4" aria-hidden="true" /></a>
				{:else}
					<a class="btn btn-primary btn-sm flex-none" href="/app/tests/{q.testId}">{q.status === 'in_progress' ? 'Continue quiz' : isToday ? "Take today's quiz" : 'Take quiz'}</a>
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
				<a class="btn btn-secondary btn-sm pdf" href="/api/files/{p.fileId}" target="_blank" rel="noopener"><Download class="size-4" aria-hidden="true" />Download PDF</a>
			{/if}
			{#if p.html}<Markdown html={p.html} />{/if}
		</article>
	{:else}
		<EmptyState
			icon={CalendarX}
			title={isToday ? "Today's current affairs are not up yet" : `Nothing posted for ${dayName}`}
			body={isToday ? 'They usually go up by the morning. Pick an earlier day meanwhile.' : 'Pick another day from the strip above.'}
		/>
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
	.strip {
		display: flex;
		gap: 0.375rem;
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: 1rem;
		padding: 0.25rem 0;
	}
	/* Phones: let the strip run edge to edge so it reads as scrollable. */
	@media (max-width: 767px) {
		.strip {
			margin-inline: calc(-1 * var(--gutter));
			padding-inline: var(--gutter);
		}
	}
	.strip::-webkit-scrollbar {
		display: none;
	}
	.day {
		flex: none;
		display: grid;
		justify-items: center;
		gap: 0.125rem;
		min-width: 3.25rem;
		padding: 0.5rem 0.25rem 0.375rem;
		border: 1px solid hsl(var(--border));
		border-radius: 12px;
		background: hsl(var(--surface));
		color: hsl(var(--muted-foreground));
		text-decoration: none;
	}
	.day.has-post {
		color: hsl(var(--foreground));
	}
	.day[aria-current='date'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
	.dow {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.num {
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.2;
	}
	/* OMR-style mark: hollow = posted, filled = quiz done, invisible = nothing that day. */
	.mark {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		border: 1.5px solid transparent;
	}
	.has-post .mark {
		border-color: currentColor;
	}
	.mark.done {
		background: currentColor;
		border-color: currentColor;
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
	.pdf {
		margin-bottom: 1rem;
	}
</style>
