<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { ArrowDown, ArrowUp, BookMarked, ChevronRight, Pencil, Plus, Tags, Trash2 } from '@lucide/svelte';
	import { EmptyState, PageHeader, Sheet } from '#lib/components/ui';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	type Type = 'category' | 'exam' | 'subject';
	type Item = { id: string; name: string; description?: string; enabled?: boolean };

	let sheet = $state(false);
	let ctx = $state<{ list: Item[]; i: number; enabled?: boolean }>({ list: [], i: -1 });
	let form = $state<{ type: Type; id: string; name: string; description: string; categoryId: string }>({ type: 'category', id: '', name: '', description: '', categoryId: '' });

	let reorderForm = $state<HTMLFormElement>();
	let reorder = $state({ type: 'category' as Type, categoryId: '', ids: '' });
	let del = $state({ type: 'category' as Type, id: '', name: '' });
	let delOpen = $state(false);
	let delForm = $state<HTMLFormElement>();

	const NOUN = { category: 'category', exam: 'exam', subject: 'subject' } as const;
	const action = $derived(form.type === 'category' ? 'saveCategory' : form.type === 'exam' ? 'saveExam' : 'saveSubject');

	function edit(type: Type, item: Item | null, categoryId = '') {
		const list: Item[] = type === 'category' ? data.tree.categories : type === 'subject' ? data.tree.subjects : (data.tree.categories.find((c) => c.id === categoryId)?.exams ?? []);
		ctx = { list, i: item ? list.findIndex((x) => x.id === item.id) : -1, enabled: item?.enabled };
		form = { type, id: item?.id ?? '', name: item?.name ?? '', description: item?.description ?? '', categoryId };
		sheet = true;
	}
	async function move(type: Type, list: Item[], from: number, to: number, categoryId = '') {
		const next = list.map((x) => x.id);
		const [x] = next.splice(from, 1);
		next.splice(to, 0, x!);
		reorder = { type, categoryId, ids: next.join(',') };
		await tick();
		reorderForm?.requestSubmit();
	}
	function remove(type: Type, item: Item) {
		del = { type, id: item.id, name: item.name };
		delOpen = true;
	}
</script>

