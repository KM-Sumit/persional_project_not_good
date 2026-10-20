<script lang="ts">
	// Exam landing. Value first, sale later: hero, section tabs, live, tests, PYQ, courses, notes, pass, FAQ.
	import { onMount } from 'svelte';
	import { BadgeCheck, ChevronLeft, ChevronRight, FileText, History, Lock, NotebookText } from '@lucide/svelte';
	import { goBack } from '#lib/client/history';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import SectionHead from '#lib/features/site/components/SectionHead.svelte';
	import CourseTile from '#lib/features/site/components/CourseTile.svelte';
	import { dayIST, inr, plural, timeIST } from '#lib/features/site/components/format';
	import type { PublicTest } from '#lib/features/site/server/browse';

	let { data } = $props();
	const e = $derived(data.exam);
	const c = $derived(data.category);
	const crumbs = $derived([
		{ href: '/', label: 'Home' },
		{ href: '/exams', label: 'Exams' },
		{ href: `/exams/${c.slug}`, label: c.name }
	]);
	const live = $derived(data.tests.filter((t) => t.kind === 'live'));
	const pyq = $derived(data.tests.filter((t) => t.kind === 'pyq'));
	const practice = $derived(data.tests.filter((t) => t.kind === 'mock' || t.kind === 'practice'));
	const testCount = $derived(live.length + practice.length);
	const empty = $derived(!data.tests.length && !data.courses.length && !data.noteCount);
	const summary = $derived(
		[testCount && plural(testCount, 'test'), pyq.length && plural(pyq.length, 'PYQ paper'), data.courses.length && plural(data.courses.length, 'course'), data.noteCount && plural(data.noteCount, 'note')]
			.filter(Boolean)
			.join(' · ')
	);
	const tabs = $derived(
		[
			{ id: 'tests', label: 'Tests', on: data.tests.length > 0 },
			{ id: 'courses', label: 'Courses', on: data.courses.length > 0 },
			{ id: 'notes', label: 'Notes', on: data.noteCount > 0 },
			{ id: 'pass', label: 'Pass', on: Boolean(data.pass) }
		].filter((t) => t.on)
	);
	const href = (t: PublicTest) => `/login?next=/app/tests/${t.id}`;
	const access = { open: 'Free', password: 'Password', paid: 'Paid' } as const;
	const badge = { open: 'badge-success', password: 'badge-primary', paid: 'badge-closed' } as const;
	const day = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(new Date(iso));
	const mon = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }).format(new Date(iso));

	const faqs = $derived([
		{ q: `Are the ${e.name} tests free?`, a: 'Tests marked Free cost nothing; sign in with Google to save answers and see your score. Password tests use a password your teacher shares before the test starts.' },
		{ q: 'How do live tests work?', a: 'A live test opens at the time shown, in IST, and everyone runs on the same server clock. You get one attempt; ranks and solutions appear after it closes.' },
		{ q: 'Can I study in Hindi?', a: 'Classes and courses are taught in Hindi. Each test shows its language on the instructions screen before you start.' }
	]);

	let active = $state('');
	onMount(() => {
		const io = new IntersectionObserver(
			(es) => {
				for (const x of es) if (x.isIntersecting) active = x.target.id;
			},
			{ rootMargin: '-140px 0px -60% 0px' }
		);
		for (const t of tabs) {
			const el = document.getElementById(t.id);
			if (el) io.observe(el);
		}
		return () => io.disconnect();
	});
</script>

<Seo
	title="{e.name}: free mock tests, PYQ papers and courses"
	description={e.description || `${e.name} preparation at UCI: ${summary || 'tests and courses coming soon'}. Start with a free mock test.`}
	crumbs={[...crumbs, { href: `/exams/${c.slug}/${e.slug}`, label: e.name }]}
	noindex={empty}
/>

