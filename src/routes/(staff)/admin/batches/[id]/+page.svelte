<script lang="ts">
	import { enhance } from '$app/forms';
	import { Archive, ArchiveRestore, Copy, Megaphone, RefreshCw, Search, Settings2, UserPlus, UsersRound, X } from '@lucide/svelte';
	import { EmptyState, PageHeader, Sheet, toast } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import { toasting } from '../../students/_enhance';

	let { data } = $props();
	let picked = $state<string[]>([]);
	let moveTo = $state<string | null>(null);
	let manage = $state(false);
	let examId = $state<string | null>(null);

	const date = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
	const toggle = (id: string) => (picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(data.batch.joinCode);
			toast(`Copied ${data.batch.joinCode}`);
		} catch {
			toast('Could not copy. Select the code instead.', 'warning');
		}
	}
</script>

<div class="page">
	<PageHeader title={data.batch.name} subtitle="{data.batch.sessionName} · {data.batch.memberCount} students" crumbs={[{ href: '/admin/batches', label: 'Batches' }]}>
		{#snippet actions()}
			<button class="btn btn-secondary font-mono" onclick={copy}>{data.batch.joinCode} <Copy /></button>
			<button class="btn btn-secondary" onclick={() => ((examId = data.batch.examId), (manage = true))} aria-label="Manage batch"><Settings2 /></button>
		{/snippet}
	</PageHeader>
	{#if data.batch.archived}<div class="alert alert-warning mb-4">This batch is archived. New students cannot join with its code.</div>{/if}

	<div class="cols">
		<div class="stack">
			<section class="rise">
				<div class="section-head"><h2 class="section-title">Add students</h2></div>
				<form class="search card" method="GET" data-sveltekit-keepfocus data-sveltekit-replacestate>
					<Search />
					<input class="grow" name="q" value={data.q} placeholder="Search name, email or phone" aria-label="Search students" />
					<button class="btn btn-secondary btn-sm">Search</button>
				</form>
				{#if data.found}
					<div class="list mt-2">
						{#each data.found as p (p.id)}
							<form class="list-row" method="POST" action="?/add" use:enhance={toasting()}>
								<input type="hidden" name="ids" value={p.id} />
								<span class="grow"><span class="title block">{p.name}</span><span class="meta block">{p.phone ?? p.email}</span></span>
								<button class="btn btn-secondary btn-sm"><UserPlus /> Add</button>
							</form>
						{:else}
							<div class="list-row muted small">No students found outside this batch.</div>
						{/each}
					</div>
				{/if}
			</section>

			<section class="rise" style="--i: 1">
				<div class="section-head"><h2 class="section-title">Members</h2><span class="small muted font-mono tabular">{data.members.length}</span></div>
				{#if data.members.length}
					<div class="list">
						{#each data.members as m (m.id)}
							<div class="list-row">
								<input type="checkbox" class="check" checked={picked.includes(m.id)} onchange={() => toggle(m.id)} aria-label="Select {m.name}" />
								<a class="grow" href="/admin/students/{m.id}"><span class="title block">{m.name}</span><span class="meta block">{m.phone ?? m.email} · joined {date(m.joinedAt)}</span></a>
								<form method="POST" action="?/remove" use:enhance={toasting()}>
									<input type="hidden" name="ids" value={m.id} />
									<button class="icon-btn" aria-label="Remove {m.name}"><X /></button>
								</form>
							</div>
						{/each}
					</div>
				{:else}
					<div class="card"><EmptyState compact icon={UsersRound} title="No students yet" body="Share the join code {data.batch.joinCode}, or add students above." /></div>
				{/if}
			</section>
		</div>

		<section class="rise" style="--i: 2">
			<div class="section-head"><h2 class="section-title">Batch announcement</h2></div>
			<form class="card card-pad stack" method="POST" action="?/announce" use:enhance={toasting()}>
				<div class="field"><label class="label" for="a-title">Title</label><input id="a-title" class="input" name="title" required maxlength="120" placeholder="Class moved to 10 AM" /></div>
				<div class="field"><label class="label" for="a-body">Message</label><textarea id="a-body" class="textarea" name="body" maxlength="2000" rows="3"></textarea></div>
				<div class="field"><label class="label" for="a-href">Link (optional)</label><input id="a-href" class="input" name="href" placeholder="/app/tests" maxlength="500" /></div>
				<button class="btn btn-primary"><Megaphone /> Send to {data.batch.memberCount} students</button>
			</form>
			{#if data.announcements.length}
				<div class="list mt-3">
					{#each data.announcements as n (n.id)}
						<div class="list-row"><span class="grow"><span class="title block">{n.title}</span><span class="meta block">{date(n.createdAt)} · read by {n.reads}</span></span></div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<Sheet bind:open={manage} title="Manage batch">
	<form method="POST" action="?/update" class="stack" use:enhance={toasting(() => (manage = false))}>
		<div class="field"><label class="label" for="m-name">Name</label><input id="m-name" class="input" name="name" value={data.batch.name} required maxlength="120" /></div>
		<div class="field"><span class="label">Exam (optional)</span><Picker bind:value={examId} name="examId" options={data.exams} placeholder="Any exam" label="Exam" searchable /></div>
		<button class="btn btn-primary btn-block">Save batch</button>
	</form>
	<div class="divider my-4"></div>
	<div class="flex flex-wrap gap-2">
		<form method="POST" action="?/newCode" use:enhance={toasting()}><button class="btn btn-secondary btn-sm"><RefreshCw /> New join code</button></form>
		<form method="POST" action="?/archive" use:enhance={toasting(() => (manage = false))}>
			<input type="hidden" name="archived" value={data.batch.archived ? 'false' : 'true'} />
			<button class="btn btn-secondary btn-sm">{#if data.batch.archived}<ArchiveRestore /> Restore batch{:else}<Archive /> Archive batch{/if}</button>
		</form>
	</div>
</Sheet>

{#if picked.length}
	<div class="actionbar">
		<form class="actionbar-inner movebar" method="POST" action="?/move" use:enhance={toasting(() => ((picked = []), (moveTo = null)))}>
			<input type="hidden" name="ids" value={picked.join(',')} />
			<span class="small font-semibold">{picked.length} selected</span>
			<div class="grow"><Picker bind:value={moveTo} name="to" options={data.targets} placeholder="Move to batch" label="Move to batch" /></div>
			<button class="btn btn-primary btn-sm" disabled={!moveTo}>Move</button>
			<button type="submit" formaction="?/remove" class="btn btn-ghost btn-sm">Remove</button>
		</form>
	</div>
{/if}

<style>
	.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .cols { grid-template-columns: 3fr 2fr; align-items: start; } }
	.search { display: flex; align-items: center; gap: .5rem; padding: .375rem .375rem .375rem .875rem; }
	.search :global(> svg) { width: 18px; height: 18px; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
	.search input { min-width: 0; min-height: 40px; background: transparent; outline: none; }
	.check { width: 20px; height: 20px; accent-color: hsl(var(--primary)); flex-shrink: 0; }
	.movebar { display: flex; align-items: center; gap: .5rem; }
	.movebar .grow { flex: 1; min-width: 0; }
</style>
