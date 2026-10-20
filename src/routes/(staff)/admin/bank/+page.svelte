<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronRight, FileUp, Library, Plus, Search, Sparkles } from '@lucide/svelte';
	import { Button, EmptyState, PageHeader, Sheet, toast } from '#lib/components/ui';

	let { data } = $props();
	let creating = $state(false);
	let busy = $state(false);

	const examName = $derived(new Map(data.taxonomy.categories.flatMap((c) => c.exams.map((e) => [e.id, e.name]))));
	const subjectName = $derived(new Map(data.taxonomy.subjects.map((s) => [s.id, s.name])));
	const total = $derived(data.modules.reduce((s, m) => s + m.questionCount, 0));
	const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
</script>

<svelte:head><title>Question bank · UCI staff</title></svelte:head>

<div class="page">
	<PageHeader title="Question bank" subtitle="{data.modules.length} modules · {total} questions">
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
			<Button variant="secondary" href="/admin/bank/import"><FileUp class="size-4" />Import</Button>
			<Button variant="secondary" href="/admin/bank/generate"><Sparkles class="size-4" />Generate</Button>
			<Button onclick={() => (creating = true)}><Plus class="size-4" />New module</Button>
			</div>
		{/snippet}
	</PageHeader>

	<form method="GET" class="toolbar" role="search">
		<label class="search">
			<Search class="size-4" aria-hidden="true" />
			<input class="input" name="q" value={data.q} placeholder="Search modules" aria-label="Search modules" />
		</label>
		<Button variant="secondary" type="submit">Search</Button>
	</form>

	{#if data.modules.length}
		<ul class="grid-mods">
			{#each data.modules as m, i (m.id)}
				<li class="rise" style="--i: {Math.min(i, 8)}">
					<a class="card mod" href="/admin/bank/{m.id}">
						<span class="mod-main">
							<span class="mod-name">{m.name}</span>
							<span class="mod-meta small muted">
								<span class="tabular">{m.questionCount} questions</span>
								{#if m.examId || m.subjectId}· {[m.examId && examName.get(m.examId), m.subjectId && subjectName.get(m.subjectId)].filter(Boolean).join(' · ')}{/if}
							</span>
							{#if m.questionCount}
								<span class="split" aria-hidden="true">
									<span class="e" style="width: {pct(m.counts.easy, m.questionCount)}%"></span>
									<span class="m" style="width: {pct(m.counts.medium, m.questionCount)}%"></span>
									<span class="h" style="width: {pct(m.counts.hard, m.questionCount)}%"></span>
								</span>
								<span class="legend tiny tabular">
									<span><i class="dot e"></i>Easy {m.counts.easy}</span>
									<span><i class="dot m"></i>Medium {m.counts.medium}</span>
									<span><i class="dot h"></i>Hard {m.counts.hard}</span>
								</span>
							{/if}
						</span>
						<ChevronRight class="chev size-4" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState
			icon={Library}
			title={data.q ? 'No module matches' : 'No modules yet'}
			body={data.q ? 'Try another name.' : 'A module is a pool of questions on one topic. Tests are built by picking from modules.'}
		>
			{#snippet action()}<Button onclick={() => (creating = true)}><Plus class="size-4" />New module</Button>{/snippet}
		</EmptyState>
	{/if}
</div>

<Sheet bind:open={creating} title="New module" description="Name it after the topic, for example “Indian Polity: Parliament”.">
	<form
		method="POST"
		action="?/create"
		class="stack"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not create.'), 'error');
				else toast('Module created');
				await update();
			};
		}}
	>
		<div class="field">
			<label class="label" for="mod-name">Name</label>
			<input id="mod-name" name="name" class="input" required maxlength="200" />
		</div>
		<div class="form-row">
			<div class="field">
				<label class="label" for="mod-exam">Exam <span class="opt">(optional)</span></label>
				<select id="mod-exam" name="examId" class="select">
					<option value="">None</option>
					{#each data.taxonomy.categories as c (c.id)}
						<optgroup label={c.name}>
							{#each c.exams as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<div class="field">
				<label class="label" for="mod-subject">Subject <span class="opt">(optional)</span></label>
				<select id="mod-subject" name="subjectId" class="select">
					<option value="">None</option>
					{#each data.taxonomy.subjects as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
				</select>
			</div>
		</div>
		<div class="flex justify-end gap-2">
			<Button variant="ghost" type="button" onclick={() => (creating = false)}>Cancel</Button>
			<Button type="submit" loading={busy}>Create module</Button>
		</div>
	</form>
</Sheet>

<style>
	.toolbar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.search {
		position: relative;
		flex: 1;
		max-width: 28rem;
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
	.grid-mods {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
		list-style: none;
		padding: 0;
	}
	.mod {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 100%;
		padding: 0.875rem 1rem;
		min-height: 56px;
		text-decoration: none;
		color: inherit;
	}
	.mod:hover {
		border-color: hsl(var(--foreground) / 0.3);
	}
	.mod-main {
		display: grid;
		gap: 0.375rem;
		flex: 1;
		min-width: 0;
	}
	.mod-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.mod :global(.chev) {
		color: hsl(var(--muted-foreground));
		flex-shrink: 0;
	}
	/* Phones: compact full-row list; the difficulty split lives on wider screens. */
	@media (max-width: 639px) {
		.grid-mods {
			gap: 0.5rem;
		}
		.mod .split,
		.mod .legend {
			display: none;
		}
	}
	.split {
		display: flex;
		height: 6px;
		border-radius: 999px;
		overflow: hidden;
		background: hsl(var(--muted));
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		margin-right: 0.25rem;
	}
	.e {
		background: hsl(var(--success));
	}
	.m {
		background: hsl(var(--warning));
	}
	.h {
		background: hsl(var(--danger));
	}
</style>
