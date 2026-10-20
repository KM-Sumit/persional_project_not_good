<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { ArrowDown, ArrowUp, Library, ListPlus, Pencil, PenLine, Search, Trash2 } from '@lucide/svelte';
	import { Badge, Button, EmptyState, Sheet, toast } from '#lib/components/ui';
	import { Picker } from '#lib/components/kit';
	import QuestionEditor from '#lib/features/bank/components/QuestionEditor.svelte';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import { difficultyLabel } from '#lib/features/bank/components/format';
	import type { QuestionDTO } from '#lib/features/bank/schema';
	import type { TestQuestionDTO } from '#lib/features/tests/schema';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	const t = $derived(data.test);

	let order = $state<TestQuestionDTO[]>([]);
	$effect(() => {
		order = [...data.questions];
	});

	let writing = $state(false);
	let editing = $state<TestQuestionDTO | null>(null);
	let adding = $state(false);
	let building = $state(false);
	let buildModule = $state<string | null>(null);

	type Done = Parameters<Exclude<ReturnType<SubmitFunction>, void | Promise<unknown>>>[0];
	const after = async ({ result, update }: Done) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Failed.'), 'error');
		else if (result.type === 'success') toast(String(result.data?.message ?? 'Saved'));
		await update({ reset: false });
	};
	const done: SubmitFunction = () => after;

	async function post(action: string, fields: Record<string, string>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(fields)) fd.set(k, v);
		const r = deserialize(await (await fetch(`?/${action}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } })).text());
		if (r.type === 'failure') toast(String(r.data?.message ?? 'Failed.'), 'error');
		else if (r.type === 'success' && action !== 'reorder') toast(String(r.data?.message ?? 'Saved'));
		await invalidateAll();
	}
	function move(i: number, d: -1 | 1) {
		const j = i + d;
		if (j < 0 || j >= order.length) return;
		[order[i], order[j]] = [order[j], order[i]];
		post('reorder', { ids: order.map((q) => q.questionId).join(',') });
	}

	// Add from bank
	let q = $state('');
	let qModule = $state<string | null>(null);
	let results = $state<QuestionDTO[]>([]);
	let picks = $state<string[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const inTest = $derived(new Set(data.questions.map((x) => x.questionId)));
	$effect(() => {
		if (!adding) return;
		const u = new URLSearchParams();
		if (q.trim()) u.set('q', q.trim());
		if (qModule) u.set('moduleId', qModule);
		clearTimeout(timer);
		timer = setTimeout(async () => {
			const res = await fetch(`/admin/bank/search?${u}`);
			results = res.ok ? (await res.json()).items : [];
		}, 250);
	});
	const moduleOptions = $derived(data.modules.map((m) => ({ value: m.id, label: m.name, hint: `${m.questionCount}` })));
	const chosen = $derived(data.modules.find((m) => m.id === buildModule));
</script>

<svelte:head><title>Questions · {t.title}</title></svelte:head>

<div class="stack">
	<div class="flex flex-wrap items-center gap-2">
		<p class="small muted flex-1">
			<span class="font-mono tabular">{order.length}</span> questions ·
			<span class="font-mono tabular">{t.totalMarks}</span> marks · default +{t.marksPerQuestion} / −{t.negativeMarks}
		</p>
		<Button variant="secondary" onclick={() => (building = true)}><Library class="size-4" />From module</Button>
		<Button variant="secondary" onclick={() => ((picks = []), (adding = true))}><ListPlus class="size-4" />Add from bank</Button>
		<Button onclick={() => ((editing = null), (writing = true))}><PenLine class="size-4" />Write question</Button>
	</div>

	{#if order.length}
		<ol class="qs">
			{#each order as x, i (x.questionId)}
				<li class="card card-pad qrow">
					<div class="min-w-0 flex-1 stack-sm">
						<QuestionView prompt={x.prompt} options={x.options} correctIndex={x.correctIndex} number={i + 1} compact />
						<div class="flex flex-wrap items-center gap-2">
							<Badge>{difficultyLabel[x.difficulty]}</Badge>
							{#if x.topic}<span class="tiny muted">{x.topic}</span>{/if}
							<span class="flex-1"></span>
							<form method="POST" action="?/marks" class="marks" use:enhance={done}>
								<input type="hidden" name="questionId" value={x.questionId} />
								<label class="tiny muted" for="m-{x.questionId}">Marks</label>
								<input
									id="m-{x.questionId}"
									name="marks"
									type="number"
									min="0"
									step="0.25"
									class="input input-sm font-mono"
									placeholder={String(t.marksPerQuestion)}
									value={x.marks ?? ''}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
								<label class="tiny muted" for="n-{x.questionId}">Neg.</label>
								<input
									id="n-{x.questionId}"
									name="negativeMarks"
									type="number"
									min="0"
									step="0.25"
									class="input input-sm font-mono"
									placeholder={String(t.negativeMarks)}
									value={x.negativeMarks ?? ''}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</form>
						</div>
					</div>
					<div class="tools">
						<button class="icon-btn" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}><ArrowUp /></button>
						<button class="icon-btn" aria-label="Move down" disabled={i === order.length - 1} onclick={() => move(i, 1)}><ArrowDown /></button>
						<button class="icon-btn" aria-label="Edit question" onclick={() => ((editing = x), (writing = true))}><Pencil /></button>
						<button class="icon-btn" aria-label="Remove from test" onclick={() => post('remove', { questionId: x.questionId })}><Trash2 /></button>
					</div>
				</li>
			{/each}
		</ol>
	{:else}
		<EmptyState icon={ListPlus} title="No questions yet" body="Draw them from a module, pick from the bank, or write new ones.">
			{#snippet action()}<Button onclick={() => (building = true)}><Library class="size-4" />From module</Button>{/snippet}
		</EmptyState>
	{/if}
</div>

<QuestionEditor
	bind:open={writing}
	action="?/write"
	question={editing}
	fields={editing ? { id: editing.questionId } : {}}
	title={editing ? 'Edit question' : 'Write a question'}
	image={!editing}
	submitLabel={editing ? 'Save question' : 'Add to test'}
/>

<Sheet bind:open={building} title="Draw from a module" description="Random questions, never one already in this test.">
	<form method="POST" action="?/build" class="stack" use:enhance={() => async (r) => ((building = false), await after(r))}>
		<div class="field"><span class="label">Module</span><Picker bind:value={buildModule} name="moduleId" options={moduleOptions} label="Module" searchable /></div>
		<div class="form-row">
			<div class="field">
				<label class="label" for="b-count">How many</label>
				<input id="b-count" name="count" type="number" min="1" max="500" value="10" class="input" />
			</div>
			<div class="field">
				<label class="label" for="b-diff">Difficulty</label>
				<select id="b-diff" name="difficulty" class="select">
					<option value="">Any ({chosen?.questionCount ?? 0})</option>
					<option value="easy">Easy ({chosen?.counts.easy ?? 0})</option>
					<option value="medium">Medium ({chosen?.counts.medium ?? 0})</option>
					<option value="hard">Hard ({chosen?.counts.hard ?? 0})</option>
				</select>
			</div>
		</div>
		<div class="flex justify-end"><Button type="submit" disabled={!buildModule}>Add questions</Button></div>
	</form>
</Sheet>

<Sheet bind:open={adding} title="Add from the bank">
	<form method="POST" action="?/add" class="stack" use:enhance={() => async (r) => ((adding = false), await after(r))}>
		<input type="hidden" name="ids" value={picks.join(',')} />
		<label class="search">
			<Search class="size-4" aria-hidden="true" />
			<input class="input" bind:value={q} placeholder="Search question text" aria-label="Search question text" />
		</label>
		<Picker bind:value={qModule} options={moduleOptions} placeholder="All modules" label="Module" searchable />
		<ul class="pick-list">
			{#each results as x (x.id)}
				<li>
					<label class="pick-row" class:is-on={picks.includes(x.id)} class:is-in={inTest.has(x.id)}>
						<input type="checkbox" value={x.id} bind:group={picks} disabled={inTest.has(x.id)} />
						<span class="min-w-0 flex-1">
							<QuestionView prompt={x.prompt} options={x.options} correctIndex={x.correctIndex} compact />
							{#if inTest.has(x.id)}<span class="tiny muted">Already in this test</span>{/if}
						</span>
					</label>
				</li>
			{:else}
				<li class="small muted">No questions found.</li>
			{/each}
		</ul>
		<div class="flex justify-end"><Button type="submit" disabled={!picks.length}>Add {picks.length || ''} questions</Button></div>
	</form>
</Sheet>

<style>
	.qs {
		display: grid;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
	}
	.qrow {
		display: flex;
		gap: 0.5rem;
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.marks {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.input-sm {
		width: 4.5rem;
		min-height: 36px;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
	}
	.search {
		position: relative;
	}
	.search :global(svg) {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		translate: 0 -50%;
		color: hsl(var(--muted-foreground));
	}
	.search .input {
		padding-left: 2.25rem;
	}
	.pick-list {
		display: grid;
		gap: 0.375rem;
		list-style: none;
		padding: 0;
		max-height: 50vh;
		overflow-y: auto;
	}
	.pick-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 12px;
		cursor: pointer;
	}
	.pick-row.is-on {
		border-color: hsl(var(--primary) / 0.5);
		background: hsl(var(--accent));
	}
	.pick-row.is-in {
		opacity: 0.6;
	}
	.pick-row input {
		margin-top: 0.25rem;
		accent-color: hsl(var(--primary));
		width: 1.125rem;
		height: 1.125rem;
		flex-shrink: 0;
	}
</style>
