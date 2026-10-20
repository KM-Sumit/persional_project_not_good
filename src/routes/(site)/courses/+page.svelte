<script lang="ts">
	import { page } from '$app/state';
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import CourseTile from '#lib/features/site/components/CourseTile.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
	const name = $derived(new Map(data.exams.map((e) => [e.id, e.name])));
	// The URL is the filter (?exam=ssc-cgl); only exams that have courses get a chip.
	const withCourses = $derived(data.exams.filter((e) => data.courses.some((c) => c.examId === e.id)));
	const sel = $derived(data.exams.find((e) => e.slug === page.url.searchParams.get('exam')) ?? null);
	const shown = $derived(sel ? data.courses.filter((c) => c.examId === sel.id) : data.courses);
</script>

<Seo
	title="Video courses"
	description="UCI video courses for SSC, Railway, MPPSC and MP Police: chapter-wise lessons in Hindi, with free preview lessons."
	crumbs={[...crumbs, { href: '/courses', label: 'Courses' }]}
/>

<div class="page site-page">
	<PageHeader title="Courses" subtitle="Chapter-wise video lessons. Preview lessons are free to watch." {crumbs} />
	{#if withCourses.length > 1}
		<nav class="chips filter" aria-label="Filter by exam">
			<a href="/courses" class="chip" aria-current={sel ? undefined : 'true'} data-sveltekit-noscroll>All</a>
			{#each withCourses as e (e.id)}
				<a href="/courses?exam={e.slug}" class="chip" aria-current={sel?.id === e.id ? 'true' : undefined} data-sveltekit-noscroll>{e.name}</a>
			{/each}
		</nav>
	{/if}
	{#if shown.length}
		<div class="grid-3">
			{#each shown as c, i (c.id)}
				<div class="rise" style="--i: {i}">
					<CourseTile course={c} examName={c.examId ? name.get(c.examId) : undefined} price={data.prices[c.id]?.priceInr} thumb={data.thumbs[c.slug]} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<h3>No courses here yet</h3>
			<p>New courses are being recorded. Meanwhile, try a free mock test.</p>
			<a href="/login?next=/app/tests" class="btn btn-primary">Take a free mock test</a>
		</div>
	{/if}
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.filter {
		margin-bottom: 1.25rem;
	}
	.grid-3 {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 640px) {
		.grid-3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.grid-3 {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