{#snippet controls(type: Type, item: Item, list: Item[], i: number, categoryId = '')}
	<span class="row-actions">
		{#if item.enabled !== undefined}
			<form method="POST" action="?/enable" use:enhance={toasting()}>
				<input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={item.id} />
				<input type="hidden" name="enabled" value={item.enabled ? 'false' : 'true'} />
				<button class="badge {item.enabled ? 'badge-success' : 'badge-closed'} toggle" aria-label="{item.enabled ? 'Hide' : 'Show'} {item.name}">{item.enabled ? 'Shown' : 'Hidden'}</button>
			</form>
		{/if}
		<button class="icon-btn icon-btn-sm" aria-label="Move {item.name} up" disabled={i === 0} onclick={() => move(type, list, i, i - 1, categoryId)}><ArrowUp /></button>
		<button class="icon-btn icon-btn-sm" aria-label="Move {item.name} down" disabled={i === list.length - 1} onclick={() => move(type, list, i, i + 1, categoryId)}><ArrowDown /></button>
		<button class="icon-btn icon-btn-sm" aria-label="Edit {item.name}" onclick={() => edit(type, item, categoryId)}><Pencil /></button>
		<button class="icon-btn icon-btn-sm" aria-label="Delete {item.name}" onclick={() => remove(type, item)}><Trash2 /></button>
	</span>
{/snippet}

<div class="page">
	<PageHeader title="Exams & subjects" subtitle="Students pick their exam from this list. Hidden items stay in old tests.">
		{#snippet actions()}
			<button class="btn btn-primary" onclick={() => edit('category', null)}><Plus /> New category</button>
		{/snippet}
	</PageHeader>

	<div class="cols">
		<section class="stack">
			{#each data.tree.categories as c, ci (c.id)}
				<article class="card rise" style="--i: {Math.min(ci, 8)}">
					<div class="card-head cat">
						<button class="row-main" onclick={() => edit('category', c)} aria-label="Edit {c.name}">
							<span class="grow min-w-0"><h2 class="truncate">{c.name}{#if !c.enabled} <span class="badge badge-closed phone-only">Hidden</span>{/if}</h2>{#if c.description}<p class="tiny muted truncate">{c.description}</p>{/if}</span>
							<ChevronRight class="chev phone-only" />
						</button>
						{@render controls('category', c, data.tree.categories, ci)}
					</div>
					<ol>
						{#each c.exams as e, ei (e.id)}
							<li class="list-row">
								<button class="row-main" onclick={() => edit('exam', e, c.id)} aria-label="Edit {e.name}">
									<span class="grow"><span class="title block">{e.name}</span><span class="meta block">{#if !e.enabled}<span class="badge badge-closed phone-only">Hidden</span> {/if}<span class="font-mono">{e.slug}</span></span></span>
									<ChevronRight class="chev phone-only" />
								</button>
								{@render controls('exam', e, c.exams, ei, c.id)}
							</li>
						{/each}
						<li class="list-row"><button class="btn btn-ghost btn-sm" onclick={() => edit('exam', null, c.id)}><Plus /> Add exam to {c.name}</button></li>
					</ol>
				</article>
			{:else}
				<div class="card"><EmptyState icon={Tags} title="No exam categories" body="Start with a category like SSC or MP Police, then add its exams.">
					{#snippet action()}<button class="btn btn-primary" onclick={() => edit('category', null)}><Plus /> New category</button>{/snippet}
				</EmptyState></div>
			{/each}
		</section>

		<section class="rise" style="--i: 2">
			<div class="section-head"><h2 class="section-title">Subjects</h2><button class="btn btn-secondary btn-sm" onclick={() => edit('subject', null)}><Plus /> Add</button></div>
			{#if data.tree.subjects.length}
				<ol class="list">
					{#each data.tree.subjects as s, i (s.id)}
						<li class="list-row"><button class="row-main" onclick={() => edit('subject', s)} aria-label="Edit {s.name}"><span class="grow title">{s.name}</span><ChevronRight class="chev phone-only" /></button>{@render controls('subject', s, data.tree.subjects, i)}</li>
					{/each}
				</ol>
			{:else}
				<div class="card"><EmptyState compact icon={BookMarked} title="No subjects yet" body="Reasoning, Maths, GK… used to tag questions and tests." /></div>
			{/if}
		</section>
	</div>
</div>

<Sheet bind:open={sheet} title="{form.id ? 'Edit' : 'New'} {NOUN[form.type]}">
	{#key form.type + form.id + form.categoryId}
		<form method="POST" action="?/{action}" class="stack" use:enhance={toasting(() => (sheet = false))}>
			<input type="hidden" name="id" value={form.id} />
			<input type="hidden" name="categoryId" value={form.categoryId} />
			<div class="field"><label class="label" for="t-name">Name</label><input id="t-name" class="input" name="name" value={form.name} required maxlength="120" /></div>
			{#if form.type !== 'subject'}
				<div class="field"><label class="label" for="t-desc">Description (optional)</label><textarea id="t-desc" class="textarea" name="description" rows="2" maxlength="500">{form.description}</textarea></div>
			{/if}
			<button class="btn btn-primary btn-block">{form.id ? 'Save' : 'Add'} {NOUN[form.type]}</button>
		</form>
		{#if form.id}
			<div class="flex flex-wrap gap-2 mt-4 phone-only-flex">
				<button type="button" class="btn btn-secondary btn-sm" disabled={ctx.i <= 0} onclick={() => ((sheet = false), move(form.type, ctx.list, ctx.i, ctx.i - 1, form.categoryId))}><ArrowUp /> Up</button>
				<button type="button" class="btn btn-secondary btn-sm" disabled={ctx.i === ctx.list.length - 1} onclick={() => ((sheet = false), move(form.type, ctx.list, ctx.i, ctx.i + 1, form.categoryId))}><ArrowDown /> Down</button>
				{#if ctx.enabled !== undefined}
					<form method="POST" action="?/enable" use:enhance={toasting(() => (sheet = false))}>
						<input type="hidden" name="type" value={form.type} /><input type="hidden" name="id" value={form.id} />
						<input type="hidden" name="enabled" value={ctx.enabled ? 'false' : 'true'} />
						<button class="btn btn-secondary btn-sm">{ctx.enabled ? 'Hide' : 'Show'}</button>
					</form>
				{/if}
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => ((sheet = false), remove(form.type, { id: form.id, name: form.name }))}><Trash2 /> Delete</button>
			</div>
		{/if}
	{/key}
</Sheet>

<form bind:this={reorderForm} method="POST" action="?/reorder" hidden use:enhance={toasting()}>
	<input type="hidden" name="type" value={reorder.type} /><input type="hidden" name="categoryId" value={reorder.categoryId} /><input type="hidden" name="ids" value={reorder.ids} />
</form>
<form bind:this={delForm} method="POST" action="?/delete" hidden use:enhance={toasting()}>
	<input type="hidden" name="type" value={del.type} /><input type="hidden" name="id" value={del.id} />
</form>
<ConfirmSheet
	bind:open={delOpen}
	title="Delete {del.name}?"
	body={del.type === 'category' ? 'Its exams are deleted too. Hiding keeps them for old tests and students.' : 'Hiding is safer: it keeps old tests and students linked.'}
	confirmLabel="Delete"
	danger
	onconfirm={() => delForm?.requestSubmit()}
/>

<style>
	.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .cols { grid-template-columns: 2fr 1fr; align-items: start; } }
	ol > * + * { border-top: 1px solid hsl(var(--border)); }
	.row-main { display: flex; align-items: center; gap: .875rem; flex: 1; min-width: 0; text-align: left; min-height: 44px; }
	.row-actions { display: none; align-items: center; gap: .125rem; margin-left: auto; }
	@media (min-width: 768px) { .row-actions { display: flex; } :global(.phone-only), .phone-only-flex { display: none !important; } }
	.toggle { min-height: 32px; margin-right: .25rem; cursor: pointer; }
</style>
