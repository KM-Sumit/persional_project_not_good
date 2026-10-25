<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Pencil, Plus, Trash2, UserRound, X } from '@lucide/svelte';
	import { EmptyState, PageHeader, Sheet, Switch } from '#lib/components/ui';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import type { FileDto } from '#lib/features/files/schema';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	const s = $derived(data.settings);

	type Kind = 'topper' | 'faculty';
	type Person = { id: string; name: string; photo: string | null; photoFileId: string | null; published: boolean; exam?: string; result?: string; quote?: string; subject?: string; bio?: string };

	// Unsaved marker per settings card: set on input, cleared when that card saves.
	let dirty = $state<Record<string, boolean>>({});
	let stats = $state<{ label: string; value: string }[]>([]);
	$effect.pre(() => {
		stats = (data.settings.stats ?? []).map((x) => ({ ...x }));
	});

	let sheet = $state(false);
	let kind = $state<Kind>('topper');
	let editing = $state<Person | null>(null);
	let photo = $state<FileDto | null>(null);
	let published = $state(true);

	let reorderForm = $state<HTMLFormElement>();
	let reorder = $state({ kind: 'topper' as Kind, ids: '' });
	let del = $state({ kind: 'topper' as Kind, id: '', name: '' });
	let delOpen = $state(false);
	let delForm = $state<HTMLFormElement>();

	function edit(k: Kind, p: Person | null) {
		kind = k;
		editing = p;
		photo = p?.photoFileId && p.photo ? { id: p.photoFileId, name: 'Current photo', url: p.photo } : null;
		published = p?.published ?? true;
		sheet = true;
	}
	async function move(k: Kind, rows: Person[], from: number, to: number) {
		const next = rows.map((r) => r.id);
		const [x] = next.splice(from, 1);
		next.splice(to, 0, x!);
		reorder = { kind: k, ids: next.join(',') };
		await tick();
		reorderForm?.requestSubmit();
	}
</script>

