<script lang="ts">
	import { page } from '$app/state';
	import { Atom, BookOpen, ChevronLeft, ChevronRight, CirclePlay, FileText, FlaskConical, Globe, Landmark, Lock, Newspaper } from '@lucide/svelte';
	import { inr, percentOff } from '#lib/features/billing/format';
	import { duration } from '#lib/features/courses/components/format';

	let { data } = $props();
	const c = $derived(data.course);
	const locked = $derived(data.paywall.locked);
	const offer = $derived(data.paywall.offer);
	const off = $derived(offer ? percentOff(offer) : 0);
	const view = $derived(page.url.searchParams.get('view'));
	const chapter = $derived(c.chapters.find((ch) => ch.id === page.url.searchParams.get('ch')) ?? null);
	const notes = $derived(c.chapters.flatMap((ch) => ch.lessons).filter((l) => l.kind !== 'video' || !!l.body));
	const resume = $derived(data.resume);
	const icons = [BookOpen, FlaskConical, Globe, Landmark, Atom, Newspaper];
	const tones = ['262 70% 68%', '190 70% 52%', '145 62% 46%', '32 85% 58%', '24 85% 58%', '200 70% 60%'];

	const clock = (sec: number) => {
		if (!sec) return '';
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	};
	const href = (p: Record<string, string | null>) => {
		const sp = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(p)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		const q = sp.toString();
		return q ? `?${q}` : `/app/learn/${c.slug}`;
	};
</script>

<svelte:head><title>{chapter ? chapter.title : c.title} · UCI</title></svelte:head>

