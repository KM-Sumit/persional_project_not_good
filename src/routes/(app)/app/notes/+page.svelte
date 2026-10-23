<script lang="ts">
	import { page } from '$app/state';
	import {
		Atom,
		BookOpen,
		Brain,
		ChevronLeft,
		ChevronRight,
		FileText,
		FlaskConical,
		Globe,
		Landmark,
		Leaf,
		Monitor,
		Palette,
		Pi,
		ScrollText
	} from '@lucide/svelte';
	import type { NoteCard } from '#lib/features/notes/schema';

	let { data } = $props();

	type Unit = { slug: string; title: string; en: string; keys: string[] };
	type Topic = { slug: string; title: string; hindi: string; icon: typeof Landmark; tone: string; wash: string; units: Unit[] };

	const GK_TOPICS: Topic[] = [
		{
			slug: 'history',
			title: 'History',
			hindi: 'इतिहास',
			icon: Landmark,
			tone: '32 85% 58%',
			wash: '28 32% 16%',
			units: [
				{ slug: 'ancient', title: 'प्राचीन भारत', en: 'Ancient India', keys: ['ancient', 'indus', 'vedic', 'maurya', 'gupta', 'प्राचीन'] },
				{ slug: 'medieval', title: 'मध्यकालीन भारत', en: 'Medieval India', keys: ['medieval', 'mughal', 'delhi sultan', 'मध्यकाल'] },
				{ slug: 'modern', title: 'आधुनिक भारत', en: 'Modern India', keys: ['modern', 'freedom', '1857', 'gandhi', 'आधुनिक'] },
				{ slug: 'world', title: 'विश्व इतिहास', en: 'World history', keys: ['world', 'revolution', 'war'] }
			]
		},
		{ slug: 'geography', title: 'Geography', hindi: 'भूगोल', icon: Globe, tone: '145 60% 48%', wash: '150 24% 16%', units: [] },
		{ slug: 'polity', title: 'Polity', hindi: 'राजव्यवस्था', icon: Landmark, tone: '32 80% 55%', wash: '28 28% 16%', units: [] },
		{ slug: 'economy', title: 'Economy', hindi: 'अर्थव्यवस्था', icon: ScrollText, tone: '4 75% 58%', wash: '4 28% 16%', units: [] },
		{ slug: 'mp-gk', title: 'Madhya Pradesh GK', hindi: 'मध्यप्रदेश ज्ञान', icon: Landmark, tone: '36 85% 55%', wash: '30 28% 16%', units: [] },
		{ slug: 'science', title: 'Science & Technology', hindi: 'विज्ञान एवं प्रौद्योगिकी', icon: Atom, tone: '210 85% 62%', wash: '214 30% 16%', units: [] },
		{ slug: 'current', title: 'Current Affairs', hindi: 'समसामयिकी', icon: FileText, tone: '200 70% 60%', wash: '205 26% 16%', units: [] },
		{ slug: 'sports', title: 'Sports', hindi: 'खेल', icon: ScrollText, tone: '42 85% 55%', wash: '36 28% 16%', units: [] },
		{ slug: 'art', title: 'Art & Culture', hindi: 'कला एवं संस्कृति', icon: Palette, tone: '330 70% 62%', wash: '330 24% 16%', units: [] },
		{ slug: 'environment', title: 'Environment', hindi: 'पर्यावरण', icon: Leaf, tone: '140 55% 48%', wash: '140 24% 16%', units: [] }
	];

	const SUBJECT_LOOK: Record<string, { icon: typeof Pi; tone: string; wash: string; blurb: string }> = {
		mathematics: { icon: Pi, tone: '262 70% 68%', wash: '262 28% 18%', blurb: 'Complete Notes' },
		reasoning: { icon: Brain, tone: '24 85% 58%', wash: '22 30% 16%', blurb: 'Complete Notes' },
		english: { icon: BookOpen, tone: '210 80% 62%', wash: '214 28% 16%', blurb: 'Complete Notes' },
		'general knowledge': { icon: Globe, tone: '145 62% 46%', wash: '150 26% 15%', blurb: 'Complete Notes' },
		'general science': { icon: FlaskConical, tone: '190 70% 52%', wash: '195 28% 16%', blurb: 'Complete Notes' },
		computer: { icon: Monitor, tone: '250 55% 64%', wash: '250 24% 16%', blurb: 'Complete Notes' },
		hindi: { icon: BookOpen, tone: '4 75% 58%', wash: '4 28% 16%', blurb: 'Complete Notes' },
		'current affairs': { icon: FileText, tone: '200 70% 60%', wash: '205 26% 16%', blurb: 'Daily notes' }
	};

	const subject = $derived(data.subjects.find((s) => s.id === page.url.searchParams.get('subject')) ?? null);
	const isGk = $derived(!!subject && /general knowledge|^gk$/i.test(subject.name));
	const topic = $derived(isGk ? GK_TOPICS.find((t) => t.slug === page.url.searchParams.get('topic')) ?? null : null);
	const unit = $derived(topic?.units.find((u) => u.slug === page.url.searchParams.get('unit')) ?? null);
	const kind = $derived(page.url.searchParams.get('kind') === 'pdf' || page.url.searchParams.get('kind') === 'short' ? page.url.searchParams.get('kind')! : 'all');

	const look = (name: string) => SUBJECT_LOOK[name.toLowerCase()] ?? { icon: BookOpen, tone: '24 85% 58%', wash: '22 30% 16%', blurb: 'Complete Notes' };

	const pool = $derived(
		data.notes.filter((n: NoteCard) => {
			if (subject && n.subjectId !== subject.id) return false;
			if (unit) {
				const hay = `${n.title} ${n.summary}`.toLowerCase();
				if (!unit.keys.some((k) => hay.includes(k))) return false;
			} else if (topic && topic.units.length === 0) {
				const hay = `${n.title} ${n.summary}`.toLowerCase();
				if (!hay.includes(topic.title.toLowerCase()) && !hay.includes(topic.hindi)) return false;
			}
			if (kind === 'pdf' && !n.hasPdf) return false;
			if (kind === 'short' && n.hasPdf) return false;
			return true;
		})
	);

	const href = (p: Record<string, string | null>) => {
		const sp = new URLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(p)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		const q = sp.toString();
		return q ? `?${q}` : '/app/notes';
	};
