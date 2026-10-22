<script lang="ts">
	import { page } from '$app/state';
	import {
		ChartColumn,
		ChevronLeft,
		ChevronRight,
		ClipboardList,
		FileText,
		Landmark,
		ListChecks,
		Monitor,
		Settings,
		Shield,
		UserRound,
		Users
	} from '@lucide/svelte';
	import type { CatalogCard } from '#lib/features/tests/schema';

	let { data } = $props();

	const LOOK = [
		{ icon: Landmark, tone: '32 90% 52%', wash: '28 40% 16%' },
		{ icon: Shield, tone: '210 90% 62%', wash: '214 35% 18%' },
		{ icon: Users, tone: '24 90% 58%', wash: '22 28% 18%' },
		{ icon: ClipboardList, tone: '42 80% 58%', wash: '36 28% 16%' },
		{ icon: FileText, tone: '145 60% 48%', wash: '150 24% 16%' },
		{ icon: Monitor, tone: '4 78% 58%', wash: '4 32% 18%' }
	] as const;

	const ROW_LOOK = [
		{ icon: ClipboardList, tone: '24 90% 58%', wash: '22 36% 16%' },
		{ icon: FileText, tone: '210 85% 64%', wash: '214 32% 18%' },
		{ icon: Monitor, tone: '145 60% 48%', wash: '150 26% 16%' },
		{ icon: UserRound, tone: '4 78% 58%', wash: '4 32% 18%' },
		{ icon: Shield, tone: '210 90% 62%', wash: '214 35% 18%' },
		{ icon: Settings, tone: '32 80% 55%', wash: '28 30% 16%' },
		{ icon: Users, tone: '175 55% 46%', wash: '175 24% 16%' },
		{ icon: ChartColumn, tone: '270 70% 68%', wash: '268 28% 18%' }
	] as const;

	const VIEWS = [
		{ key: 'overview', label: 'Overview' },
		{ key: 'tests', label: 'Tests' },
		{ key: 'pyq', label: 'PYQ' },
		{ key: 'syllabus', label: 'Syllabus' },
		{ key: 'books', label: 'Books' }
	] as const;

	const tiles = $derived(
		data.categories.map((c, i) => ({
			...c,
			title: c.name,
			blurb: c.description || 'Practice tests and previous papers',
			...LOOK[i % LOOK.length]!
		}))
	);
	const picked = $derived(tiles.find((t) => t.slug === page.url.searchParams.get('cat')) ?? null);
	const paper = $derived(picked?.exams.find((e) => e.slug === page.url.searchParams.get('paper')) ?? null);
	const view = $derived(VIEWS.find((v) => v.key === page.url.searchParams.get('view'))?.key ?? 'tests');
	const kind = $derived(page.url.searchParams.get('kind') ?? 'mock');

	const blurbFor = (description: string) => description || 'Practice tests and previous papers';
	const forPaper = (cards: CatalogCard[]) => cards.filter((c) => paper && c.examId === paper.id);
	const mocks = $derived(forPaper(data.cards).filter((c) => c.kind === 'mock' || c.kind === 'live'));
	const pyqs = $derived(forPaper(data.cards).filter((c) => c.kind === 'pyq'));
	const practice = $derived(forPaper(data.cards).filter((c) => c.kind === 'practice' || c.kind === 'daily'));
	const sectional = $derived(practice.filter((c) => /section/i.test(c.title)));
	const shown = $derived(kind === 'pyq' ? pyqs : kind === 'practice' ? practice : kind === 'sectional' ? sectional : mocks);

	const href = (p: Record<string, string>) => {
		const sp = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(p)) sp.set(k, v);
		return `?${sp}`;
	};
	const startHref = (c: CatalogCard) =>
		c.inProgressAttemptId ? `/app/tests/${c.id}/attempt/${c.inProgressAttemptId}` : `/app/tests/${c.id}`;
</script>

<svelte:head><title>{paper ? paper.name : picked ? picked.title : 'Tests'} · UCI</title></svelte:head>

