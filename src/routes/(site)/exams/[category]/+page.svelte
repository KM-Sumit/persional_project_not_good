<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import ExamRow from '#lib/features/site/components/ExamRow.svelte';

	let { data } = $props();
	const c = $derived(data.category);
	const crumbs = [
		{ href: '/', label: 'Home' },
		{ href: '/exams', label: 'Exams' }
	];
</script>

<Seo
	title="{c.name}: tests, papers and courses"
	description={c.description || `Free mock tests, previous-year papers, video courses and notes for ${c.exams.map((e) => e.name).join(', ')} at UCI.`}
	crumbs={[...crumbs, { href: `/exams/${c.slug}`, label: c.name }]}
/>

<div class="page site-page">
	<PageHeader title={c.name} subtitle={c.description || 'Pick an exam to see its tests, papers, courses and notes.'} {crumbs} />
	<div class="layout">
		<nav class="side" aria-label="Exam categories">
			<div class="chips">
				{#each data.categories as k (k.id)}
					<a href="/exams/{k.slug}" class="chip" aria-current={k.id === c.id ? 'true' : undefined}>{k.name}</a>
				{/each}
			</div>
		</nav>
		<div class="rows">
			{#each c.exams as e, i (e.id)}
				<div class="rise" style="--i: {i}">
					<ExamRow href="/exams/{c.slug}/{e.slug}" name={e.name} description={e.description} counts={data.counts[e.id]} />
				</div>
			{:else}
				<div class="empty"><h3>No exams here yet</h3><p>Exams in this category will appear as soon as they are added.</p></div>
			{/each}
		</div>
	</div>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.layout {
		display: grid;
		gap: 1rem;
	}
	.rows {
		display: grid;
		gap: 0.625rem;
		align-content: start;
	}
	@media (min-width: 768px) {
		.rows {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: 13rem minmax(0, 1fr);
			gap: 2rem;
		}
		.side .chips {
			flex-direction: column;
			margin: 0;
			padding: 0;
			position: sticky;
			top: 80px;
		}
		.side .chip {
			justify-content: flex-start;
		}
	}
</style>
