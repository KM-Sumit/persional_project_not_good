<script lang="ts">
	// Public reading view of one post, with a sign-in call to action (the quiz and PDFs live in the app).
	import type { Snippet } from 'svelte';
	import { Clock } from '@lucide/svelte';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import PdfViewer from '#lib/components/kit/PdfViewer.svelte';
	import { fmtDay } from '../format';

	type P = { title: string; html: string; publishedOn: string; examName: string | null; readingMinutes: number; fileId: string | null };
	let { post, cta }: { post: P; cta?: Snippet } = $props();
</script>

<article class="rise">
	<p class="meta">
		<time datetime={post.publishedOn}>{fmtDay(post.publishedOn)}</time>
		{#if post.examName}<span>{post.examName}</span>{/if}
		<span class="inline-flex items-center gap-1"><Clock class="size-3.5" aria-hidden="true" />{post.readingMinutes} min read</span>
	</p>
	{#if post.fileId}
		<PdfViewer src="/api/files/{post.fileId}" title={post.title} />
	{/if}
	{#if post.html}<Markdown html={post.html} />{/if}
	{#if cta}<div class="card card-pad cta">{@render cta()}</div>{/if}
</article>

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.875rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.cta {
		margin-top: 2rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
	}
</style>
