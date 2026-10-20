<script lang="ts">
	// Public course card. Phone: compact row (112px 16:9 thumb + title + meta). >=640px: card with a 16:9 cover.
	// Cover: uploaded/external cover, else the first video lesson's YouTube thumbnail, else a generated title cover.
	import type { CourseCard } from '#lib/features/courses/schema';
	import { fileUrl } from '#lib/features/files/schema';
	import { hours, inr, plural } from './format';

	let { course, examName, price, thumb }: { course: CourseCard; examName?: string; price?: number | null; thumb?: string } = $props();
	const cover = $derived(
		course.coverUrl ?? (course.coverFileId ? fileUrl(course.coverFileId) : thumb ? `https://i.ytimg.com/vi/${thumb}/hqdefault.jpg` : null)
	);
</script>

<a href="/courses/{course.slug}" class="tile press">
	<div class="cover">
		{#if cover}
			<img src={cover} alt="" loading="lazy" width="480" height="270" />
		{:else}
			<span class="gen" aria-hidden="true">{course.title}</span>
		{/if}
	</div>
	<div class="body">
		{#if examName}<p class="exam">{examName}</p>{/if}
		<h3 class="title">{course.title}</h3>
		{#if course.summary}<p class="sum">{course.summary}</p>{/if}
		<p class="meta">
			<span class="tabular">{plural(course.lessonCount, 'lesson')}</span>
			{#if course.durationSec}<span aria-hidden="true">·</span><span class="tabular">{hours(course.durationSec)}</span>{/if}
			<span aria-hidden="true">·</span><span class="price">{price ? inr(price) : 'Free'}</span>
		</p>
	</div>
</a>

<style>
	.tile {
		display: flex;
		gap: 0.875rem;
		align-items: flex-start;
		padding: 0.75rem;
		height: 100%;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.cover {
		position: relative;
		flex: 0 0 112px;
		aspect-ratio: 16 / 9;
		border-radius: 8px;
		overflow: hidden;
		background: linear-gradient(135deg, hsl(var(--sun)) 0%, hsl(24 70% 22%) 55%, #0b0c0e 100%);
	}
	.cover img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gen {
		position: absolute;
		inset: 0;
		padding: 0.375rem 0.5rem;
		display: flex;
		align-items: flex-end;
		color: #fff;
		font-family: var(--font-display);
		font-stretch: 80%;
		font-weight: 800;
		font-size: 0.6875rem;
		line-height: 1.1;
		overflow: hidden;
	}
	.body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.exam {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.title {
		font-weight: 700;
		font-size: 0.9375rem;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.sum {
		display: none;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	.price {
		font-weight: 600;
		color: hsl(var(--foreground));
	}
	@media (min-width: 640px) {
		.tile {
			flex-direction: column;
			gap: 0;
			padding: 0;
		}
		.cover {
			flex: none;
			width: 100%;
			border-radius: 0;
		}
		.gen {
			padding: 1rem 1.125rem;
			font-size: 1.375rem;
			letter-spacing: -0.01em;
		}
		.body {
			padding: 1rem;
			gap: 0.375rem;
		}
		.title {
			font-family: var(--font-display);
			font-stretch: var(--display-stretch);
			font-size: 1.1875rem;
			line-height: 1.2;
		}
		.sum {
			display: -webkit-box;
			font-size: 0.875rem;
			color: hsl(var(--muted-foreground));
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		.meta {
			margin-top: auto;
			padding-top: 0.375rem;
		}
	}
</style>