<div class={['page', 'flow', { picker: !picked }]}>
	{#if !picked}
		<header class="page-head">
			<div>
				<h1 class="page-title">Tests</h1>
				<p class="page-sub">Choose an exam category to start practicing.</p>
			</div>
		</header>
		<nav class="cats" aria-label="Exam categories">
			{#each tiles as t (t.slug)}
				<a class="cat" href="?cat={t.slug}" style:--tone={t.tone} style:--wash={t.wash}>
					<span class="mark"><t.icon strokeWidth={1.75} /></span>
					<span class="copy">
						<span class="name">{t.title}</span>
						<span class="blurb">{t.blurb}</span>
					</span>
					<ChevronRight class="go" strokeWidth={2} />
				</a>
			{/each}
		</nav>
	{:else if !paper}
		<a class="back-link" href="/app/tests" data-back><ChevronLeft />Tests</a>
		<header class="hub-head">
			<span class="hero-mark" style:--tone={picked.tone} style:--wash={picked.wash}><picked.icon strokeWidth={1.75} /></span>
			<div>
				<h1 class="page-title">{picked.title}</h1>
				<p class="page-sub">{picked.blurb}</p>
			</div>
		</header>
		<p class="lead">Practice previous year papers, topic-wise tests, mock tests and get detailed solutions.</p>
		{#if picked.exams.length}
			<nav class="rows" aria-label="{picked.title} exams">
				{#each picked.exams as exam, i (exam.id)}
					{@const look = ROW_LOOK[i % ROW_LOOK.length]}
					<a class="row" href="?cat={picked.slug}&paper={exam.slug}" style:--tone={look.tone} style:--wash={look.wash}>
						<span class="mark"><look.icon strokeWidth={1.75} /></span>
						<span class="copy">
							<span class="name">{exam.name}</span>
							<span class="blurb">{blurbFor(exam.description)}</span>
						</span>
						<ChevronRight class="go" strokeWidth={2} />
					</a>
				{/each}
			</nav>
		{:else}
			<div class="card card-pad muted small">Exams for {picked.title} are coming soon.</div>
		{/if}
	{:else}
		<a class="back-link" href="?cat={picked.slug}" data-back><ChevronLeft />{picked.title}</a>
		<header class="hub-head">
			<span class="hero-mark" style:--tone="4 78% 58%" style:--wash="4 32% 18%"><UserRound strokeWidth={1.75} /></span>
			<div>
				<h1 class="page-title">{paper.name}</h1>
				<p class="page-sub">{blurbFor(paper.description)}</p>
			</div>
		</header>

		<nav class="views" aria-label="Exam sections">
			{#each VIEWS as v (v.key)}
				<a href={href({ view: v.key })} aria-current={view === v.key ? 'page' : undefined}>{v.label}</a>
			{/each}
		</nav>

		{#if view === 'tests'}
			<div class="kinds">
				<a class="kind" href={href({ view: 'tests', kind: 'mock' })} style:--tone="24 90% 58%" style:--wash="22 36% 16%">
					<span class="mark"><ClipboardList strokeWidth={1.75} /></span>
					<span class="copy"><span class="name">Mock Tests</span><span class="blurb">Full length tests as per latest pattern</span></span>
					<ChevronRight class="go" />
				</a>
				<a class="kind" href={href({ view: 'pyq', kind: 'pyq' })} style:--tone="210 85% 64%" style:--wash="214 32% 18%">
					<span class="mark"><FileText strokeWidth={1.75} /></span>
					<span class="copy"><span class="name">Previous Year Papers</span><span class="blurb">Year-wise papers with solutions</span></span>
					<ChevronRight class="go" />
				</a>
				<a class="kind" href={href({ view: 'tests', kind: 'practice' })} style:--tone="145 60% 48%" style:--wash="150 26% 16%">
					<span class="mark"><ListChecks strokeWidth={1.75} /></span>
					<span class="copy"><span class="name">Topic-wise Tests</span><span class="blurb">Practice by subject and topic</span></span>
					<ChevronRight class="go" />
				</a>
				<a class="kind" href={href({ view: 'tests', kind: 'sectional' })} style:--tone="270 70% 68%" style:--wash="268 28% 18%">
					<span class="mark"><PieChart strokeWidth={1.75} /></span>
					<span class="copy"><span class="name">Sectional Tests</span><span class="blurb">Focus on weak areas</span></span>
					<ChevronRight class="go" />
				</a>
			</div>
			<div class="section-head">
				<h2 class="section-title">{kind === 'practice' ? 'Topic-wise tests' : kind === 'sectional' ? 'Sectional tests' : 'Latest Mock Tests'}</h2>
				{#if kind !== 'mock'}<a class="section-link" href={href({ view: 'tests', kind: 'mock' })}>Mocks</a>{/if}
			</div>
			{#if shown.length}
				<div class="papers">
					{#each shown as t (t.id)}
						<article class="paper">
							<span class="mark mini"><ClipboardList strokeWidth={1.75} /></span>
							<div class="copy">
								<p class="name">{t.title}</p>
								<p class="blurb">{t.questionCount} questions · {t.durationMin} min{t.language ? ` · ${t.language}` : ''}</p>
							</div>
							<a class="btn btn-primary start" href={startHref(t)}>{t.inProgressAttemptId ? 'Resume' : 'Start Test'}</a>
						</article>
					{/each}
				</div>
			{:else}
				<div class="card card-pad muted small">No {kind === 'sectional' ? 'sectional' : kind === 'practice' ? 'topic-wise' : 'mock'} tests for {paper.name} yet.</div>
			{/if}
		{:else if view === 'pyq'}
			<div class="section-head"><h2 class="section-title">Previous year papers</h2></div>
			{#if pyqs.length}
				<div class="papers">
					{#each pyqs as t (t.id)}
						<article class="paper">
							<span class="mark mini"><FileText strokeWidth={1.75} /></span>
							<div class="copy">
								<p class="name">{t.title}</p>
								<p class="blurb">{t.year ? `${t.year} · ` : ''}{t.questionCount} questions · {t.durationMin} min</p>
							</div>
							<a class="btn btn-primary start" href={startHref(t)}>Start Test</a>
						</article>
					{/each}
				</div>
			{:else}
				<div class="card card-pad muted small">Previous papers for {paper.name} are coming soon.</div>
			{/if}
		{:else if view === 'overview'}
			<p class="lead">Practice previous year papers, topic-wise tests, mock tests and get detailed solutions.</p>
			<div class="stats">
				<p><b>{mocks.length}</b><span>Mock tests</span></p>
				<p><b>{pyqs.length}</b><span>PYQ papers</span></p>
				<p><b>{practice.length}</b><span>Topic tests</span></p>
			</div>
		{:else if view === 'syllabus'}
			<div class="card card-pad">
				<h2 class="font-semibold">{paper.name} syllabus</h2>
				<p class="muted small mt-1">The published syllabus for this exam lives with the institute's exam pages.</p>
				<a class="btn btn-primary mt-4" href="/syllabus/{paper.slug}">Open syllabus</a>
			</div>
		{:else}
			<div class="card card-pad">
				<h2 class="font-semibold">Books and notes</h2>
				<p class="muted small mt-1">Revision notes and PDFs for {paper.name}.</p>
				<a class="btn btn-primary mt-4" href="/app/notes?exam={paper.id}">Open notes</a>
			</div>
		{/if}
	{/if}
</div>

<style>
	.flow { max-width: 42rem; display: grid; gap: 0.9rem; }
	.flow .page-head { margin-bottom: 0; }
	.hub-head { display: flex; align-items: center; gap: 0.8rem; }
	.hub-head .page-title { font-size: clamp(1.6rem, 1.3rem + 1vw, 2rem); }
	.hero-mark {
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		flex-shrink: 0;
		border-radius: 1rem;
		background: hsl(var(--wash));
		color: hsl(var(--tone));
	}
	.hero-mark :global(svg) { width: 1.6rem; height: 1.6rem; }
	.lead { color: hsl(var(--muted-foreground)); font-size: 0.92rem; line-height: 1.45; }
	.cats, .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
	.rows, .papers { display: grid; gap: 0.65rem; }
	.cat, .row, .kind, .paper {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.75rem 0.6rem 0.75rem 0.7rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.15rem;
		color: inherit;
		text-decoration: none;
	}
	.cat, .row { min-height: 4.6rem; }
	.kind { min-height: 5.4rem; align-items: flex-start; }
	.mark {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		flex-shrink: 0;
		border-radius: 0.8rem;
		background: hsl(var(--wash));
		color: hsl(var(--tone));
	}
	.mark.mini { width: 2.3rem; height: 2.3rem; background: hsl(var(--muted)); color: hsl(var(--sun)); }
	.mark :global(svg) { width: 1.25rem; height: 1.25rem; }
	.copy { flex: 1; min-width: 0; display: grid; gap: 0.12rem; }
	.name { font-weight: 800; font-size: 0.95rem; line-height: 1.15; }
	.blurb { font-size: 0.72rem; line-height: 1.3; color: hsl(var(--muted-foreground)); }
	:global(.go) { width: 1rem; height: 1rem; flex-shrink: 0; color: hsl(var(--muted-foreground)); }
	.views {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid hsl(var(--border));
	}
	.views a {
		flex: 0 0 auto;
		padding: 0.35rem 0 0.55rem;
		font-size: 0.9rem;
		font-weight: 650;
		color: hsl(var(--muted-foreground));
		border-bottom: 2px solid transparent;
	}
	.views a[aria-current='page'] { color: hsl(var(--foreground)); border-bottom-color: hsl(var(--sun)); }
	.paper { align-items: center; }
	.start { border-radius: 999px; min-height: 2.4rem; padding-inline: 0.9rem; flex-shrink: 0; }
	.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
	.stats p {
		display: grid;
		gap: 0.15rem;
		padding: 0.8rem;
		border-radius: 1rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
	}
	.stats b { font-size: 1.35rem; }
	.stats span { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
</style>