<div class="page site-page">
	<header class="hero">
		<nav class="crumbs" aria-label="Breadcrumb">
			{#each crumbs as k (k.href)}<a href={k.href}>{k.label}</a><ChevronRight aria-hidden="true" />{/each}
			<span aria-current="page">{e.name}</span>
		</nav>
		<a href="/exams/{c.slug}" class="back-link touch-only" data-back onclick={(ev) => goBack(ev, `/exams/${c.slug}`)}><ChevronLeft />{c.name}</a>
		<h1 class="page-title">{e.name}</h1>
		<p class="sub">{e.description || `Free tests, courses and notes for ${e.name}, in one place.`}</p>
		{#if summary}<p class="sum">{summary}</p>{/if}
	</header>

	{#if tabs.length > 1}
		<nav class="tabs" aria-label="Sections">
			<div class="segmented">
				{#each tabs as t (t.id)}
					<a href="#{t.id}" aria-current={active === t.id ? 'page' : undefined}>{t.label}</a>
				{/each}
			</div>
		</nav>
	{/if}

	<div class="flow">
		{#if data.tests.length}
			<div id="tests" class="flow">
				{#if live.length}
					<section aria-labelledby="h-live">
						<SectionHead id="h-live" title="Live tests" />
						<ul class="list">
							{#each live as t (t.id)}
								<li>
									<a href={href(t)} class="list-row row">
										<span class="date font-mono tabular" aria-hidden="true"><b>{day(t.startsAt!)}</b>{mon(t.startsAt!)}</span>
										<span class="main">
											<span class="title">{t.title}</span>
											<span class="meta"><span class="tabular">{t.questions}</span> Q · <span class="tabular">{t.durationMin}</span> min · <span class="tabular">{t.marks}</span> marks{#if t.negativeMarks} · −<span class="tabular">{t.negativeMarks}</span>/wrong{/if}</span>
											<span class="meta">{dayIST(t.startsAt!)}, {timeIST(t.startsAt!)} <span class="badge {badge[t.access]}">{access[t.access]}</span></span>
										</span>
										<ChevronRight class="chev" />
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
				{#each [{ id: 'h-tests', title: 'Mock and practice tests', items: practice }, { id: 'h-pyq', title: 'Previous-year papers', items: pyq }] as s (s.id)}
					{#if s.items.length}
						<section aria-labelledby={s.id}>
							<SectionHead id={s.id} title={s.title} />
							<ul class="list">
								{#each s.items as t (t.id)}
									<li>
										<a href={href(t)} class="list-row row">
											<span class="icon" aria-hidden="true">
												{#if t.access === 'paid'}<Lock />{:else if t.kind === 'pyq'}<History />{:else}<FileText />{/if}
											</span>
											<span class="main">
												<span class="title">{t.title}{#if t.year} ({t.year}){/if}</span>
												<span class="meta"><span class="tabular">{t.questions}</span> Q · <span class="tabular">{t.durationMin}</span> min · <span class="tabular">{t.marks}</span> marks <span class="badge {badge[t.access]}">{access[t.access]}</span></span>
											</span>
											<ChevronRight class="chev" />
										</a>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/each}
			</div>
		{/if}

		{#if data.courses.length}
			<section id="courses" aria-labelledby="h-courses">
				<SectionHead id="h-courses" title="Courses" href="/courses?exam={e.slug}" />
				<div class="courses">
					{#each data.courses as course (course.id)}
						<CourseTile {course} thumb={data.thumbs[course.slug]} />
					{/each}
				</div>
			</section>
		{/if}

		{#if data.noteCount}
			<section id="notes" aria-labelledby="h-notes">
				<SectionHead id="h-notes" title="Notes" href="/login?next=/app/notes" link={data.noteCount > data.notes.length ? `Read all ${data.noteCount}` : 'Open notes'} />
				<ul class="list">
					{#each data.notes as n (n.slug)}
						<li>
							<a href="/login?next=/app/notes/{n.slug}" class="list-row row">
								<span class="icon" aria-hidden="true"><NotebookText /></span>
								<span class="main"><span class="title">{n.title}</span></span>
								<ChevronRight class="chev" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if empty}
			<div class="empty">
				<h3>Tests for {e.name} are coming soon</h3>
				<p>Send us a message and we will tell you when they are live.</p>
				<a href="/contact?exam={encodeURIComponent(e.name)}" class="btn btn-primary">Notify me</a>
			</div>
		{/if}

		{#if data.pass}
			{@const p = data.pass}
			<section id="pass" class="pass card" aria-labelledby="h-pass">
				<div class="min-w-0">
					<p class="eyebrow">Exam pass</p>
					<h2 id="h-pass" class="pass-title">{p.title}</h2>
					<p class="pass-line">
						<span class="font-mono tabular price">{inr(p.priceInr)}</span>
						{#if p.mrpInr && p.mrpInr > p.priceInr}<s class="font-mono tabular">{inr(p.mrpInr)}</s>{/if}
						<span class="muted small">{#if p.validUntil}until {dayIST(p.validUntil)}{:else if p.validityDays}for {plural(p.validityDays, 'day')}{:else}no expiry{/if}</span>
					</p>
				</div>
				<div class="pass-act">
					<a href="/login?next=/app/checkout/{p.id}" class="btn btn-primary btn-block">Get the pass</a>
					<p class="tiny muted trust"><BadgeCheck />UPI, cards, net banking via Razorpay · <a href="/legal/refunds">Refunds</a></p>
				</div>
			</section>
		{/if}

		<section aria-labelledby="h-faq">
			<SectionHead id="h-faq" title="Questions" />
			<div class="faq">
				{#each faqs as f (f.q)}
					<details><summary>{f.q}</summary><p>{f.a}</p></details>
				{/each}
			</div>
		</section>
	</div>
</div>

<style>
	.site-page {
		padding-top: clamp(1rem, 0.8rem + 1vw, 2rem);
	}
	.hero {
		margin-bottom: 1rem;
	}
	.hero .page-title {
		font-stretch: 80%;
		font-size: clamp(2.25rem, 1.8rem + 2.4vw, 3.5rem);
		margin-top: 0.25rem;
	}
	.sub {
		margin-top: 0.5rem;
		max-width: 40rem;
		color: hsl(var(--muted-foreground));
	}
	.sum {
		margin-top: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tabs {
		position: sticky;
		top: calc(64px + var(--safe-top));
		z-index: 20;
		margin: 0 calc(-1 * var(--gutter)) 1.5rem;
		padding: 0.5rem var(--gutter);
		background: hsl(var(--background) / 0.9);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}
	.tabs .segmented {
		max-width: 28rem;
	}
	.tabs .segmented > a {
		flex: 1;
		display: grid;
		place-items: center;
		min-height: 36px;
		padding: 0 0.75rem;
		border-radius: 9px;
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.flow {
		display: grid;
		gap: 2.5rem;
		min-width: 0;
	}
	#tests,
	#courses,
	#notes,
	#pass {
		scroll-margin-top: calc(130px + var(--safe-top));
	}
	.row {
		color: inherit;
	}
	li + li .row {
		border-top: 1px solid hsl(var(--border));
	}
	.icon,
	.date {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	.icon :global(svg) {
		width: 20px;
		height: 20px;
	}
	.date {
		height: 52px;
		align-content: center;
		gap: 0;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
		font-size: 0.6875rem;
		text-transform: uppercase;
		line-height: 1.1;
	}
	.date b {
		font-size: 1.375rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}
	.main {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.125rem;
	}
	.title {
		font-weight: 600;
		line-height: 1.35;
		white-space: normal;
		overflow: visible;
	}
	.meta {
		display: block;
		line-height: 1.6;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	.meta .badge {
		margin-left: 0.25rem;
	}
	.tabular {
		font-variant-numeric: tabular-nums;
	}
	.row :global(.chev) {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		color: hsl(var(--muted-foreground));
	}
	.courses {
		display: grid;
		gap: 0.625rem;
	}
	@media (min-width: 640px) {
		.courses {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 1rem;
		}
	}
	@media (min-width: 1024px) {
		.courses {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.pass {
		display: grid;
		gap: 1rem;
		padding: 1.125rem 1.25rem;
		border-left: 3px solid hsl(var(--sun));
	}
	@media (min-width: 768px) {
		.pass {
			grid-template-columns: minmax(0, 1fr) 16rem;
			align-items: center;
		}
	}
	.pass-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		font-size: var(--text-section);
	}
	.pass-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.5rem;
		margin-top: 0.25rem;
	}
	.price {
		font-size: 1.5rem;
		font-weight: 600;
	}
	s {
		color: hsl(var(--muted-foreground));
	}
	.pass-act {
		display: grid;
		gap: 0.5rem;
	}
	.trust {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}
	.trust :global(svg) {
		width: 14px;
		height: 14px;
		color: hsl(var(--success));
	}
	.trust a {
		text-decoration: underline;
	}
	.faq {
		border-top: 1px solid hsl(var(--border));
		max-width: 48rem;
	}
	.faq details {
		border-bottom: 1px solid hsl(var(--border));
	}
	.faq summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 52px;
		padding: 0.75rem 0;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	.faq summary::-webkit-details-marker {
		display: none;
	}
	.faq summary::after {
		content: '+';
		font-family: var(--font-mono);
		color: hsl(var(--primary));
	}
	.faq details[open] summary::after {
		content: '−';
	}
	.faq p {
		padding-bottom: 1rem;
		color: hsl(var(--muted-foreground));
		line-height: 1.6;
	}
</style>
