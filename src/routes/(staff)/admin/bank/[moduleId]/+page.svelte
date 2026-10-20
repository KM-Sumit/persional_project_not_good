<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page as pageState } from '$app/state';
	import { ClipboardList, FileUp, FolderInput, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2 } from '@lucide/svelte';
	import { Badge, Button, EmptyState, PageHeader, Sheet, toast } from '#lib/components/ui';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import QuestionEditor from '#lib/features/bank/components/QuestionEditor.svelte';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import { difficultyLabel } from '#lib/features/bank/components/format';
	import type { QuestionDTO } from '#lib/features/bank/schema';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();

	let selected = $state<string[]>([]);
	let editing = $state<QuestionDTO | null>(null);
	let editorOpen = $state(false);
	let moving = $state(false);
	let making = $state(false);
	let renaming = $state(false);
	let confirmDelete = $state(false);
	let confirmDeleteModule = $state(false);
	let moreOpen = $state(false);

	const items = $derived(data.page.items);
	const m = $derived(data.module);
	const filtered = $derived(!!(data.filter.q || data.filter.topic || data.filter.difficulty));
	const allOnPage = $derived(items.length > 0 && items.every((q) => selected.includes(q.id)));
	const diffTone = { easy: 'success', medium: 'warning', hard: 'danger' } as const;

	function edit(q: QuestionDTO | null) {
		editing = q;
		editorOpen = true;
	}
	function toggleAll() {
		selected = allOnPage ? selected.filter((id) => !items.some((q) => q.id === id)) : [...new Set([...selected, ...items.map((q) => q.id)])];
	}

	const done =
		(msg: (d: Record<string, unknown>) => string, after?: () => void): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Something failed.'), 'error');
			else if (result.type === 'success') {
				toast(msg(result.data ?? {}));
				after?.();
			}
			await update({ reset: false });
		};

	async function postIds(action: string, extra: Record<string, string> = {}) {
		const fd = new FormData();
		fd.set('ids', selected.join(','));
		for (const [k, v] of Object.entries(extra)) fd.set(k, v);
		const res = await fetch(action, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		const r = deserialize(await res.text());
		if (r.type === 'failure') toast(String(r.data?.message ?? 'Could not delete.'), 'error');
		else toast(`${selected.length} deleted`);
		selected = [];
		await invalidateAll();
	}
	const moreHref = $derived.by(() => {
		if (!data.page.nextCursor) return null;
		const u = new URL(pageState.url.href);
		u.searchParams.set('cursor', data.page.nextCursor);
		return u.pathname + u.search;
	});
</script>

<svelte:head><title>{m.name} · Question bank</title></svelte:head>

<div class="page">
	<PageHeader
		title={m.name}
		subtitle="{m.questionCount} questions · {m.counts.easy} easy · {m.counts.medium} medium · {m.counts.hard} hard"
		crumbs={[{ href: '/admin/bank', label: 'Question bank' }]}
	>
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
			<Button variant="ghost" onclick={() => (moreOpen = true)} aria-label="Module options"><MoreHorizontal class="size-4" /></Button>
			<Button variant="secondary" href="/admin/bank/import?module={m.id}"><FileUp class="size-4" />Import</Button>
			<Button onclick={() => edit(null)}><Plus class="size-4" />Add question</Button>
			</div>
		{/snippet}
	</PageHeader>

	<form method="GET" class="toolbar" role="search">
		<label class="search">
			<Search class="size-4" aria-hidden="true" />
			<input class="input" name="q" value={data.filter.q ?? ''} placeholder="Search question text" aria-label="Search question text" />
		</label>
		<input class="input topic" name="topic" value={data.filter.topic ?? ''} placeholder="Topic" aria-label="Topic" />
		<select class="select diff" name="difficulty" aria-label="Difficulty" value={data.filter.difficulty ?? ''}>
			<option value="">Any difficulty</option>
			<option value="easy">Easy</option>
			<option value="medium">Medium</option>
			<option value="hard">Hard</option>
		</select>
		<Button variant="secondary" type="submit">Filter</Button>
		{#if filtered}<Button variant="ghost" href="/admin/bank/{m.id}">Clear</Button>{/if}
	</form>

	{#if items.length}
		<div class="list-head">
			<label class="check">
				<input type="checkbox" checked={allOnPage} onchange={toggleAll} />
				<span class="small">{selected.length ? `${selected.length} selected` : 'Select all on this page'}</span>
			</label>
		</div>
		<ul class="qlist">
			{#each items as q, i (q.id)}
				<li class="card qrow rise" class:is-selected={selected.includes(q.id)} style="--i: {Math.min(i, 8)}">
					<label class="check self-start" aria-label="Select question">
						<input type="checkbox" value={q.id} bind:group={selected} />
					</label>
					<div class="min-w-0 flex-1">
						<QuestionView prompt={q.prompt} options={q.options} correctIndex={q.correctIndex} compact />
						<div class="meta">
							<Badge tone={diffTone[q.difficulty]}>{difficultyLabel[q.difficulty]}</Badge>
							{#if q.topic}<span class="tiny muted">{q.topic}</span>{/if}
							{#if q.source !== 'manual'}<span class="tiny muted">{q.source === 'import' ? 'Imported' : 'AI'}</span>{/if}
						</div>
					</div>
					<button class="icon-btn" aria-label="Edit question" onclick={() => edit(q)}><Pencil /></button>
				</li>
			{/each}
		</ul>
		{#if moreHref}<div class="mt-4 flex justify-center"><Button variant="secondary" href={moreHref}>Load more</Button></div>{/if}
	{:else}
		<EmptyState
			icon={ClipboardList}
			title={filtered ? 'No question matches' : 'No questions yet'}
			body={filtered ? 'Change the filters or clear them.' : 'Add one by hand, import a sheet, or generate with AI.'}
		>
			{#snippet action()}
				{#if !filtered}
					<div class="flex flex-wrap justify-center gap-2">
						<Button onclick={() => edit(null)}><Plus class="size-4" />Add question</Button>
						<Button variant="secondary" href="/admin/bank/import?module={m.id}"><FileUp class="size-4" />Import</Button>
						<Button variant="secondary" href="/admin/bank/generate"><Sparkles class="size-4" />Generate</Button>
					</div>
				{/if}
			{/snippet}
		</EmptyState>
	{/if}
</div>

{#if selected.length}
	<div class="actionbar">
		<div class="actionbar-inner">
			<span class="small font-mono tabular">{selected.length} selected</span>
			<Button variant="ghost" size="sm" onclick={() => (selected = [])}>Clear</Button>
			<span class="flex-1"></span>
			<Button variant="secondary" size="sm" onclick={() => (moving = true)}><FolderInput class="size-4" />Move</Button>
			<Button variant="danger" size="sm" onclick={() => (confirmDelete = true)}><Trash2 class="size-4" />Delete</Button>
			<Button size="sm" onclick={() => (making = true)}><ClipboardList class="size-4" />Create test</Button>
		</div>
	</div>
{/if}

<QuestionEditor bind:open={editorOpen} question={editing} action="?/save" fields={editing ? { id: editing.id } : {}} />

<Sheet bind:open={moving} title="Move {selected.length} questions" description="They leave this module and join the one you pick.">
	<form method="POST" action="?/move" class="stack" use:enhance={done((d) => `${d.moved} moved`, () => ((moving = false), (selected = [])))}>
		<input type="hidden" name="ids" value={selected.join(',')} />
		<div class="field">
			<label class="label" for="move-to">Module</label>
			<select id="move-to" name="moduleId" class="select">
				{#each data.modules as mod (mod.id)}<option value={mod.id}>{mod.name} ({mod.questionCount})</option>{/each}
				<option value="">Unfiled (no module)</option>
			</select>
		</div>
		<div class="flex justify-end gap-2"><Button type="submit">Move questions</Button></div>
	</form>
</Sheet>

<Sheet bind:open={making} title="Create a test from {selected.length} questions" description="Makes a draft practice test you can finish in the test editor.">
	<form method="POST" action="?/createTest" class="stack" use:enhance>
		<input type="hidden" name="ids" value={selected.join(',')} />
		<div class="field">
			<label class="label" for="test-title">Test title</label>
			<input id="test-title" name="title" class="input" value={m.name} required maxlength="200" />
		</div>
		<div class="flex justify-end gap-2"><Button type="submit">Create draft test</Button></div>
	</form>
</Sheet>

<Sheet bind:open={moreOpen} title="Module options">
	<div class="stack-sm">
		<Button variant="secondary" block onclick={() => ((moreOpen = false), (renaming = true))}><Pencil class="size-4" />Rename module</Button>
		<Button variant="danger" block onclick={() => ((moreOpen = false), (confirmDeleteModule = true))}><Trash2 class="size-4" />Delete module</Button>
	</div>
</Sheet>

<Sheet bind:open={renaming} title="Rename module">
	<form method="POST" action="?/rename" class="stack" use:enhance={done(() => 'Module renamed', () => (renaming = false))}>
		<div class="field">
			<label class="label" for="mod-rename">Name</label>
			<input id="mod-rename" name="name" class="input" value={m.name} required maxlength="200" />
		</div>
		<div class="flex justify-end"><Button type="submit">Save</Button></div>
	</form>
</Sheet>

<ConfirmSheet
	bind:open={confirmDelete}
	title="Delete {selected.length} questions?"
	body="Questions used in a test stay; remove them from the test first."
	confirmLabel="Delete"
	danger
	onconfirm={() => postIds('?/delete')}
/>
<ConfirmSheet
	bind:open={confirmDeleteModule}
	title="Delete this module?"
	body="Its {m.questionCount} questions stay in the bank as unfiled, so tests built from them keep working."
	confirmLabel="Delete module"
	danger
	onconfirm={async () => {
		const res = await fetch('?/deleteModule', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		const r = deserialize(await res.text());
		if (r.type === 'redirect') location.assign(r.location);
		else toast('Could not delete the module.', 'error');
	}}
/>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.search {
		position: relative;
		flex: 1 1 14rem;
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
	.topic {
		flex: 1 1 8rem;
		max-width: 12rem;
	}
	.diff {
		flex: 0 1 10rem;
	}
	.list-head {
		padding: 0 0.25rem 0.5rem;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		min-width: 44px;
		cursor: pointer;
	}
	.check input {
		width: 1.125rem;
		height: 1.125rem;
		accent-color: hsl(var(--primary));
	}
	.qlist {
		display: grid;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
	}
	.qrow {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem 0.75rem 0.75rem 0.5rem;
	}
	.qrow.is-selected {
		background: hsl(var(--accent));
		border-color: hsl(var(--primary) / 0.4);
	}
	.check.self-start {
		justify-content: center;
		margin-top: -0.5rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
</style>
