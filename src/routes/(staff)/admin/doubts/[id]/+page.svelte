<script lang="ts">
	import { enhance } from '$app/forms';
	import { BookOpen, Sparkles, UserRound } from '@lucide/svelte';
	import { Badge, PageHeader, toast } from '#lib/components/ui';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import { ago, when } from '#lib/features/courses/components/format';

	let { data } = $props();
	const d = $derived(data.doubt);

	// The editor starts from the saved answer, then the teacher owns it.
	// svelte-ignore state_referenced_locally
	let answer = $state(data.doubt.answer ?? '');
	// svelte-ignore state_referenced_locally
	let draft = $state(data.doubt.aiDraft);
	// svelte-ignore state_referenced_locally
	let draftHtml = $state(data.draftHtml);
	let drafting = $state(false);
	let sending = $state(false);
</script>

<svelte:head><title>Doubt · UCI staff</title></svelte:head>

<div class="page">
	<PageHeader title="Answer doubt" crumbs={[{ href: '/admin/doubts', label: 'Doubts' }]} subtitle="Asked {ago(d.createdAt, data.now)} by {d.student.name}" />

	<div class="grid-2">
		<article class="card p-4 rise min-w-0" style="--i: 1">
			<div class="flex items-center justify-between gap-2 mb-3">
				<a class="flex items-center gap-2 min-w-0 small font-semibold hover:underline" href="/admin/students/{d.student.id}">
					<UserRound class="size-4 shrink-0" /><span class="truncate">{d.student.name}</span>
				</a>
				{#if d.status === 'open'}<Badge tone="warning">Open</Badge>{:else if d.status === 'answered'}<Badge tone="success">Answered</Badge>{:else}<Badge tone="closed">Read by student</Badge>{/if}
			</div>
			{#if d.context}
				<p class="small muted mb-2 flex items-center gap-1.5 min-w-0">
					<BookOpen class="size-4 shrink-0" />
					{#if d.contextHref}<a class="truncate hover:underline" href={d.contextHref}>{d.context}</a>{:else}<span class="truncate">{d.context}</span>{/if}
				</p>
			{/if}
			<p class="body">{d.body}</p>
			{#if d.imageUrl}
				<a href={d.imageUrl} target="_blank" rel="noopener" class="photo"><img src={d.imageUrl} alt="Working attached by the student" loading="lazy" /></a>
			{/if}
			{#if d.answeredAt}<p class="tiny muted mt-4">Answered {when(d.answeredAt)}{d.answeredBy ? ` by ${d.answeredBy}` : ''}</p>{/if}
		</article>

		<div class="min-w-0 rise" style="--i: 2">
			<section class="card p-4 ai" aria-labelledby="ai-h">
				<div class="flex items-center justify-between gap-2">
					<h2 id="ai-h" class="text-base font-semibold flex items-center gap-2"><Sparkles class="size-4" />AI draft</h2>
					<form
						method="POST"
						action="?/draft"
						use:enhance={() => {
							drafting = true;
							return async ({ result }) => {
								drafting = false;
								if (result.type === 'success') {
									draft = String(result.data?.draft ?? '');
									draftHtml = String(result.data?.draftHtml ?? '');
								}
								else if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not draft.'), 'error');
								else if (result.type === 'error') toast(result.error?.message ?? 'Could not draft.', 'error');
							};
						}}
					>
						<button class="btn btn-secondary btn-sm" disabled={drafting}>{drafting ? 'Drafting…' : draft ? 'Redraft' : 'Draft with AI'}</button>
					</form>
				</div>
				{#if drafting}
					<div class="mt-3 space-y-2" aria-live="polite" aria-label="Drafting">
						<div class="skeleton h-4 w-11/12"></div>
						<div class="skeleton h-4 w-9/12"></div>
						<div class="skeleton h-4 w-10/12"></div>
					</div>
				{:else if draft}
					<div class="draft mt-3"><Markdown html={draftHtml ?? ''} /></div>
					<div class="mt-3 flex gap-2">
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => (answer = draft ?? '')}>Use this draft</button>
					</div>
				{:else}
					<p class="small muted mt-2">A short first answer from the doubt text only. Check it before sending.</p>
				{/if}
			</section>

			<form
				class="card p-4 mt-4"
				method="POST"
				action="?/answer"
				use:enhance={() => {
					sending = true;
					return async ({ result, update }) => {
						sending = false;
						if (result.type === 'success') toast(String(result.data?.message ?? 'Answer sent'));
						else if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not send.'), 'error');
						else if (result.type === 'error') toast(result.error?.message ?? 'Could not send.', 'error');
						await update({ reset: false });
					};
				}}
			>
				<h2 class="text-base font-semibold mb-2">Your answer</h2>
				<MarkdownEditor bind:value={answer} name="answer" rows={8} placeholder="Explain the step the student missed. Use $x^2$ for maths." />
				<div class="mt-3 flex justify-end">
					<button class="btn btn-primary" disabled={sending || answer.trim().length < 2}>{sending ? 'Sending…' : d.answer ? 'Update answer' : 'Send answer'}</button>
				</div>
			</form>
		</div>
	</div>
</div>

<style>
	.grid-2 {
		display: grid;
		gap: 1rem;
		align-items: start;
	}
	@media (min-width: 1024px) {
		.grid-2 {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		}
	}
	.body {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.draft {
		overflow-wrap: anywhere;
		font-size: 0.9375rem;
		padding: 0.75rem;
		border-radius: 12px;
		background: hsl(var(--muted) / 0.6);
	}
	.photo {
		display: block;
		margin-top: 0.75rem;
	}
	.photo img {
		max-height: 360px;
		max-width: 100%;
		border-radius: 12px;
		border: 1px solid hsl(var(--border));
		object-fit: contain;
		background: hsl(var(--muted));
	}
</style>
