<script lang="ts">
	import { BookOpen, Clock } from '@lucide/svelte';
	import { Badge, PageHeader } from '#lib/components/ui';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import AskDoubtButton from '#lib/features/doubts/components/AskDoubtButton.svelte';
	import { ago, when } from '#lib/features/courses/components/format';

	let { data } = $props();
	const d = $derived(data.doubt);
</script>

<svelte:head><title>Doubt · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<PageHeader title="Your doubt" crumbs={[{ href: '/app/doubts', label: 'Doubts' }]} subtitle="Asked {ago(d.createdAt, data.now)}" />

	<article class="card p-4 rise" style="--i: 1">
		{#if d.context}
			<p class="small muted mb-2 flex items-center gap-1.5 min-w-0">
				<BookOpen class="size-4 shrink-0" />
				{#if d.contextHref}<a class="truncate underline-offset-2 hover:underline" href={d.contextHref}>{d.context}</a>{:else}<span class="truncate">{d.context}</span>{/if}
			</p>
		{/if}
		<p class="body">{d.body}</p>
		{#if d.imageUrl}
			<a href={d.imageUrl} target="_blank" rel="noopener" class="photo"><img src={d.imageUrl} alt="Your working, attached to the doubt" loading="lazy" /></a>
		{/if}
	</article>

	{#if d.answerHtml}
		<section class="card p-4 mt-4 rise answer" style="--i: 2" aria-labelledby="answer-h">
			<div class="flex items-center justify-between gap-2 mb-2">
				<h2 id="answer-h" class="text-base font-semibold">Teacher's answer</h2>
				{#if d.unread}<Badge tone="primary">New</Badge>{/if}
			</div>
			<Markdown html={d.answerHtml} />
			{#if d.answeredAt}<p class="tiny muted mt-3">Answered {when(d.answeredAt)}</p>{/if}
		</section>
		<div class="mt-6 flex justify-center"><AskDoubtButton label="Ask a follow-up" lessonId={d.lessonId ?? undefined} questionId={d.questionId ?? undefined} /></div>
	{:else}
		<div class="waiting mt-4 rise" style="--i: 2">
			<Clock class="size-5 shrink-0" />
			<div>
				<p class="font-semibold">Waiting for a teacher</p>
				<p class="small muted">Most doubts are answered within a day. The answer shows up here with a dot on your Doubts list.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.body {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.photo {
		display: block;
		margin-top: 0.75rem;
	}
	.photo img {
		max-height: 320px;
		max-width: 100%;
		border-radius: 12px;
		border: 1px solid hsl(var(--border));
		object-fit: contain;
		background: hsl(var(--muted));
	}
	.answer {
		border-left: 3px solid hsl(var(--primary));
	}
	.waiting {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 14px;
		background: hsl(var(--muted) / 0.6);
		color: hsl(var(--foreground));
	}
	.waiting :global(svg) {
		color: hsl(var(--muted-foreground));
		margin-top: 2px;
	}
</style>
