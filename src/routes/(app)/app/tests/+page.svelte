<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { ClipboardList, KeyRound, Search, X } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import TestRow from '#lib/features/tests/components/TestRow.svelte';
	import { Countdown } from '#lib/components/kit';
	import type { CatalogCard, TestKind } from '#lib/features/tests/schema';

	let { data } = $props();

	const TABS: { key: Exclude<TestKind, 'live'>; label: string }[] = [
		{ key: 'practice', label: 'Practice' },
		{ key: 'mock', label: 'Mock' },
		{ key: 'pyq', label: 'PYQ' }
	];

	const examName = $derived(new Map(data.exams.map((e) => [e.id, e.name])));
	const exam = $derived.by(() => {
		const q = page.url.searchParams.get('exam');
		if (q) return q;
		return data.targetExamId && examName.has(data.targetExamId) ? data.targetExamId : 'all';
	});
	const tab = $derived((TABS.find((t) => t.key === page.url.searchParams.get('tab'))?.key ?? 'practice') as Exclude<TestKind, 'live'>);
	let q = $state('');

	const href = (p: { exam?: string; tab?: string }) => {
		const sp = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(p)) sp.set(k, v);
		return `?${sp}`;
	};

	const matches = (c: CatalogCard) =>
		(exam === 'all' || c.examId === exam) && (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()));
	const scoped = $derived(data.cards.filter(matches));
	const scheduled = $derived(
		scoped
			.filter((c) => c.window !== 'ended' && (c.kind === 'live' || c.window === 'upcoming'))
			.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
	);
	const scheduledIds = $derived(new Set(scheduled.map((c) => c.id)));
	const byKind = (k: TestKind) => scoped.filter((c) => c.kind === k && !scheduledIds.has(c.id));
	const counts = $derived(Object.fromEntries(TABS.map((t) => [t.key, byKind(t.key).length])) as Record<string, number>);
	const list = $derived(byKind(tab));

	// PYQ: exam -> year (newest first) -> papers.
	const pyqGroups = $derived.by(() => {
		const groups = new Map<string, Map<string, CatalogCard[]>>();
		for (const c of list) {
			const e = (c.examId && examName.get(c.examId)) || 'Other papers';
			const y = c.year ? String(c.year) : 'Year not set';
			const ys = groups.get(e) ?? new Map();
			ys.set(y, [...(ys.get(y) ?? []), c]);
			groups.set(e, ys);
		}
		return [...groups].map(([name, ys]) => ({ name, years: [...ys].sort((a, b) => b[0].localeCompare(a[0])) }));
	});

	const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' });
	const mon = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' });
	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
</script>

<svelte:head><title>Tests · UCI</title></svelte:head>