{#snippet dot(key: string)}
	{#if dirty[key]}<span class="unsaved" title="Unsaved changes"><span class="sr-only">Unsaved changes</span></span>{/if}
{/snippet}

<div class="page">
	<PageHeader title="Website" subtitle="What visitors see on the public site">
		{#snippet actions()}
			<a class="btn btn-secondary" href="/" target="_blank" rel="noopener"><ExternalLink /> Open site</a>
		{/snippet}
	</PageHeader>

	<div class="sections">
		<form class="card rise" method="POST" action="?/settings" oninput={() => (dirty.contact = true)} use:enhance={toasting(() => (dirty.contact = false), { reset: false })}>
			<div class="card-head"><h2>Contact {@render dot('contact')}</h2><button class="btn btn-primary btn-sm" disabled={!dirty.contact}>Save</button></div>
			<div class="card-pad stack">
				<div class="form-row">
					<div class="field"><label class="label" for="c-phone">Phone</label><input id="c-phone" class="input" name="contactPhone" type="tel" value={s.contactPhone ?? ''} placeholder="98765 43210" /></div>
					<div class="field"><label class="label" for="c-wa">WhatsApp</label><input id="c-wa" class="input" name="whatsappNumber" type="tel" value={s.whatsappNumber ?? ''} placeholder="98765 43210" /></div>
				</div>
				<div class="field"><label class="label" for="c-email">Email</label><input id="c-email" class="input" name="email" type="email" value={s.email ?? ''} /></div>
				<div class="field"><label class="label" for="c-addr">Address</label><textarea id="c-addr" class="textarea" name="address" rows="2" maxlength="500">{s.address ?? ''}</textarea></div>
				<div class="field"><label class="label" for="c-map">Google Maps link</label><input id="c-map" class="input" name="mapUrl" value={s.mapUrl ?? ''} placeholder="https://maps.app.goo.gl/…" /></div>
			</div>
		</form>

		<form class="card rise" style="--i: 1" method="POST" action="?/settings" oninput={() => (dirty.hero = true)} use:enhance={toasting(() => (dirty.hero = false), { reset: false })}>
			<div class="card-head"><h2>Home page hero {@render dot('hero')}</h2><button class="btn btn-primary btn-sm" disabled={!dirty.hero}>Save</button></div>
			<div class="card-pad stack">
				<div class="field"><label class="label" for="h-head">Headline</label><input id="h-head" class="input" name="heroHeadline" value={s.heroHeadline ?? ''} maxlength="120" /></div>
				<div class="field"><label class="label" for="h-sub">Subline</label><textarea id="h-sub" class="textarea" name="heroSubline" rows="2" maxlength="300">{s.heroSubline ?? ''}</textarea></div>
				<div class="field">
					<span class="label">Numbers (up to 8)</span>
					<div class="stack-sm">
						{#each stats as st, i (i)}
							<div class="stat-row">
								<input class="input font-mono" name="stats.value" bind:value={st.value} placeholder="214" maxlength="20" aria-label="Number {i + 1}" />
								<input class="input" name="stats.label" bind:value={st.label} placeholder="Selections in 2025" maxlength="40" aria-label="Label {i + 1}" />
								<button type="button" class="icon-btn icon-btn-sm" aria-label="Remove number {i + 1}" onclick={() => ((stats = stats.filter((_, j) => j !== i)), (dirty.hero = true))}><X /></button>
							</div>
						{/each}
						{#if !stats.length}<input type="hidden" name="stats.label" value="" /><input type="hidden" name="stats.value" value="" />{/if}
						{#if stats.length < 8}<button type="button" class="btn btn-ghost btn-sm" onclick={() => ((stats = [...stats, { label: '', value: '' }]), (dirty.hero = true))}><Plus /> Add number</button>{/if}
					</div>
				</div>
			</div>
		</form>

		<form class="card rise" style="--i: 2" method="POST" action="?/settings" oninput={() => (dirty.socials = true)} use:enhance={toasting(() => (dirty.socials = false), { reset: false })}>
			<div class="card-head"><h2>Social links {@render dot('socials')}</h2><button class="btn btn-primary btn-sm" disabled={!dirty.socials}>Save</button></div>
			<div class="card-pad stack">
				{#each [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['x', 'X (Twitter)']] as [k, label] (k)}
					<div class="field"><label class="label" for="so-{k}">{label}</label><input id="so-{k}" class="input" name="socials.{k}" value={s.socials?.[k as 'youtube'] ?? ''} placeholder="https://…" /></div>
				{/each}
			</div>
		</form>
	</div>

	{#each [{ k: 'topper' as Kind, title: 'Toppers', rows: data.toppers as Person[], hint: 'Shown on the results page and home page' }, { k: 'faculty' as Kind, title: 'Faculty', rows: data.faculty as Person[], hint: 'Shown on the faculty page' }] as group (group.k)}
		<section class="mt-8 rise">
			<div class="section-head">
				<h2 class="section-title">{group.title} <span class="small muted font-normal">{group.hint}</span></h2>
				<button class="btn btn-secondary btn-sm" onclick={() => edit(group.k, null)}><Plus /> Add</button>
			</div>
			{#if group.rows.length}
				<ol class="list">
					{#each group.rows as p, i (p.id)}
						<li class="list-row">
							<button class="row-main" onclick={() => edit(group.k, p)} aria-label="Edit {p.name}">
								<span class="avatar avatar-photo">{#if p.photo}<img src={p.photo} alt="" loading="lazy" />{:else}{p.name.slice(0, 1)}{/if}</span>
								<span class="grow">
									<span class="title block">{p.name}</span>
									<span class="meta block">{#if !p.published}<span class="badge badge-closed phone-only">Hidden</span> {/if}{group.k === 'topper' ? `${p.result} · ${p.exam}` : p.subject}</span>
								</span>
								<ChevronRight class="chev phone-only" />
							</button>
							<span class="row-actions">
								<form method="POST" action="?/publish" use:enhance={toasting()}>
									<input type="hidden" name="kind" value={group.k} /><input type="hidden" name="id" value={p.id} />
									<input type="hidden" name="published" value={p.published ? 'false' : 'true'} />
									<button class="badge {p.published ? 'badge-success' : 'badge-closed'} toggle" aria-label={p.published ? `Hide ${p.name}` : `Publish ${p.name}`}>{p.published ? 'Published' : 'Hidden'}</button>
								</form>
								<button class="icon-btn icon-btn-sm" aria-label="Move up" disabled={i === 0} onclick={() => move(group.k, group.rows, i, i - 1)}><ArrowUp /></button>
								<button class="icon-btn icon-btn-sm" aria-label="Move down" disabled={i === group.rows.length - 1} onclick={() => move(group.k, group.rows, i, i + 1)}><ArrowDown /></button>
								<button class="icon-btn icon-btn-sm" aria-label="Edit {p.name}" onclick={() => edit(group.k, p)}><Pencil /></button>
								<button class="icon-btn icon-btn-sm" aria-label="Delete {p.name}" onclick={() => ((del = { kind: group.k, id: p.id, name: p.name }), (delOpen = true))}><Trash2 /></button>
							</span>
						</li>
					{/each}
				</ol>
			{:else}
				<div class="card"><EmptyState compact icon={UserRound} title="No {group.title.toLowerCase()} yet">
					{#snippet action()}<button class="btn btn-primary btn-sm" onclick={() => edit(group.k, null)}><Plus /> Add</button>{/snippet}
				</EmptyState></div>
			{/if}
		</section>
	{/each}
</div>

<Sheet bind:open={sheet} title="{editing ? 'Edit' : 'Add'} {kind === 'topper' ? 'topper' : 'faculty member'}">
	{#key editing?.id ?? kind}
		<form method="POST" action="?/savePerson" class="stack" use:enhance={toasting(() => (sheet = false))}>
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="id" value={editing?.id ?? ''} />
			<FileUpload accept="image" bind:value={photo} name="photoFileId" label="Photo (square works best)" />
			<div class="field"><label class="label" for="p-name">Name</label><input id="p-name" class="input" name="name" value={editing?.name ?? ''} required maxlength="80" /></div>
			{#if kind === 'topper'}
				<div class="form-row">
					<div class="field"><label class="label" for="p-exam">Exam</label><input id="p-exam" class="input" name="exam" value={editing?.exam ?? ''} required maxlength="80" placeholder="MP Police 2025" /></div>
					<div class="field"><label class="label" for="p-result">Result</label><input id="p-result" class="input" name="result" value={editing?.result ?? ''} required maxlength="60" placeholder="Selected, Rank 12" /></div>
				</div>
				<div class="field"><label class="label" for="p-quote">Quote (optional)</label><textarea id="p-quote" class="textarea" name="quote" rows="2" maxlength="300">{editing?.quote ?? ''}</textarea></div>
			{:else}
				<div class="field"><label class="label" for="p-subj">Subject</label><input id="p-subj" class="input" name="subject" value={editing?.subject ?? ''} required maxlength="80" placeholder="Reasoning" /></div>
				<div class="field"><label class="label" for="p-bio">Short bio (optional)</label><textarea id="p-bio" class="textarea" name="bio" rows="3" maxlength="600">{editing?.bio ?? ''}</textarea></div>
			{/if}
			<Switch bind:checked={published} name="published" label="Show on the website" />
			<button class="btn btn-primary btn-block">{editing ? 'Save' : 'Add'}</button>
		</form>
		{#if editing}
			{@const rows = (kind === 'topper' ? data.toppers : data.faculty) as Person[]}
			{@const at = rows.findIndex((x) => x.id === editing?.id)}
			<div class="flex flex-wrap gap-2 mt-4 phone-only-flex">
				<button type="button" class="btn btn-secondary btn-sm" disabled={at <= 0} onclick={() => move(kind, rows, at, at - 1)}><ArrowUp /> Move up</button>
				<button type="button" class="btn btn-secondary btn-sm" disabled={at === rows.length - 1} onclick={() => move(kind, rows, at, at + 1)}><ArrowDown /> Move down</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => ((del = { kind, id: editing?.id ?? '', name: editing?.name ?? '' }), (sheet = false), (delOpen = true))}><Trash2 /> Delete</button>
			</div>
		{/if}
	{/key}
</Sheet>

<form bind:this={reorderForm} method="POST" action="?/reorder" hidden use:enhance={toasting()}>
	<input type="hidden" name="kind" value={reorder.kind} /><input type="hidden" name="ids" value={reorder.ids} />
</form>
<form bind:this={delForm} method="POST" action="?/deletePerson" hidden use:enhance={toasting()}>
	<input type="hidden" name="kind" value={del.kind} /><input type="hidden" name="id" value={del.id} />
</form>
<ConfirmSheet bind:open={delOpen} title="Delete {del.name}?" body="They are removed from the website right away." confirmLabel="Delete" danger onconfirm={() => delForm?.requestSubmit()} />

<style>
	.sections { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
	@media (min-width: 1024px) { .sections { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } .sections > :nth-child(3) { grid-column: 1 / -1; } }
	.card-head h2 { display: inline-flex; align-items: center; gap: .5rem; }
	.unsaved { width: 8px; height: 8px; border-radius: 999px; background: hsl(var(--sun)); display: inline-block; }
	.stat-row { display: grid; grid-template-columns: 6rem minmax(0, 1fr) auto; gap: .5rem; align-items: center; }
	.row-main { display: flex; align-items: center; gap: .875rem; flex: 1; min-width: 0; text-align: left; min-height: 44px; }
	.row-actions { display: none; align-items: center; gap: .125rem; margin-left: auto; }
	@media (min-width: 768px) { .row-actions { display: flex; } :global(.phone-only), .phone-only-flex { display: none !important; } }
	.toggle { min-height: 32px; margin-right: .25rem; cursor: pointer; }
	.avatar-photo { overflow: hidden; }
	.avatar-photo img { width: 100%; height: 100%; object-fit: cover; }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