</script>

<svelte:head><title>{unit ? unit.title : topic ? topic.title : subject ? subject.name : 'Study Notes'} · UCI</title></svelte:head>

<div class="page flow">
	{#if !subject}
		<header class="page-head">
			<div>
				<h1 class="page-title">Study Notes</h1>
				<p class="page-sub">All subjects, then topics and units.</p>
			</div>
		</header>
		<nav class="rows" aria-label="Subjects">
				{#each data.subjects as s (s.id)}
					{@const item = look(s.name)}
					<a class="row" href={href({ subject: s.id })} style:--tone={item.tone} style:--wash={item.wash}>
						<span class="mark"><item.icon strokeWidth={1.75} /></span>
						<span class="copy">
							<span class="name">{s.name}</span>
							<span class="blurb">{item.blurb}</span>
						</span>
						<ChevronRight class="go" />
					</a>
				{/each}
			</nav>
	{:else if isGk && !topic}
		<a class="back-link" href="/app/notes" data-back><ChevronLeft />Study Notes</a>
		<header class="page-head"><div><h1 class="page-title">{subject.name}</h1><p class="page-sub">All topics inside this subject.</p></div></header>
		<nav class="rows" aria-label="Topics">
			{#each GK_TOPICS as t (t.slug)}
				<a class="row" href={href({ topic: t.slug })} style:--tone={t.tone} style:--wash={t.wash}>
					<span class="mark"><t.icon strokeWidth={1.75} /></span>
					<span class="copy">
						<span class="name">{t.title}</span>
						<span class="blurb">{t.hindi}</span>
					</span>
					<ChevronRight class="go" />
				</a>
			{/each}
		</nav>
	{:else if topic && topic.units.length && !unit}
		<a class="back-link" href={href({ topic: null, unit: null })} data-back><ChevronLeft />{subject.name}</a>
		<header class="hub">
			<span class="mark lg" style:--tone={topic.tone} style:--wash={topic.wash}><topic.icon strokeWidth={1.75} /></span>
			<div>
				<h1 class="page-title">{topic.title}</h1>
				<p class="page-sub">{topic.hindi}</p>
			</div>
		</header>
		<nav class="rows" aria-label="Units">
			{#each topic.units as u, i (u.slug)}
				<a class="row" href={href({ unit: u.slug })}>
					<span class="thumb" aria-hidden="true">{i + 1}</span>
					<span class="copy">
						<span class="name">{u.title}</span>
						<span class="blurb">{u.en}</span>
					</span>
					<ChevronRight class="go" />
				</a>
			{/each}
		</nav>
	{:else}
		<a class="back-link" href={topic ? href({ unit: null, kind: null }) : '/app/notes'} data-back><ChevronLeft />{topic ? topic.title : 'Study Notes'}</a>
		<header class="page-head">
			<div>
				<h1 class="page-title">{unit ? unit.title : topic ? topic.title : subject.name}</h1>
				{#if unit}<p class="page-sub">{unit.en}</p>{:else if topic}<p class="page-sub">{topic.hindi}</p>{/if}
			</div>
		</header>
		<nav class="segmented" aria-label="Note type">
			<a href={href({ kind: null })} aria-current={kind === 'all' ? 'page' : undefined}>All</a>
			<a href={href({ kind: 'pdf' })} aria-current={kind === 'pdf' ? 'page' : undefined}>PDF Notes</a>
			<a href={href({ kind: 'short' })} aria-current={kind === 'short' ? 'page' : undefined}>Short Notes</a>
		</nav>
		{@render noteList(pool, 'Notes for this topic are being added.')}
	{/if}
</div>

{#snippet noteList(items: NoteCard[], empty: string)}
	{#if items.length}
		<div class="rows">
			{#each items as n (n.id)}
				<a class="row note" href="/app/notes/{n.slug}">
					<span class={['mark', 'mini', n.hasPdf && 'pdf']}><FileText strokeWidth={1.75} /></span>
					<span class="copy">
						<span class="name">{n.title}</span>
						<span class="blurb">{n.hasPdf ? 'PDF' : 'Short note'} · {n.readingMinutes} min</span>
					</span>
					<ChevronRight class="go" />
				</a>
			{/each}
		</div>
	{:else}
		<div class="card card-pad muted small">{empty}</div>
	{/if}
{/snippet}

<style>
	.flow { max-width: 40rem; display: grid; gap: 0.85rem; }
	.flow .page-head { margin-bottom: 0; }
	.rows { display: grid; gap: 0.6rem; }
	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 4.4rem;
		padding: 0.7rem 0.75rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.1rem;
		color: inherit;
		text-decoration: none;
	}
	.mark, .thumb {
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
	.mark.lg { width: 3.2rem; height: 3.2rem; border-radius: 1rem; }
	.mark.mini { width: 2.3rem; height: 2.3rem; }
	.mark.pdf { background: hsl(4 40% 18%); color: hsl(4 80% 62%); }
	.mark :global(svg) { width: 1.25rem; height: 1.25rem; }
	.copy { flex: 1; min-width: 0; display: grid; gap: 0.1rem; }
	.name { font-weight: 800; line-height: 1.2; }
	.blurb { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
	:global(.go) { width: 1rem; height: 1rem; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
	.hub { display: flex; align-items: center; gap: 0.75rem; }
	.hub .page-title { font-size: clamp(1.5rem, 1.2rem + 1vw, 1.9rem); }
</style>
