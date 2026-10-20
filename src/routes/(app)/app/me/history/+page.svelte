<script lang="ts">
	import { ClipboardCheck, ClipboardList } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { day } from '#lib/features/courses/components/format';

	let { data } = $props();
	const tone = (p: number | null) => (p == null ? '' : p >= 60 ? 'score-good' : p >= 35 ? 'score-mid' : 'score-low');
</script>

<svelte:head><title>Test history · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<PageHeader title="Test history" subtitle="Every attempt, newest first." crumbs={[{ href: '/app/me', label: 'Me' }]} />

	{#if data.items.length}
		<div class="list rise" style="--i: 1">
			{#each data.items as a (a.attemptId)}
				<a
					class="list-row"
					href={a.status === 'in_progress' ? `/app/tests/${a.testId}/attempt/${a.attemptId}` : `/app/results/${a.attemptId}`}
				>
					<span class="leading-icon"><ClipboardCheck /></span>
					<span class="grow">
						<span class="title block">{a.testTitle}</span>
						<span class="meta block">{day(a.startedAt)} · attempt <span class="tabular">{a.number}</span>{a.status === 'expired' ? ' · time ran out' : ''}</span>
					</span>
					<span class="trail">
						{#if a.status === 'in_progress'}
							<span class="badge badge-live">Resume</span>
						{:else if a.score != null}
							<span class="font-mono tabular font-semibold {tone(a.percentage)}">{a.score}<span class="muted">/{a.maxScore}</span></span>
						{/if}
					</span>
				</a>
			{/each}
		</div>
		{#if data.nextCursor}
			<div class="mt-4 text-center"><a class="btn btn-secondary" href="?cursor={encodeURIComponent(data.nextCursor)}">Load more</a></div>
		{/if}
	{:else}
		<EmptyState icon={ClipboardList} title="No tests taken yet" body="Your scores, ranks and solutions will be listed here after your first test.">
			{#snippet action()}<a class="btn btn-primary" href="/app/tests">Find a test</a>{/snippet}
		</EmptyState>
	{/if}
</div>
