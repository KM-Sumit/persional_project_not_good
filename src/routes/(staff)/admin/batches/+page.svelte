<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronRight, Copy, CopyPlus, Layers, Plus } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Sheet, toast } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	type Batch = (typeof data.batches)[number];

	let newSession = $state(false);
	let newBatch = $state(false);
	let rollSheet = $state(false);
	let examId = $state<string | null>(null);
	let rollTo = $state<string | null>(null);
	let showArchived = $state(false);

	const open = $derived(data.batches.filter((b) => !b.archived));
	const archived = $derived(data.batches.filter((b) => b.archived));
	const examName = (id: string | null) => data.exams.find((e) => e.value === id)?.label;
	const others = $derived(data.sessions.filter((s) => s.id !== data.session?.id).map((s) => ({ value: s.id, label: s.name })));

	async function copy(code: string) {
		try {
			await navigator.clipboard.writeText(code);
			toast(`Copied ${code}`);
		} catch {
			toast('Could not copy. Select the code instead.', 'warning');
		}
	}
</script>

<div class="page">
	<PageHeader title="Sessions & batches" subtitle="Students join a batch with its 6-letter code">
		{#snippet actions()}
			{#if data.session}<button class="btn btn-primary" onclick={() => (newBatch = true)}><Plus /> New batch</button>{/if}
		{/snippet}
	</PageHeader>

	<div class="sessions rise">
		<nav class="chips" aria-label="Sessions">
			{#each data.sessions as s (s.id)}
				<a class="chip" aria-current={s.id === data.session?.id ? 'true' : undefined} href="?session={s.id}">
					{s.name}{#if s.isCurrent}<span class="count">· current</span>{/if}
				</a>
			{/each}
			<button class="chip" onclick={() => (newSession = true)}><Plus class="size-4" /> Session</button>
		</nav>
		{#if data.session && (!data.session.isCurrent || others.length)}
			<div class="session-actions">
				{#if !data.session.isCurrent}
					<form method="POST" action="?/setCurrent" use:enhance={toasting()}>
						<input type="hidden" name="id" value={data.session.id} />
						<button class="btn btn-secondary btn-sm">Make current</button>
					</form>
				{/if}
				{#if others.length}<button class="btn btn-secondary btn-sm" onclick={() => (rollSheet = true)}><CopyPlus /> Copy batches to…</button>{/if}
			</div>
		{/if}
	</div>

	{#if !data.session}
		<div class="card"><EmptyState icon={Layers} title="No sessions yet" body="Create the academic session first, like 2026-27.">
			{#snippet action()}<button class="btn btn-primary" onclick={() => (newSession = true)}><Plus /> New session</button>{/snippet}
		</EmptyState></div>
	{:else if !open.length}
		<div class="card"><EmptyState icon={Layers} title="No batches in this session" body="Create one, or copy another session's batches.">
			{#snippet action()}<button class="btn btn-primary" onclick={() => (newBatch = true)}><Plus /> New batch</button>{/snippet}
		</EmptyState></div>
	{:else}
		<div class="list rise">{#each open as b (b.id)}{@render row(b)}{/each}</div>
	{/if}

	{#if archived.length}
		<button class="btn btn-ghost btn-sm mt-6" onclick={() => (showArchived = !showArchived)}>{showArchived ? 'Hide' : 'Show'} {archived.length} archived</button>
		{#if showArchived}<div class="list mt-3">{#each archived as b (b.id)}{@render row(b)}{/each}</div>{/if}
	{/if}
</div>

{#snippet row(b: Batch)}
	<div class="list-row batch">
		<a class="grow" href="/admin/batches/{b.id}">
			<span class="title block">{b.name}</span>
			<span class="meta block">{examName(b.examId) ?? 'Any exam'} · <span class="font-mono tabular">{b.memberCount}</span> {b.memberCount === 1 ? 'student' : 'students'}</span>
		</a>
		{#if b.archived}<Badge tone="closed">Archived</Badge>{/if}
		<button class="code font-mono" onclick={() => copy(b.joinCode)} aria-label="Copy join code {b.joinCode}">{b.joinCode}<Copy /></button>
		<a class="chev-link" href="/admin/batches/{b.id}" aria-label="Open {b.name}"><ChevronRight class="chev" /></a>
	</div>
{/snippet}

<Sheet bind:open={newSession} title="New session" description="Sessions group a year's batches, like 2026-27.">
	<form method="POST" action="?/createSession" class="stack" use:enhance={toasting(() => (newSession = false))}>
		<div class="field"><label class="label" for="s-name">Name</label><input id="s-name" class="input" name="name" placeholder="2026-27" required maxlength="40" /></div>
		<div class="form-row">
			<div class="field"><label class="label" for="s-start">Starts</label><input id="s-start" class="input" type="date" name="startsOn" required /></div>
			<div class="field"><label class="label" for="s-end">Ends</label><input id="s-end" class="input" type="date" name="endsOn" required /></div>
		</div>
		<button class="btn btn-primary btn-block">Create session</button>
	</form>
</Sheet>

<Sheet bind:open={newBatch} title="New batch" description={data.session ? `In session ${data.session.name}` : undefined}>
	<form method="POST" action="?/createBatch" class="stack" use:enhance={toasting(() => ((newBatch = false), (examId = null)))}>
		<input type="hidden" name="sessionId" value={data.session?.id} />
		<div class="field"><label class="label" for="b-name">Name</label><input id="b-name" class="input" name="name" placeholder="SSC GD Morning" required maxlength="120" /></div>
		<div class="field"><span class="label">Exam (optional)</span><Picker bind:value={examId} name="examId" options={data.exams} placeholder="Any exam" label="Exam" searchable /></div>
		<button class="btn btn-primary btn-block">Create batch</button>
	</form>
</Sheet>

<Sheet bind:open={rollSheet} title="Copy batches to another session" description="Open batches are copied with new join codes and no students. Batches that already exist there are skipped.">
	<form method="POST" action="?/rollover" class="stack" use:enhance={toasting(() => (rollSheet = false))}>
		<input type="hidden" name="from" value={data.session?.id} />
		<div class="field"><span class="label">Copy into</span><Picker bind:value={rollTo} name="to" options={others} placeholder="Choose session" label="Target session" /></div>
		<button class="btn btn-primary btn-block" disabled={!rollTo}>Copy {open.length} batches</button>
	</form>
</Sheet>

<style>
	.sessions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1.25rem; }
	.sessions .chips { margin: 0; padding: 0; flex: 1 1 18rem; }
	.session-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
	.batch { gap: .5rem; }
	.code { display: inline-flex; align-items: center; gap: .375rem; min-height: 44px; padding: 0 .5rem; border-radius: 8px; letter-spacing: .1em; font-weight: 600; font-size: .8125rem; }
	.code:hover { background: hsl(var(--muted)); }
	.code :global(svg) { width: 14px; height: 14px; color: hsl(var(--muted-foreground)); }
	.chev-link { display: grid; place-items: center; min-height: 44px; }
</style>
