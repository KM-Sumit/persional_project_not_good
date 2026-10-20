<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import SectionHead from '#lib/features/site/components/SectionHead.svelte';
	import ExamRow from '#lib/features/site/components/ExamRow.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
</script>

<Seo
	title="Exams: SSC, Railway, MPPSC and MP Police"
	description="Pick your government exam to see UCI's free mock tests, previous-year papers, video courses and notes for it."
	crumbs={[...crumbs, { href: '/exams', label: 'Exams' }]}
/>

<div class="page site-page">
	<PageHeader title="Exams" subtitle="Pick your exam. Every page lists its tests, papers, courses and notes." {crumbs} />
	{#each data.hub.categories as c, i (c.id)}
		<section class="cat rise" style="--i: {i}" aria-labelledby="c-{c.slug}">
			<SectionHead id="c-{c.slug}" title={c.name} href="/exams/{c.slug}" link="Open" />
			<div class="rows">
				{#each c.exams as e (e.id)}
					<ExamRow href="/exams/{c.slug}/{e.slug}" name={e.name} description={e.description} counts={data.hub.counts[e.id]} />
				{/each}
			</div>
		</section>
	{:else}
		<div class="empty"><h3>Exams are being added</h3><p>Check back soon, or ask us on the contact page.</p></div>
	{/each}
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.cat + .cat {
		margin-top: 2.5rem;
	}
	.rows {
		display: grid;
		gap: 0.625rem;
	}
	@media (min-width: 768px) {
		.rows {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1200px) {
		.rows {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