<div class="page">
	<PageHeader title="Tests" subtitle="Live tests, practice sets, mocks and previous papers." />

	<div class="filters">
		<label class="search">
			<Search aria-hidden="true" />
			<input class="input" type="search" placeholder="Search tests" bind:value={q} aria-label="Search tests" />
			{#if q}<button type="button" class="icon-btn icon-btn-sm" aria-label="Clear search" onclick={() => (q = '')}><X /></button>{/if}
		</label>
		{#if data.exams.length > 1}
			<nav class="chips" aria-label="Exam">
				<a class="chip" aria-current={exam === 'all' ? 'true' : undefined} href={href({ exam: 'all' })} data-sveltekit-noscroll data-sveltekit-replacestate>All exams</a>
				{#each data.exams as e (e.id)}
					<a class="chip" aria-current={exam === e.id ? 'true' : undefined} href={href({ exam: e.id })} data-sveltekit-noscroll data-sveltekit-replacestate>{e.name}</a>
				{/each}
			</nav>
		{/if}
	</div>

	{#if scheduled.length}
		<section class="mt-6" aria-labelledby="sched-h">
			<div class="section-head"><h2 id="sched-h" class="section-title">Live and upcoming</h2></div>
			<div class="admit-list">
				{#each scheduled as c, i (c.id)}
					<a class="admit card rise" style="--i: {i}" href={c.inProgressAttemptId ? `/app/tests/${c.id}/attempt/${c.inProgressAttemptId}` : `/app/tests/${c.id}`}>
						<div class="stub" aria-hidden={!c.startsAt}>
							{#if c.startsAt}
								<span class="d font-mono">{day(c.startsAt)}</span><span class="m">{mon(c.startsAt)}</span>
							{:else}
								<ClipboardList />
							{/if}
						</div>
						<div class="body">
							<div class="flex flex-wrap items-center gap-2">
								{#if c.window === 'live'}<span class="badge badge-live">Live now</span>{:else}<span class="badge">Upcoming</span>{/if}
								{#if c.lock === 'password'}<span class="badge"><KeyRound class="size-3" />Password</span>{/if}
								{#if c.inProgressAttemptId}<span class="badge badge-primary">Resume</span>{/if}
							</div>
							<p class="title">{c.title}</p>
							<p class="meta tabular">
								{#if c.startsAt}{time(c.startsAt)} IST{" · "}{/if}{c.questionCount} Q · {c.durationMin} min
							</p>
						</div>
						<div class="when">
							{#if c.window === 'upcoming' && c.startsAt}
								<span class="tiny muted">Opens in</span>
								<b><Countdown to={c.startsAt} serverNow={data.serverNow} warnAt={0} onend={() => invalidateAll()} /></b>
							{:else if c.window === 'live' && c.endsAt}
								<span class="tiny muted">Closes in</span>
								<b><Countdown to={c.endsAt} serverNow={data.serverNow} warnAt={900} onend={() => invalidateAll()} /></b>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mt-6" aria-label="Test library">
		<div class="segmented" role="tablist" aria-label="Test type">
			{#each TABS as t (t.key)}
				<a role="tab" aria-selected={tab === t.key} href={href({ tab: t.key })} data-sveltekit-noscroll data-sveltekit-replacestate>
					{t.label}{#if counts[t.key]}<span class="seg-count tabular">{counts[t.key]}</span>{/if}
				</a>
			{/each}
		</div>

		<div class="mt-4">
			{#if !list.length}
				<div class="empty card">
					<div class="empty-icon"><ClipboardList /></div>
					<h3>{q ? 'No tests match your search' : `No ${tab === 'pyq' ? 'previous papers' : tab === 'mock' ? 'mock tests' : 'practice sets'} yet`}</h3>
					<p>
						{#if q}Try a shorter word, or clear the search.{:else if exam !== 'all'}Try another exam, or see tests for all exams.{:else}New tests appear here as soon as the institute publishes them.{/if}
					</p>
					{#if q}
						<button type="button" class="btn btn-secondary" onclick={() => (q = '')}>Clear search</button>
					{:else if exam !== 'all'}
						<a class="btn btn-secondary" href={href({ exam: 'all' })} data-sveltekit-noscroll data-sveltekit-replacestate>Show all exams</a>
					{/if}
				</div>
			{:else if tab === 'pyq'}
				{#each pyqGroups as g (g.name)}
					<h3 class="group-h">{g.name}</h3>
					{#each g.years as [year, papers] (year)}
						<p class="eyebrow year">{year}</p>
						<div class="list">
							{#each papers as t, i (t.id)}<TestRow {t} {i} />{/each}
						</div>
					{/each}
				{/each}
			{:else}
				<div class="list">
					{#each list as t, i (t.id)}<TestRow {t} {i} />{/each}
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	.filters { display: grid; gap: 0.75rem; margin-top: 1rem; }
	.search { position: relative; display: block; }
	.search > :global(svg) { position: absolute; left: 0.875rem; top: 50%; translate: 0 -50%; width: 18px; height: 18px; color: hsl(var(--muted-foreground)); pointer-events: none; }
	.search .input { padding-left: 2.5rem; padding-right: 2.75rem; }
	.search .icon-btn { position: absolute; right: 0.25rem; top: 50%; translate: 0 -50%; }
	@media (min-width: 768px) {
		.filters { grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); align-items: center; }
		.chips { margin: 0; padding: 0; }
	}

	.admit-list { display: grid; gap: 0.625rem; }
	@media (min-width: 768px) { .admit-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	/* Admit-card ticket: a date stub torn off by a dashed perforation. */
	.admit { display: flex; align-items: stretch; overflow: hidden; }
	.stub {
		display: grid; place-content: center; justify-items: center;
		width: 4.25rem; flex-shrink: 0;
		border-right: 1.5px dashed hsl(var(--border));
		background: hsl(var(--accent) / 0.6);
		color: hsl(var(--accent-foreground));
	}
	.stub .d { font-size: 1.5rem; font-weight: 600; line-height: 1; }
	.stub .m { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.25rem; }
	.stub :global(svg) { width: 22px; height: 22px; }
	.body { flex: 1; min-width: 0; padding: 0.75rem 0.875rem; }
	.body .title { font-weight: 600; margin-top: 0.375rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.body .meta { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2px; }
	.when { display: grid; align-content: center; justify-items: end; padding: 0.75rem 0.875rem 0.75rem 0; flex-shrink: 0; text-align: right; }
	.when b { font-size: 0.9375rem; }

	@media (min-width: 768px) { .segmented { max-width: 28rem; } }
	.group-h { font-family: var(--font-display); font-weight: 700; font-size: 1.125rem; margin: 1.25rem 0.25rem 0.25rem; }
	.group-h:first-child { margin-top: 0; }
	.year { margin: 0.75rem 0.25rem 0.375rem; }
</style>
