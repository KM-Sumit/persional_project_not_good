<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Check, CircleAlert, LoaderCircle, RotateCcw, Send, X } from '@lucide/svelte';
	import { PageHeader, Skeleton, toast } from '#lib/components/ui';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import type { AiJobDto } from '#lib/features/ai/schema';
	import { fmtDay } from '#lib/features/posts/format';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let job = $state<AiJobDto>(data.job);
	// svelte-ignore state_referenced_locally
	let rejected = $state<boolean[]>(data.job.questions.map(() => false));
	let busy = $state(false);

	const working = $derived(job.status === 'queued' || job.status === 'running');
	$effect(() => {
		if (!working) return;
		const t = setInterval(async () => {
			const res = await fetch(`/api/ai/jobs/${job.id}`);
			if (!res.ok) return;
			const next: AiJobDto = await res.json();
			if (next.status === job.status) return;
			job = next;
			rejected = next.questions.map(() => false);
			if (next.status !== 'running' && next.status !== 'queued') invalidateAll();
		}, 2000);
		return () => clearInterval(t);
	});

	const kept = $derived(job.questions.filter((_, i) => !rejected[i]));
	const payload = $derived(JSON.stringify(kept));
	const back = $derived(`/admin/posts/${data.post.id}`);
	const day = $derived(fmtDay(data.post.publishedOn, { day: 'numeric', month: 'short', year: 'numeric' }));
</script>

<svelte:head><title>Quiz review · {data.post.title} · UCI staff</title></svelte:head>

<div class="page-narrow">
	<PageHeader
		title="Daily quiz: {day}"
		subtitle="Drafted from “{data.post.title}”. Reject anything wrong, then publish."
		crumbs={[
			{ href: '/admin/posts', label: 'Daily posts' },
			{ href: back, label: data.post.title }
		]}
	/>

	{#if working}
		<div class="stack" aria-live="polite">
			<p class="flex items-center gap-2 text-sm"><LoaderCircle class="size-4 animate-spin" />Drafting {job.requested} questions. Usually under a minute.</p>
			{#each { length: 3 } as _, i (i)}
				<div class="card card-pad stack-sm"><Skeleton class="h-4 w-3/4" /><Skeleton rows={4} /></div>
			{/each}
		</div>
	{:else if job.status === 'failed'}
		<div class="alert alert-danger stack-sm">
			<p class="flex items-center gap-2 font-semibold"><CircleAlert class="size-4" />The draft failed</p>
			<p>{job.error ?? 'Unknown error.'}</p>
			<div><a class="btn btn-secondary" href={back}><RotateCcw class="size-4" />Back to the post</a></div>
		</div>
	{:else if job.status === 'applied' || data.post.quizTestId}
		<div class="alert alert-success">This quiz is already published. <a class="underline" href={back}>Back to the post</a></div>
	{:else}
		<ol class="review">
			{#each job.questions as q, i (i)}
				<li class="card card-pad stack-sm" class:is-rejected={rejected[i]}>
					<QuestionView prompt={q.prompt} options={q.options} correctIndex={q.correctIndex} explanation={q.explanation} number={i + 1} />
					<div class="flex justify-end">
						<button type="button" class="btn btn-sm {rejected[i] ? 'btn-secondary' : 'btn-ghost'}" aria-pressed={rejected[i]} onclick={() => (rejected[i] = !rejected[i])}>
							{#if rejected[i]}<Check class="size-4" />Keep{:else}<X class="size-4" />Reject{/if}
						</button>
					</div>
				</li>
			{:else}
				<li class="text-sm text-muted-foreground">The AI returned no usable questions. Add more detail to the post and generate again.</li>
			{/each}
		</ol>

		<form
			method="POST"
			action="?/publish"
			class="actionbar"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not publish.'), 'error');
					else if (result.type === 'redirect') toast('Daily quiz published');
					await update();
				};
			}}
		>
			<input type="hidden" name="questions" value={payload} />
			<div class="actionbar-inner">
				<span class="flex-none text-sm text-muted-foreground"><span class="font-mono tabular">{kept.length}</span> of {job.questions.length} kept</span>
				<button class="btn btn-primary" disabled={busy || !kept.length}><Send class="size-4" />{busy ? 'Publishing…' : 'Publish quiz'}</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.review {
		display: grid;
		gap: 0.75rem;
		list-style: none;
		padding: 0;
	}
	.review li.is-rejected {
		opacity: 0.55;
	}
</style>
