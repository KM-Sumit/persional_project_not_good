<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Trail from '$lib/components/Trail.svelte';
	import YouTubeEmbed from '$lib/components/YouTubeEmbed.svelte';
	import { renderMarkdown } from '$lib/features/catalog/markdown';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const html = $derived(renderMarkdown(data.lesson.body));
</script>

<svelte:head>
	<title>{data.lesson.title}</title>
</svelte:head>

<article class="lesson">
	<Trail
		items={[
			{ label: 'Study', href: '/study' },
			{ label: data.courseTitle, href: `/courses/${data.courseId}` },
			{ label: data.lesson.title }
		]}
	/>

	<header>
		<p class="kicker">{data.chapterTitle}</p>
		<h1 class="page-title">{data.lesson.title}</h1>
		<p class="meta">Lesson {data.index + 1} of {data.total} · {data.lesson.durationMinutes} min</p>
	</header>

	{#if data.lesson.kind === 'video' && data.lesson.resourceUrl}
		<YouTubeEmbed url={data.lesson.resourceUrl} title={data.lesson.title} />
	{:else if data.lesson.kind === 'pdf' && data.lesson.resourceUrl}
		<a class="btn btn-secondary" href={data.lesson.resourceUrl} target="_blank" rel="noopener noreferrer">
			Open the PDF
		</a>
	{/if}

	{#if html}
		<div class="md">{@html html}</div>
	{/if}

	<div class="actions">
		{#if data.lesson.completed}
			<p class="done">
				<Check class="size-4" aria-hidden="true" />
				Lesson completed
			</p>
		{:else}
			<form method="POST" action="?/complete">
				<button class="btn btn-primary" type="submit">Mark lesson complete</button>
			</form>
		{/if}
		{#if data.next}
			<a class="btn btn-secondary no-underline" href="/courses/{data.courseId}/lessons/{data.next.id}">
				Next lesson
			</a>
		{/if}
	</div>

	{#if data.previous}
		<a class="prev" href="/courses/{data.courseId}/lessons/{data.previous.id}" data-back>
			{data.previous.title}
		</a>
	{/if}
</article>

<style>
	.lesson {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}
	.prev {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		width: fit-content;
		max-width: 100%;
		font-size: 0.8125rem;
		font-weight: 700;
		color: hsl(var(--foreground));
		text-decoration: none;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		align-items: center;
	}
	.done {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 44px;
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
	}
</style>
