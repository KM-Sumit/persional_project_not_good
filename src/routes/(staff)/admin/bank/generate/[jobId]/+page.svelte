<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Check, CircleAlert, LoaderCircle, Pencil, RotateCcw, Sparkles, X } from '@lucide/svelte';
	import { Badge, Button, PageHeader, Skeleton, Switch, Tabs, toast } from '#lib/components/ui';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import { LETTERS, difficultyLabel, fmtIST } from '#lib/features/bank/components/format';
	import type { AiJobDto, GeneratedQuestion } from '#lib/features/ai/schema';

	let { data } = $props();

	type Item = GeneratedQuestion & { key: number; state: 'pending' | 'accepted' | 'rejected'; editing: boolean };
	let job = $state<AiJobDto>(data.job);
	let items = $state<Item[]>([]);
	let filter = $state('all');
	let moduleId = $state(data.modules[0]?.id ?? '');
	let newModule = $state('');
	let makeTest = $state(page.url.searchParams.get('then') === 'test');
	let busy = $state(false);

	const seed = (j: AiJobDto) => (items = j.questions.map((q, key) => ({ ...q, options: [...q.options], key, state: 'pending', editing: false })));
	seed(data.job);

	const working = $derived(job.status === 'queued' || job.status === 'running');
	// Poll while the job runs; when it settles, reload so the review grid fills.
	$effect(() => {
		if (!working) return;
		const t = setInterval(async () => {
			const res = await fetch(`/api/ai/jobs/${job.id}`);
			if (!res.ok) return;
			const next: AiJobDto = await res.json();
			if (next.status !== job.status || next.questions.length !== job.questions.length) {
				job = next;
				seed(next);
				if (next.status !== 'running' && next.status !== 'queued') invalidateAll();
			}
		}, 2000);
		return () => clearInterval(t);
	});

	const count = (s: Item['state']) => items.filter((i) => i.state === s).length;
	const shown = $derived(filter === 'all' ? items : items.filter((i) => i.state === filter));
	const accepted = $derived(items.filter((i) => i.state === 'accepted'));
	const payload = $derived(
		JSON.stringify(accepted.map(({ prompt, options, correctIndex, explanation, topic, difficulty }) => ({ prompt, options, correctIndex, explanation, topic, difficulty })))
	);
	const title = $derived(String(job.input.topic ?? '') || (job.source === 'ai_pdf' ? 'Questions from PDF' : 'Generated questions'));
	const statusTone = { queued: 'draft', running: 'live', ready: 'primary', failed: 'danger', applied: 'success' } as const;
	const tokens = $derived((job.inputTokens ?? 0) + (job.outputTokens ?? 0));
</script>

<svelte:head><title>{title} · AI review</title></svelte:head>

