<script lang="ts">
	import { ArrowRight, BookOpen } from '@lucide/svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import CourseCard from '#lib/features/courses/components/CourseCard.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Learn · UCI</title></svelte:head>

<div class="page pb-10 stack-lg">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Learn</h1>
			<p class="page-sub">Video lessons and reading, chapter by chapter.</p>
		</div>
	</header>

	{#if data.cont}
		{@const c = data.cont}
		<section class="card resume rise" style="--i: 0">
			<div class="min-w-0 grow">
				<p class="eyebrow">Continue · {c.course.title}</p>
				<h2 class="resume-title line-clamp-2">{c.lesson.title}</h2>
				<div class="flex items-center gap-3 mt-2">
					<div class="progress grow"><span style="width: {c.progress.percent}%"></span></div>
					<span class="small font-mono tabular">{c.progress.completed}/{c.progress.total}</span>
				</div>
			</div>
			<a class="btn btn-primary" href="/app/learn/{c.course.slug}/{c.lesson.id}">Continue<ArrowRight /></a>
		</section>
	{/if}

	{#if data.mine.length}
		<section class="rise" style="--i: 1">
			<div class="section-head"><h2 class="section-title">My courses</h2></div>
			<div class="grid-courses">
				{#each data.mine as c (c.id)}<CourseCard course={c} progress={c.progress} />{/each}
			</div>
		</section>
	{/if}

	<section class="rise" style="--i: 2">
		<div class="section-head"><h2 class="section-title">{data.mine.length ? 'All courses' : 'Courses'}</h2></div>
		{#if data.chips.length > 1}
			<nav class="chips mb-3" aria-label="Filter by exam">
				<a class="chip" href="?exam=all" aria-current={data.exam === null ? 'true' : undefined} data-sveltekit-replacestate data-sveltekit-noscroll>All</a>
				{#each data.chips as ch (ch.id)}
					<a class="chip" href="?exam={ch.id}" aria-current={data.exam === ch.id ? 'true' : undefined} data-sveltekit-replacestate data-sveltekit-noscroll>{ch.name}</a>
				{/each}
			</nav>
		{/if}
		{#if data.catalog.length}
			<div class="grid-courses">
				{#each data.catalog as c (c.id)}<CourseCard course={c} progress={c.progress} exam={c.examName} />{/each}
			</div>
		{:else}
			<EmptyState icon={BookOpen} title="No courses here yet" body="Courses for this exam are being recorded. Try another exam or check back soon.">
				{#snippet action()}<a class="btn btn-secondary" href="?exam=all">Show all courses</a>{/snippet}
			</EmptyState>
		{/if}
	</section>
</div>

<style>
	.resume {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.125rem 1.25rem;
		border-left: 4px solid hsl(var(--sun));
	}
	.resume-title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.25rem;
		line-height: 1.2;
		margin-top: 0.125rem;
	}
	@media (max-width: 639px) {
		.resume {
			flex-direction: column;
			align-items: stretch;
		}
	}
	.grid-courses {
		display: grid;
		gap: 0.875rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
	}
</style>
