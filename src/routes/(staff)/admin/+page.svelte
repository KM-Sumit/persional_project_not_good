<script lang="ts">
	import { CalendarClock, CircleAlert, Plus, Trophy } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Tabs } from '#lib/components/ui';

	let { data } = $props();
	let tab = $state('recent');

	const when = (iso: string) =>
		new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
	const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n)}%`);
	// Compact strip; Students and Live always show, the rest only when non-zero (no wall of zeros).
	const kpis = $derived(
		[
			{ label: 'Students', value: data.kpis.students, href: '/admin/students', keep: true },
			{ label: 'Live now', value: data.kpis.live, href: '/admin/tests', keep: true },
			{ label: 'Active this week', value: data.kpis.activeWeek, href: '/admin/students?sort=active' },
			{ label: 'Upcoming tests', value: data.kpis.upcoming, href: '/admin/tests' },
			{ label: 'Attempts today', value: data.kpis.attemptsToday },
			{ label: 'New enquiries', value: data.kpis.newLeads, href: '/admin/leads?status=new' }
		]
			.filter((k) => k.keep || String(k.value) !== '0')
			.slice(0, 4)
	);
	const attentionCount = $derived(data.attention.emptyDrafts.length + (data.attention.oldLeads ? 1 : 0) + (data.attention.openDoubts ? 1 : 0));
</script>

<div class="page">
	<PageHeader title="Dashboard" subtitle={data.session ? `Session ${data.session.name}` : 'No current session set'}>
		{#snippet actions()}
			<a class="btn btn-primary" href="/admin/tests/new"><Plus /> New test</a>
		{/snippet}
	</PageHeader>

	<div class="kpis card rise">
		{#each kpis as k (k.label)}
			<svelte:element this={k.href ? 'a' : 'div'} href={k.href} class="kpi">
				<span class="kpi-value font-mono tabular">{String(k.value) === '0' ? '—' : k.value}</span>
				<span class="kpi-label">{k.label}</span>
			</svelte:element>
		{/each}
	</div>

	<div class="cols">
		<section class="rise" style="--i: 2">
			<div class="section-head"><h2 class="section-title">Live and upcoming</h2><a class="section-link" href="/admin/tests">See all</a></div>
			{#if data.live.length || data.upcoming.length}
				<div class="list">
					{#each data.live as t (t.id)}
						<a class="list-row" href="/admin/tests/{t.id}">
							<span class="grow"><span class="title block">{t.title}</span><span class="meta block">{t.questionCount} questions · {t.attemptCount} attempts</span></span>
							<Badge tone="live">Live</Badge>
						</a>
					{/each}
					{#each data.upcoming as t (t.id)}
						<a class="list-row" href="/admin/tests/{t.id}">
							<span class="grow"><span class="title block">{t.title}</span><span class="meta block font-mono tabular">{when(t.startsAt!)}</span></span>
							<Badge tone="draft">Upcoming</Badge>
						</a>
					{/each}
				</div>
			{:else}
				<div class="card"><EmptyState compact icon={CalendarClock} title="Nothing scheduled" body="Published tests with a start time show up here." /></div>
			{/if}
		</section>

		<section class="rise" style="--i: 3">
			<div class="section-head"><h2 class="section-title">Needs attention</h2>{#if attentionCount}<span class="badge badge-warning">{attentionCount}</span>{/if}</div>
			<div class="list">
				{#each data.attention.emptyDrafts as t (t.id)}
					<a class="list-row" href="/admin/tests/{t.id}/questions">
						<span class="leading-icon"><CircleAlert /></span>
						<span class="grow"><span class="title block">{t.title}</span><span class="meta block">Draft with no questions</span></span>
					</a>
				{/each}
				{#if data.attention.newLeads}
					<a class="list-row" href="/admin/leads?status=new">
						<span class="leading-icon"><CircleAlert /></span>
						<span class="grow">
							<span class="title block">{data.attention.newLeads} new {data.attention.newLeads === 1 ? 'enquiry' : 'enquiries'}</span>
							<span class="meta block">{data.attention.oldLeads ? `${data.attention.oldLeads} waiting over 24 hours` : 'Call them back today'}</span>
						</span>
					</a>
				{/if}
				{#if data.attention.openDoubts}
					<a class="list-row" href="/admin/doubts">
						<span class="leading-icon"><CircleAlert /></span>
						<span class="grow"><span class="title block">{data.attention.openDoubts} student {data.attention.openDoubts === 1 ? 'doubt' : 'doubts'} to answer</span><span class="meta block">AI drafts are ready to review</span></span>
					</a>
				{/if}
				{#if data.attention.drafts}
					<a class="list-row" href="/admin/tests?status=draft">
						<span class="leading-icon"><CircleAlert /></span>
						<span class="grow"><span class="title block">{data.attention.drafts} draft {data.attention.drafts === 1 ? 'test' : 'tests'}</span><span class="meta block">Not visible to students yet</span></span>
					</a>
				{/if}
				{#if !attentionCount && !data.attention.drafts}
					<div class="list-row"><span class="grow muted small">All clear. Nothing waiting on you.</span></div>
				{/if}
			</div>
		</section>
	</div>

	<section class="rise mt-6" style="--i: 4">
		<div class="section-head"><h2 class="section-title">Results</h2></div>
		<div class="mb-3"><Tabs bind:value={tab} label="Results view" items={[{ value: 'recent', label: 'Recent results' }, { value: 'board', label: 'Scoreboard' }]} /></div>
		{#if !data.recent.length}
			<div class="card"><EmptyState compact icon={Trophy} title="No results yet" body="Submitted attempts on published tests appear here." /></div>
		{:else if tab === 'recent'}
			<div class="list">
				{#each data.recent as r (r.attemptId)}
					<a class="list-row" href="/admin/students/{r.userId}">
						<span class="grow"><span class="title block">{r.name}</span><span class="meta block">{r.test} · {when(r.at)}</span></span>
						<span class="trail font-mono tabular"><span class="block font-semibold">{pct(r.percentage)}</span><span class="tiny muted">{r.score ?? '–'}/{r.maxScore ?? '–'}</span></span>
					</a>
				{/each}
			</div>
		{:else}
			<div class="board">
				{#each data.scoreboard as b (b.testId)}
					<div class="card">
						<div class="card-head"><h3 class="truncate">{b.title}</h3><a class="section-link" href="/admin/tests/{b.testId}/results">All</a></div>
						<ol>
							{#each b.rows as r, i (r.userId + i)}
								<li class="list-row">
									<span class="rank font-mono tabular">{i + 1}</span>
									<a class="grow title" href="/admin/students/{r.userId}">{r.name}</a>
									<span class="font-mono tabular small">{r.score}/{r.maxScore} · {pct(r.percentage)}</span>
								</li>
							{:else}
								<li class="list-row muted small">No finished attempts.</li>
							{/each}
						</ol>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: hidden; margin-bottom: 1.5rem; }
	@media (min-width: 768px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
	.kpi { display: flex; flex-direction: column; gap: .125rem; padding: .75rem 1rem; min-width: 0; border-bottom: 1px solid hsl(var(--border)); border-right: 1px solid hsl(var(--border)); margin: 0 -1px -1px 0; }
	a.kpi:hover { background: hsl(var(--muted) / .6); }
	.kpi-value { font-size: 1.375rem; font-weight: 600; line-height: 1.2; }
	.kpi-label { font-size: .75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .cols { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); } }
	.board { display: grid; gap: .75rem; }
	@media (min-width: 768px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	.board ol > * + * { border-top: 1px solid hsl(var(--border)); }
	.rank { width: 1.5rem; color: hsl(var(--muted-foreground)); }
</style>
