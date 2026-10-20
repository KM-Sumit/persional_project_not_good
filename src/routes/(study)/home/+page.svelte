<script lang="ts">
	import { formatMarks } from '$lib/features/attempts/score';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const first = $derived(data.user.name.trim().split(/\s+/)[0] || data.user.name);

	const next = $derived.by(() => {
		if (data.continueLearning) {
			return {
				href: `/courses/${data.continueLearning.courseId}`,
				label: 'Continue learning',
				title: data.continueLearning.title,
				meta: `${data.continueLearning.completed} of ${data.continueLearning.total} lessons`
			};
		}
		const test = data.tests[0];
		if (!test) return null;
		return {
			href: `/tests/${test.id}`,
			label: 'Start a test',
			title: test.title,
			meta: `${test.questionCount} questions · ${test.durationMinutes} min`
		};
	});
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<div class="flex flex-col gap-9">
	<header class="flex flex-col gap-1">
		<p class="kicker">Welcome back</p>
		<h1 class="page-title text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
			Hello, {first}
		</h1>
	</header>

	{#if next}
		<a class="hero-cta press" href={next.href}>
			<div class="min-w-0 flex-1">
				<p class="hero-label">{next.label}</p>
				<p class="hero-title">{next.title}</p>
				<p class="meta mt-1">{next.meta}</p>
			</div>
			<span class="hero-icon" aria-hidden="true">
				<ArrowRight class="size-5" strokeWidth={2.25} />
			</span>
		</a>
	{/if}

	{#each data.banners as banner (banner.id)}
		{#if banner.href}
			<a class="card press block no-underline" href={banner.href}>
				<p class="text-[15px] font-semibold">{banner.title}</p>
				{#if banner.subtitle}
					<p class="meta mt-1">{banner.subtitle}</p>
				{/if}
			</a>
		{/if}
	{/each}

	<section>
		<div class="section-head">
			<h2>Practice</h2>
			<a href="/tests">See all</a>
		</div>
		{#if data.tests.length === 0}
			<p class="meta">No papers yet. Published tests show up here.</p>
		{:else}
			<div class="list-plain">
				{#each data.tests as test (test.id)}
					<a class="row" href="/tests/{test.id}">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[15px] font-semibold">{test.title}</span>
							<span class="meta">
								{#if test.accessType === 'password'}
									Password
								{:else if test.joinCode}
									<span class="font-mono tracking-wide">{test.joinCode}</span>
								{:else if test.chapterTitle}
									{test.chapterTitle}
								{:else if test.testType === 'pyq'}
									Previous-year paper
								{/if}
								· {test.questionCount} questions · {test.durationMinutes} min
								{#if test.negativeMilli > 0}
									· −{formatMarks(test.negativeMilli)}
								{/if}
							</span>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section>
		<div class="section-head">
			<h2>Study</h2>
			<a href="/study">Open</a>
		</div>
		{#if data.courses.length === 0 && data.notes.length === 0}
			<p class="meta">Courses and notes will show up here.</p>
		{:else}
			<div class="list-plain">
				{#each data.courses as course (course.id)}
					<a class="row" href="/courses/{course.id}">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[15px] font-semibold">{course.title}</span>
							<span class="meta">{course.exam} · {course.lessonCount} lessons</span>
						</span>
					</a>
				{/each}
				{#each data.notes as note (note.id)}
					<a class="row" href="/notes/{note.id}">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[15px] font-semibold">{note.title}</span>
							<span class="meta">{note.subject}</span>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>