<div class="page flow">
	{#if chapter}
		<a class="back-link" href={href({ ch: null })} data-back><ChevronLeft />{c.title}</a>
		<header class="page-head">
			<div>
				<h1 class="page-title">{chapter.title}</h1>
				<p class="page-sub">{chapter.lessons.length} classes</p>
			</div>
		</header>
		<nav class="rows" aria-label="Classes">
			{#each chapter.lessons as l, i (l.id)}
				{@const open = !locked || l.isPreview}
				{#if open}
					<a class="row" href="/app/learn/{c.slug}/{l.id}">
						<span class="mark mini">{i + 1}</span>
						<span class="copy">
							<span class="name">Class {i + 1} · {l.title}</span>
							<span class="blurb">{l.isPreview ? 'Demo' : 'Class'}{clock(l.durationSec) ? ` · ${clock(l.durationSec)}` : ''}{data.state[l.id]?.completed ? ' · Done' : ''}</span>
						</span>
						<CirclePlay class="go" />
					</a>
				{:else}
					<div class="row locked">
						<span class="mark mini"><Lock strokeWidth={1.75} /></span>
						<span class="copy">
							<span class="name">Class {i + 1} · {l.title}</span>
							<span class="blurb">Unlocks after you buy this course</span>
						</span>
					</div>
				{/if}
			{/each}
		</nav>
	{:else if view === 'classes'}
		<a class="back-link" href={locked ? `/app/learn/${c.slug}` : c.isPaid ? '/app/learn?tab=mine' : '/app/learn'} data-back><ChevronLeft />{locked ? 'Course' : 'Courses'}</a>
		<header class="page-head"><div><h1 class="page-title">{c.title}</h1><p class="page-sub">Subjects in this course.</p></div></header>
		<nav class="segmented" aria-label="Course sections">
			<a href={href({ view: 'classes', ch: null })} aria-current="page">Classes</a>
			<a href={href({ view: 'notes', ch: null })}>Notes</a>
			<a href="/app/tests">Tests</a>
		</nav>
		{#if c.chapters.length}
			<nav class="rows" aria-label="Subjects">
				{#each c.chapters as ch, i (ch.id)}
					{@const Icon = icons[i % icons.length]!}
					<a class="row" href={href({ view: 'classes', ch: ch.id })} style:--tone={tones[i % tones.length]} style:--wash="220 16% 16%">
						<span class="mark"><Icon strokeWidth={1.75} /></span>
						<span class="copy">
							<span class="name">{ch.title}</span>
							<span class="blurb">{ch.lessons.length} classes</span>
						</span>
						<ChevronRight class="go" />
					</a>
				{/each}
			</nav>
		{:else}
			<div class="card card-pad muted small">Classes for this course are being added.</div>
		{/if}
	{:else if view === 'notes'}
		<a class="back-link" href={href({ view: 'classes' })} data-back><ChevronLeft />{c.title}</a>
		<header class="page-head"><div><h1 class="page-title">Study material</h1><p class="page-sub">Notes and PDFs inside this course.</p></div></header>
		{#if notes.length}
			<nav class="rows">
				{#each notes as l (l.id)}
					<a class="row" href="/app/learn/{c.slug}/{l.id}">
						<span class="mark mini"><FileText strokeWidth={1.75} /></span>
						<span class="copy"><span class="name">{l.title}</span><span class="blurb">{l.kind === 'pdf' ? 'PDF' : 'Notes'}</span></span>
						<ChevronRight class="go" />
					</a>
				{/each}
			</nav>
		{:else}
			<div class="card card-pad muted small">Notes for this course are being added.</div>
		{/if}
	{:else if !locked}
		<a class="back-link" href="/app/learn?tab=mine" data-back><ChevronLeft />Courses</a>
		<header class="page-head"><div><h1 class="page-title">My Courses</h1></div></header>
		<article class="row mine">
			<span class="copy">
				<span class="name">{c.title}</span>
				<span class="blurb">{offer?.validityDays ? `Valid ${offer.validityDays} days` : 'Full access'} · {data.progress.percent}% complete</span>
			</span>
			{#if resume}<a class="btn btn-primary" href="/app/learn/{c.slug}/{resume.id}">Continue</a>{/if}
		</article>
		<div class="progress"><span style="width: {data.progress.percent}%"></span></div>
		<nav class="rows" aria-label="Course menu">
			<a class="row" href={href({ view: 'classes' })}><span class="copy"><span class="name">Video classes</span><span class="blurb">{c.lessonCount} classes</span></span><ChevronRight class="go" /></a>
			<a class="row" href={href({ view: 'notes' })}><span class="copy"><span class="name">Study material</span><span class="blurb">Notes and PDFs</span></span><ChevronRight class="go" /></a>
			<a class="row" href="/app/tests"><span class="copy"><span class="name">Mock tests</span><span class="blurb">{data.examName ?? 'Practice tests'}</span></span><ChevronRight class="go" /></a>
			<a class="row" href="/app/doubts"><span class="copy"><span class="name">Doubt section</span><span class="blurb">Ask a teacher</span></span><ChevronRight class="go" /></a>
		</nav>
	{:else}
		<a class="back-link" href="/app/learn?tab=paid" data-back><ChevronLeft />Paid Courses</a>
		<header class="sale">
			<p class="eyebrow">{data.examName ?? 'Course'}</p>
			<h1 class="page-title">{c.title}</h1>
			{#if c.summary}<p class="page-sub">{c.summary}</p>{/if}
		</header>
		{#if c.chapters.length}
			<div class="chips" aria-label="Subjects">
				{#each c.chapters as ch (ch.id)}<a class="chip" href={href({ view: 'classes', ch: ch.id })}>{ch.title}</a>{/each}
			</div>
		{/if}
		<ul class="facts">
			<li><span class="tabular">{c.lessonCount}</span> classes</li>
			<li>PDF notes</li>
			<li>Mock tests</li>
			<li>{offer?.validityDays ? `${offer.validityDays} days` : 'Full access'}</li>
		</ul>
		{#if offer}
			<div class="price">
				<span class="now">{inr(offer.priceInr)}</span>
				{#if offer.mrpInr && offer.mrpInr > offer.priceInr}<span class="was">{inr(offer.mrpInr)}</span>{/if}
				{#if off}<span class="off">{off}% off</span>{/if}
			</div>
			<a class="btn btn-primary btn-lg btn-block" href="/app/checkout/{offer.id}">Buy now</a>
			<p class="tiny muted">Pay with UPI, card, net banking or wallet on the secure payment page.</p>
		{:else}
			<div class="card card-pad muted small">This course is not on sale yet.</div>
		{/if}
		{#if c.lessonCount}<a class="btn btn-secondary btn-block" href={href({ view: 'classes' })}>See subjects</a>{/if}
		{#if c.durationSec}<p class="tiny muted">{duration(c.durationSec)} of lessons</p>{/if}
	{/if}
</div>

<style>
	.flow { max-width: 40rem; display: grid; gap: 0.85rem; }
	.flow .page-head { margin-bottom: 0; }
	.rows { display: grid; gap: 0.6rem; }
	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 4.2rem;
		padding: 0.7rem 0.75rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.1rem;
		color: inherit;
		text-decoration: none;
	}
	.row.locked { opacity: 0.72; }
	.mark {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		flex-shrink: 0;
		border-radius: 0.8rem;
		background: hsl(var(--wash, var(--muted)));
		color: hsl(var(--tone, var(--sun)));
		font-weight: 800;
	}
	.mark.mini { width: 2.3rem; height: 2.3rem; }
	.mark :global(svg) { width: 1.15rem; height: 1.15rem; }
	.copy { flex: 1; min-width: 0; display: grid; gap: 0.1rem; }
	.name { font-weight: 800; line-height: 1.2; }
	.blurb { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
	:global(.go) { width: 1rem; height: 1rem; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
	.sale { display: grid; gap: 0.25rem; }
	.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding: 0; margin: 0; list-style: none; }
	.facts li { padding: 0.7rem 0.8rem; border-radius: 0.9rem; background: hsl(var(--surface)); border: 1px solid hsl(var(--border)); font-size: 0.85rem; font-weight: 700; }
	.price { display: flex; align-items: baseline; gap: 0.5rem; }
	.now { font-size: 1.8rem; font-weight: 800; }
	.was { color: hsl(var(--muted-foreground)); text-decoration: line-through; }
	.off { color: hsl(var(--sun)); font-weight: 800; font-size: 0.85rem; }
	.mine { justify-content: space-between; }
</style>
