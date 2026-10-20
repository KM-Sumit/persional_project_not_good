<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PersonCard from '#lib/features/site/components/PersonCard.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
	const toppers = $derived(data.site.toppers);
</script>

<Seo title="Results and selections" description="Students of Upendra Competition Institute selected in SSC, Railway, MPPSC and MP Police exams." crumbs={[...crumbs, { href: '/results', label: 'Results' }]} />

<div class="page site-page">
	<PageHeader title="Results" subtitle="UCI students selected in government exams." {crumbs} />
	{#if toppers.length}
		<div class="grid-people">
			{#each toppers as t, i (t.id)}
				<div class="rise" style="--i: {i}"><PersonCard name={t.name} photo={t.photo} role={t.result} meta={t.exam} quote={t.quote} /></div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<h3>Results are being updated</h3>
		</div>
	{/if}
	<div class="end">
		<p class="end-t">Start your own preparation</p>
		<a href="/login?next=/app/tests" class="btn btn-primary">Take a free mock test</a>
	</div>
</div>

<style>
	.site-page { padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem); }
	.grid-people { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	@media (min-width: 768px) { .grid-people { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	@media (min-width: 1200px) { .grid-people { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
	.end { margin-top: 2.5rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem; border: 1px dashed hsl(var(--border)); border-radius: var(--radius); }
	.end-t { font-family: var(--font-display); font-stretch: var(--display-stretch); font-weight: 700; font-size: 1.25rem; }
</style>
