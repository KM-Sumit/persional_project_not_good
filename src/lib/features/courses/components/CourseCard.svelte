<script lang="ts">
	// Course tile: cover (or a typographic admit-card cover), title, size, and progress once started.
	import type { CourseCard, CourseProgress } from '#lib/features/courses/schema';
	import { duration } from './format';

	let { course, progress, exam }: { course: CourseCard; progress?: CourseProgress; exam?: string | null } = $props();
	const cover = $derived(course.coverUrl ?? (course.coverFileId ? `/api/files/${course.coverFileId}` : null));
	const started = $derived(!!progress && progress.completed > 0);
</script>

<a href="/app/learn/{course.slug}" class="card course">
	<div class="cover">
		{#if cover}
			<img src={cover} alt="" loading="lazy" decoding="async" />
		{:else}
			<span class="cover-type" aria-hidden="true">{exam ?? 'UCI'}</span>
		{/if}
	</div>
	<div class="body">
		<h3 class="title line-clamp-2">{course.title}</h3>
		<p class="meta">
			<span class="tabular">{course.lessonCount}</span> lessons{course.durationSec ? ` · ${duration(course.durationSec)}` : ''}
		</p>
		{#if progress && started}
			<div class="flex items-center gap-2 mt-auto pt-2">
				<div class="progress grow" class:is-success={progress.percent === 100}><span style="width: {progress.percent}%"></span></div>
				<span class="tiny tabular muted">{progress.completed}/{progress.total}</span>
			</div>
		{/if}
	</div>
</a>

<style>
	.course {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: inherit;
		transition: border-color 0.15s;
	}
	.course:hover {
		border-color: hsl(var(--foreground) / 0.3);
	}
	.cover {
		aspect-ratio: 16 / 9;
		background: hsl(var(--accent));
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cover-type {
		font-family: var(--font-display);
		font-weight: 800;
		font-stretch: var(--display-stretch);
		font-size: clamp(1.5rem, 1rem + 2vw, 2.25rem);
		color: hsl(var(--accent-foreground));
		letter-spacing: -0.02em;
		padding: 0 1rem;
		text-align: center;
		line-height: 1;
	}
	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.875rem 1rem 1rem;
	}
	.title {
		font-weight: 700;
		font-size: 1rem;
		line-height: 1.3;
	}
	.meta {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	/* Phones: a compact row (thumbnail left) so a list of courses fits on one screen. */
	@media (max-width: 639px) {
		.course {
			flex-direction: row;
		}
		.cover {
			width: 7.5rem;
			flex-shrink: 0;
			aspect-ratio: auto;
			align-self: stretch;
		}
		.cover-type {
			font-size: 1.125rem;
		}
		.body {
			padding: 0.75rem 0.875rem;
		}
	}
</style>
