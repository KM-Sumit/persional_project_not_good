<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { ExternalLink, ListChecks, Sparkles, Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import PostForm from '#lib/features/posts/components/PostForm.svelte';
	import { postAction } from '#lib/features/courses/components/admin/submit';
	import { kindLabel } from '#lib/features/posts/format';

	let { data } = $props();
	const p = $derived(data.post);
	let deleteOpen = $state(false);
	let starting = $state(false);
	const publicPath = $derived(p.kind === 'current_affairs' ? `/current-affairs/${p.slug}` : p.kind === 'job_alert' ? `/jobs/${p.slug}` : null);

	onMount(() => {
		if (!page.url.searchParams.has('created')) return;
		toast('Post saved');
		const u = new URL(page.url.href);
		u.searchParams.delete('created');
		replaceState(u, page.state);
	});
</script>

<svelte:head><title>{p.title} · Daily posts · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader
		title={p.title}
		eyebrow="{p.published ? 'Published' : 'Draft'} · {kindLabel[p.kind]}"
		crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/posts', label: 'Daily posts' }]}
	>
		{#snippet actions()}
			{#if p.published && publicPath}<a href={publicPath} class="btn btn-ghost" target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View</a>{/if}
		{/snippet}
	</PageHeader>

	{#if p.kind === 'current_affairs'}
		<section class="card card-pad quiz rise" aria-label="Daily quiz">
			<span class="quiz-icon"><ListChecks aria-hidden="true" /></span>
			{#if data.quiz}
				<div class="min-w-0 flex-1">
					<p class="font-semibold">{data.quiz.title}</p>
					<p class="text-sm text-muted-foreground">
						<span class="font-mono tabular">{data.quiz.questionCount}</span> questions · {data.quiz.status === 'published' ? 'live for students' : data.quiz.status}
					</p>
				</div>
				<a class="btn btn-secondary btn-sm flex-none" href="/admin/tests/{data.quiz.id}">Open test</a>
			{:else}
				<div class="min-w-0 flex-1">
					<p class="font-semibold">Daily quiz</p>
					<p class="text-sm text-muted-foreground">The AI drafts 10 questions from the saved text below. You review them before they go live.</p>
				</div>
				<form
					method="POST"
					action="?/quiz"
					class="flex-none"
					use:enhance={() => {
						starting = true;
						return async ({ result, update }) => {
							if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not start.'), 'error');
							await update({ reset: false });
							starting = false;
						};
					}}
				>
					<button class="btn btn-primary btn-sm" disabled={starting}><Sparkles aria-hidden="true" />{starting ? 'Starting…' : 'Generate quiz'}</button>
				</form>
			{/if}
		</section>
	{/if}

	<div class="card card-pad rise" style="--i: 1">
		{#key p.id}
			<PostForm post={p} today={data.today} exams={data.exams} action="?/save" submitLabel="Save post" />
		{/key}
	</div>
	<div>
		<button type="button" class="btn btn-ghost text-danger" onclick={() => (deleteOpen = true)}><Trash2 aria-hidden="true" />Delete post</button>
	</div>
</div>

<ConfirmSheet
	bind:open={deleteOpen}
	title="Delete this post?"
	body="It disappears from the app and the website. Its quiz test stays in Tests. This cannot be undone."
	confirmLabel="Delete post"
	danger
	onconfirm={async () => {
		if (!(await postAction('?/delete', {}))) throw new Error('failed');
	}}
/>

<style>
	.quiz {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 0.875rem;
	}
	.quiz-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 10px;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
</style>
