<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Download, Users } from '@lucide/svelte';
	import { Badge, Button, EmptyState, Tabs } from '#lib/components/ui';
	import { BarChart, DataTable, Kpi, type Column } from '#lib/components/kit';
	import { fmtDuration, fmtIST } from '#lib/features/bank/components/format';
	import type { ParticipantRow } from '#lib/features/tests/schema';

	let { data } = $props();
	const t = $derived(data.test);
	const s = $derived(data.stats);
	let view = $state('students');

	type Row = ParticipantRow & { id: string; rank: number | null };
	const rows = $derived.by(() => {
		let r = 0;
		return data.rows.map((p): Row => ({ ...p, id: p.attemptId, rank: p.status === 'in_progress' || p.score == null ? null : ++r }));
	});
	const inProgress = $derived(data.rows.filter((p) => p.status === 'in_progress').length);
	const chart = $derived(s.questions.map((q, i) => ({ label: `Q${i + 1}`, value: q.accuracy })));
	const fmt = (n: number | null) => (n == null ? '—' : String(n));

	// A live test in progress refreshes itself.
	$effect(() => {
		if (!(t.kind === 'live' && t.window === 'live')) return;
		const id = setInterval(() => invalidateAll(), 15000);
		return () => clearInterval(id);
	});

	const columns: Column<Row>[] = [
		{ key: 'name', label: 'Student', cell: who },
		{ key: 'score', label: 'Score', align: 'right', cell: score },
		{ key: 'rank', label: 'Rank', cell: rank },
		{ key: 'timeTakenSec', label: 'Time', cell: time },
		{ key: 'phone', label: 'Phone', hideOnPhone: true },
		{ key: 'submittedAt', label: 'Submitted', hideOnPhone: true, cell: submitted }
	];
</script>

{#snippet who(r: Row)}
	<span class="flex min-w-0 flex-col"><span class="font-medium">{r.name}</span><span class="tiny muted truncate">{r.email}</span></span>
{/snippet}
{#snippet score(r: Row)}
	{#if r.status === 'in_progress'}<Badge tone="live">In progress</Badge>{:else}<span class="tabular">{fmt(r.score)}/{fmt(r.maxScore)} <span class="muted">· {fmt(r.percentage)}%</span></span>{/if}
{/snippet}
{#snippet rank(r: Row)}<span class="tabular">{r.rank ? `#${r.rank}` : '—'}{r.number > 1 ? ` · try ${r.number}` : ''}</span>{/snippet}
{#snippet time(r: Row)}<span class="tabular">{fmtDuration(r.timeTakenSec) || '—'}</span>{/snippet}
{#snippet submitted(r: Row)}<span class="small">{r.submittedAt ? fmtIST(r.submittedAt) : r.status === 'expired' ? 'Auto-submitted' : '—'}</span>{/snippet}

<svelte:head><title>Results · {t.title}</title></svelte:head>

<div class="stack-lg">
	{#if s.started}
	<div class="kpis">
		<Kpi label="Started" value={s.started} hint={inProgress ? `${inProgress} writing now` : undefined} />
		<Kpi label="Submitted" value={s.submitted} />
		<Kpi label="Average" value={fmt(s.avg)} hint="of {t.totalMarks}" />
		<Kpi label="Top score" value={fmt(s.top)} />
		<Kpi label="Median" value={fmt(s.median)} />
	</div>
	{/if}

	<div class="flex flex-wrap items-center gap-2">
		<Tabs
			label="Results view"
			bind:value={view}
			items={[
				{ value: 'students', label: 'Students', count: data.rows.length },
				{ value: 'questions', label: 'Questions', count: s.questions.length }
			]}
		/>
		<span class="flex-1"></span>
		<Button variant="secondary" href="/admin/tests/{t.id}/results/export" data-sveltekit-reload disabled={!data.rows.length}>
			<Download class="size-4" />Export CSV
		</Button>
	</div>

	{#if view === 'students'}
		<DataTable rows={rows} {columns}>
			{#snippet empty()}
				<EmptyState icon={Users} title="No attempts yet" body={t.status === 'published' ? 'Results appear as students submit.' : 'Publish the test so students can take it.'} />
			{/snippet}
		</DataTable>
	{:else if s.questions.length}
		<section class="card card-pad stack">
			<h2 class="section-title">Accuracy per question</h2>
			<p class="small muted">Share of students who answered each question correctly, out of those who tried it.</p>
			<BarChart data={chart} format={(n) => `${n}%`} />
			<ol class="qacc">
				{#each s.questions as q, i (q.questionId)}
					<li>
						<span class="tabular muted">Q{i + 1}</span>
						<span class="min-w-0 flex-1 truncate">{q.prompt}</span>
						<span class="tabular small" class:text-danger={q.attempted && q.accuracy < 35}>{q.accuracy}% <span class="muted">of {q.attempted}</span></span>
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<EmptyState icon={Users} title="No questions in this test" />
	{/if}
</div>

<style>
	.kpis {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	@media (min-width: 1024px) {
		.kpis {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}
	.qacc {
		display: grid;
		list-style: none;
		padding: 0;
	}
	.qacc li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-top: 1px solid hsl(var(--border));
		font-size: 0.875rem;
	}
</style>
