<script lang="ts">
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tab = $derived.by(() => {
		const raw = page.url.searchParams.get('tab');
		if (raw === 'notes') return 'notes';
		if (raw === 'courses') return 'courses';
		if (data.courses.length === 0 && data.notes.length > 0) return 'notes';
		return 'courses';
	});
</script>

<svelte:head>
	<title>Study</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<header class="flex flex-col gap-1">
		<h1 class="page-title text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
			Study
		</h1>
		<p class="meta text-[15px]">Courses and revision notes in one place.</p>
	</header>

	<div class="chip-row" role="tablist" aria-label="Study material">
		<a
			class="chip"
			href="/study?tab=courses"
			role="tab"
			aria-selected={tab === 'courses'}
			data-active={tab === 'courses' ? 'true' : undefined}
		>
			Courses
			{#if data.courses.length}
				<span class="tabular-nums opacity-70">{data.courses.length}</span>
			{/if}
		</a>
		<a
			class="chip"
			href="/study?tab=notes"
			role="tab"
			aria-selected={tab === 'notes'}
			data-active={tab === 'notes' ? 'true' : undefined}
		>
			Notes
			{#if data.notes.length}
				<span class="tabular-nums opacity-70">{data.notes.length}</span>
			{/if}
		</a>
	</div>

	{#if tab === 'courses'}
		<section>
			{#if data.courses.length === 0}
				<p class="meta py-6">No courses yet. Published courses will show up here.</p>
			{:else}
				<div class="list-plain">
					{#each data.courses as course (course.id)}
						<a class="row" href="/courses/{course.id}">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="truncate text-[15px] font-semibold">{course.title}</span>
								<span class="meta">
									{course.instructor} · {course.exam} · {course.lessonCount} lessons
								</span>
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		<section>
			{#if data.notes.length === 0}
				<p class="meta py-6">No notes yet. Revision sheets will show up here.</p>
			{:else}
				<div class="list-plain">
					{#each data.notes as note (note.id)}
						<a class="row" href="/notes/{note.id}">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="truncate text-[15px] font-semibold">{note.title}</span>
								<span class="meta">{note.subject} · {note.exam}</span>
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
