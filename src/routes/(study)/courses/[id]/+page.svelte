<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const lessons = $derived(data.chapters.flatMap((chapter) => chapter.lessons));
	const done = $derived(lessons.filter((lesson) => lesson.completed).length);
	const progress = $derived(lessons.length ? Math.round((done / lessons.length) * 100) : 0);
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="syllabus">
	<Trail items={[{ label: 'Study', href: '/study' }, { label: data.title }]} />

	<header>
		<p class="kicker">{data.exam}</p>
		<h1 class="page-title">{data.title}</h1>
		<p class="lead">{data.description}</p>
	</header>

	{#if lessons.length === 0}
		<p class="meta">No lessons yet.</p>
	{:else}
		<div class="progress">
			<div class="meter" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
				<span style="width: {progress}%"></span>
			</div>
			<p class="meta">{done} of {lessons.length} lessons complete</p>
		</div>

		{#each data.chapters as chapter (chapter.id)}
			<section>
				<h2>{chapter.title}</h2>
				<div class="list-plain">
					{#each chapter.lessons as lesson (lesson.id)}
						<a class="row" href="/courses/{data.id}/lessons/{lesson.id}">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="title">{lesson.title}</span>
								<span class="meta">
									{lesson.durationMinutes} min
									{#if lesson.completed}
										· Done
									{/if}
								</span>
							</span>
						</a>
					{/each}
					{#each chapter.tests as test (test.id)}
						<a class="row" href="/tests/{test.id}">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="title">{test.title}</span>
								<span class="meta">{test.durationMinutes} min paper</span>
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>

<style>
	.syllabus {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}
	.lead {
		max-width: 62ch;
		margin: 0.55rem 0 0;
		font-size: 1rem;
		line-height: 1.55;
		color: hsl(var(--foreground));
	}
	.progress {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	section h2 {
		margin: 0 0 0.15rem;
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 700;
	}
	.title {
		font-size: 0.975rem;
		font-weight: 650;
		line-height: 1.35;
	}
</style>