<div class="page" class:has-bar={job.status === 'ready'}>
	<PageHeader
		{title}
		eyebrow={job.source === 'ai_pdf' ? 'From a PDF' : 'From a topic'}
		crumbs={[
			{ href: '/admin/bank', label: 'Question bank' },
			{ href: '/admin/bank/generate', label: 'Generate' }
		]}
	/>

	<div class="card card-pad jobhead">
		<Badge tone={statusTone[job.status]}>{job.status === 'ready' ? 'Ready for review' : job.status}</Badge>
		<span class="small muted">Started {fmtIST(job.createdAt)}</span>
		{#if job.model}<span class="small muted">Model {job.model}</span>{/if}
		{#if tokens}<span class="small muted tabular">{tokens.toLocaleString('en-IN')} tokens</span>{/if}
		{#if job.status === 'ready' || job.status === 'applied'}
			<span class="small muted tabular">{job.questions.length}/{job.requested} drafted{job.dropped ? ` · ${job.dropped} dropped` : ''}</span>
		{/if}
	</div>

	{#if working}
		<div class="stack mt-4" aria-live="polite">
			<p class="flex items-center gap-2 small"><LoaderCircle class="size-4 animate-spin" />Drafting {job.requested} questions. This usually takes under a minute.</p>
			{#each { length: 3 } as _, i (i)}
				<div class="card card-pad stack-sm"><Skeleton class="h-4 w-3/4" /><Skeleton rows={4} /></div>
			{/each}
		</div>
	{:else if job.status === 'failed'}
		<div class="alert alert-danger mt-4 stack-sm">
			<p class="flex items-center gap-2 font-semibold"><CircleAlert class="size-4" />The run failed</p>
			<p>{job.error ?? 'Unknown error.'}</p>
			<div><Button variant="secondary" href="/admin/bank/generate"><RotateCcw class="size-4" />Try again</Button></div>
		</div>
	{:else if job.status === 'applied'}
		<div class="alert alert-success mt-4">These questions were added to the bank. <a class="underline" href="/admin/bank">Open the bank</a></div>
		<div class="stack mt-4">
			{#each job.questions as q, i (i)}
				<div class="card card-pad"><QuestionView {...q} number={i + 1} /></div>
			{/each}
		</div>
	{:else}
		<div class="mt-4 flex flex-wrap items-center gap-2">
			<Tabs
				label="Filter"
				bind:value={filter}
				items={[
					{ value: 'all', label: 'All', count: items.length },
					{ value: 'pending', label: 'To review', count: count('pending') },
					{ value: 'accepted', label: 'Accepted', count: count('accepted') },
					{ value: 'rejected', label: 'Rejected', count: count('rejected') }
				]}
			/>
			<span class="flex-1"></span>
			<Button variant="secondary" size="sm" onclick={() => items.forEach((i) => i.state === 'pending' && (i.state = 'accepted'))}>
				<Check class="size-4" />Accept the rest
			</Button>
		</div>

		<ol class="review mt-4">
			{#each shown as q (q.key)}
				<li class="card card-pad stack-sm" class:is-accepted={q.state === 'accepted'} class:is-rejected={q.state === 'rejected'}>
					{#if q.editing}
						<div class="field">
							<label class="label" for="p-{q.key}">Question {q.key + 1}</label>
							<textarea id="p-{q.key}" class="textarea" rows="3" bind:value={q.prompt}></textarea>
						</div>
						{#each q.options as _, oi (oi)}
							<div class="flex items-center gap-2">
								<label class="pick">
									<input type="radio" name="c-{q.key}" checked={q.correctIndex === oi} onchange={() => (q.correctIndex = oi)} />
									<span class="font-mono">{LETTERS[oi]}</span>
								</label>
								<input class="input flex-1" aria-label="Option {LETTERS[oi]}" bind:value={q.options[oi]} />
							</div>
						{/each}
						<div class="field">
							<label class="label" for="e-{q.key}">Explanation</label>
							<textarea id="e-{q.key}" class="textarea" rows="2" bind:value={q.explanation}></textarea>
						</div>
						<div class="form-row">
							<div class="field">
								<label class="label" for="t-{q.key}">Topic</label>
								<input id="t-{q.key}" class="input" bind:value={q.topic} />
							</div>
							<div class="field">
								<label class="label" for="d-{q.key}">Difficulty</label>
								<select id="d-{q.key}" class="select" bind:value={q.difficulty}>
									<option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
								</select>
							</div>
						</div>
						<div class="flex justify-end"><Button size="sm" onclick={() => ((q.editing = false), (q.state = 'accepted'))}>Done</Button></div>
					{:else}
						<QuestionView prompt={q.prompt} options={q.options} correctIndex={q.correctIndex} explanation={q.explanation} number={q.key + 1} />
						<div class="flex flex-wrap items-center gap-2">
							<Badge>{difficultyLabel[q.difficulty]}</Badge>
							{#if q.topic}<span class="tiny muted">{q.topic}</span>{/if}
							<span class="flex-1"></span>
							<Button variant="ghost" size="sm" onclick={() => (q.editing = true)}><Pencil class="size-4" />Edit</Button>
							<Button variant={q.state === 'rejected' ? 'danger' : 'ghost'} size="sm" aria-pressed={q.state === 'rejected'} onclick={() => (q.state = q.state === 'rejected' ? 'pending' : 'rejected')}>
								<X class="size-4" />{q.state === 'rejected' ? 'Rejected' : 'Reject'}
							</Button>
							<Button variant={q.state === 'accepted' ? 'success' : 'secondary'} size="sm" aria-pressed={q.state === 'accepted'} onclick={() => (q.state = q.state === 'accepted' ? 'pending' : 'accepted')}>
								<Check class="size-4" />{q.state === 'accepted' ? 'Accepted' : 'Accept'}
							</Button>
						</div>
					{/if}
				</li>
			{:else}
				<li class="small muted">Nothing here.</li>
			{/each}
		</ol>

		<form
			method="POST"
			action="?/apply"
			class="card card-pad stack mt-6"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not add.'), 'error');
					else if (result.type === 'redirect') toast(`${accepted.length} questions added to the bank`);
					await update();
				};
			}}
		>
			<h2 class="section-title">Add accepted questions to the bank</h2>
			<input type="hidden" name="questions" value={payload} />
			<div class="form-row">
				<div class="field">
					<label class="label" for="ap-module">Module</label>
					<select id="ap-module" name="moduleId" class="select" bind:value={moduleId} disabled={!!newModule.trim()}>
						{#each data.modules as m (m.id)}<option value={m.id}>{m.name} ({m.questionCount})</option>{/each}
						<option value="">Unfiled (no module)</option>
					</select>
				</div>
				<div class="field">
					<label class="label" for="ap-new">Or a new module <span class="opt">(optional)</span></label>
					<input id="ap-new" name="newModule" class="input" bind:value={newModule} maxlength="200" placeholder={title} />
				</div>
			</div>
			<Switch bind:checked={makeTest} name="createTest" label="Also create a draft test" description="A practice test with exactly these questions." />
			{#if makeTest}
				<div class="field">
					<label class="label" for="ap-title">Test title</label>
					<input id="ap-title" name="testTitle" class="input" value={title} maxlength="200" />
				</div>
			{/if}
			<div class="flex flex-wrap items-center justify-end gap-3">
				<span class="small muted tabular">{accepted.length} accepted · {count('rejected')} rejected · {count('pending')} left</span>
				<Button type="submit" loading={busy} disabled={!accepted.length}><Sparkles class="size-4" />Add {accepted.length} to bank</Button>
			</div>
		</form>
	{/if}
</div>

<style>
	.jobhead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.review {
		display: grid;
		gap: 0.75rem;
		list-style: none;
		padding: 0;
	}
	.review li.is-accepted {
		border-color: hsl(var(--success) / 0.6);
	}
	.review li.is-rejected {
		opacity: 0.55;
	}
	.pick {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 44px;
		min-height: 44px;
	}
	.pick input {
		accent-color: hsl(var(--success));
	}
</style>
