<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PersonCard from '#lib/features/site/components/PersonCard.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
	const faculty = $derived(data.site.faculty);
</script>

<Seo title="Faculty" description="The teachers at Upendra Competition Institute and the subjects they teach for SSC, Railway, MPPSC and MP Police." crumbs={[...crumbs, { href: '/faculty', label: 'Faculty' }]} />

<div class="page site-page">
	<PageHeader title="Faculty" subtitle="The teachers you learn from, in class and in the app." {crumbs} />
	{#if faculty.length}
		<div class="grid-people">
			{#each faculty as t, i (t.id)}
				<div class="rise" style="--i: {i}"><PersonCard name={t.name} photo={t.photo} role={t.subject} quote={t.bio} /></div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<h3>Faculty profiles are being added</h3>
			<p>Call or visit to meet the teachers of your batch.</p>
		</div>
	{/if}
	<div class="end">
		<p class="end-t">See the courses they teach</p>
		<a href="/courses" class="btn btn-primary">Browse courses</a>
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
