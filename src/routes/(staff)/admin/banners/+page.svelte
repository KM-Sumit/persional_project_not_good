<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { ArrowDown, ArrowUp, Ellipsis, GripVertical, Image as ImageIcon, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { EmptyState, PageHeader, Sheet, Switch } from '#lib/components/ui';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import Picker from '#lib/components/kit/Picker.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import BannerCard from '#lib/features/engage/components/BannerCard.svelte';
	import type { FileDto } from '#lib/features/files/schema';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	type Banner = (typeof data.banners)[number];

	const DESTS = [
		{ value: '/app', label: 'Today (home)' },
		{ value: '/app/learn', label: 'Courses' },
		{ value: '/app/tests', label: 'Tests' },
		{ value: '/app/notes', label: 'Notes' },
		{ value: '/app/inbox', label: 'Inbox' },
		{ value: 'custom', label: 'Another link…' }
	];
	const destLabel = (href: string) => DESTS.find((d) => d.value === href)?.label ?? (href.startsWith('https://') ? 'Website link' : href);

	// Local order so arrows/drag feel instant; the server order wins after each save.
	let order = $state<Banner[]>([]);
	$effect.pre(() => {
		order = [...data.banners];
	});

	let open = $state(false);
	let editingId = $state<string | null>(null);
	let draft = $state({ title: '', subtitle: '', ctaLabel: 'Explore', href: '/app', imageUrl: '', enabled: true });
	let dest = $state<string | null>('/app');
	let file = $state<FileDto | null>(null);
	let imgMode = $state<'upload' | 'url'>('upload');
	const preview = $derived(file?.url ?? (imgMode === 'url' && draft.imageUrl.startsWith('https://') ? draft.imageUrl : null));

	let menuFor = $state<{ b: Banner; i: number } | null>(null);
	let menuOpen = $state(false);

	let reorderForm = $state<HTMLFormElement>();
	let reorderIds = $state('');
	let dragFrom = $state<number | null>(null);

	let delId = $state('');
	let delOpen = $state(false);
	let delForm = $state<HTMLFormElement>();

	function edit(b: Banner | null) {
		editingId = b?.id ?? null;
		draft = b
			? { title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, href: b.href, imageUrl: b.imageFileId ? '' : (b.image ?? ''), enabled: b.enabled }
			: { title: '', subtitle: '', ctaLabel: 'Explore', href: '/app', imageUrl: '', enabled: true };
		dest = DESTS.some((d) => d.value === draft.href) ? draft.href : 'custom';
		file = b?.imageFileId && b.image ? { id: b.imageFileId, name: 'Current image', url: b.image } : null;
		imgMode = b && !b.imageFileId && b.image ? 'url' : 'upload';
		menuOpen = false;
		open = true;
	}

	async function move(from: number, to: number) {
		if (to < 0 || to >= order.length || from === to) return;
		const next = [...order];
		const [b] = next.splice(from, 1);
		next.splice(to, 0, b!);
		order = next;
		reorderIds = next.map((x) => x.id).join(',');
		menuOpen = false;
		await tick();
		reorderForm?.requestSubmit();
	}
	const toggle = (e: Event) => (e.currentTarget as HTMLInputElement).form?.requestSubmit();
</script>

<div class="page">
	<PageHeader title="Home banners" subtitle="Slides at the top of the student app's Today screen">
		{#snippet actions()}
			<button class="btn btn-primary" onclick={() => edit(null)}><Plus /> New banner</button>
		{/snippet}
	</PageHeader>

	{#if order.length}
		<ol class="banners">
			{#each order as b, i (b.id)}
				<li
					class="card item rise"
					style="--i: {Math.min(i, 8)}"
					class:dragging={dragFrom === i}
					class:off={!b.enabled}
					draggable="true"
					ondragstart={() => (dragFrom = i)}
					ondragover={(e) => e.preventDefault()}
					ondrop={() => dragFrom != null && move(dragFrom, i)}
					ondragend={() => (dragFrom = null)}
				>
					<span class="grip" title="Drag to reorder" aria-hidden="true"><GripVertical /></span>
					<button class="preview" onclick={() => edit(b)} aria-label="Edit {b.title}">
						<BannerCard title={b.title} subtitle={b.subtitle} ctaLabel={b.ctaLabel} imageSrc={b.image} />
					</button>
					<div class="info">
						<button class="info-main" onclick={() => edit(b)} tabindex="-1">
							<span class="small block truncate"><span class="muted">Opens:</span> <span class="font-semibold">{destLabel(b.href)}</span></span>
						</button>
						<form method="POST" action="?/toggle" use:enhance={toasting()} class="switch-form">
							<input type="hidden" name="id" value={b.id} />
							<input type="hidden" name="enabled" value={b.enabled ? 'false' : 'true'} />
							<span class="switch-text small muted">{b.enabled ? 'Shown' : 'Hidden'}</span>
							<span class="switch"><input type="checkbox" role="switch" checked={b.enabled} onchange={toggle} aria-label="Show {b.title} to students" /><span></span></span>
						</form>
						<span class="desk-actions">
							<button class="icon-btn icon-btn-sm" aria-label="Edit {b.title}" onclick={() => edit(b)}><Pencil /></button>
							<button class="icon-btn icon-btn-sm" aria-label="Delete {b.title}" onclick={() => ((delId = b.id), (delOpen = true))}><Trash2 /></button>
						</span>
						<button class="icon-btn phone-menu" aria-label="More for {b.title}" onclick={() => ((menuFor = { b, i }), (menuOpen = true))}><Ellipsis /></button>
					</div>
				</li>
			{/each}
		</ol>
	{:else}
		<div class="card"><EmptyState icon={ImageIcon} title="No banners yet" body="Add an offer, a new course or a live test. Students see it first thing on Today.">
			{#snippet action()}<button class="btn btn-primary" onclick={() => edit(null)}><Plus /> New banner</button>{/snippet}
		</EmptyState></div>
	{/if}
</div>

<Sheet bind:open={menuOpen} title={menuFor?.b.title ?? 'Banner'}>
	{#if menuFor}
		{@const m = menuFor}
		<div class="list">
			<button class="list-row" onclick={() => edit(m.b)}><Pencil class="size-5" /> Edit</button>
			<button class="list-row" disabled={m.i === 0} onclick={() => move(m.i, m.i - 1)}><ArrowUp class="size-5" /> Move up</button>
			<button class="list-row" disabled={m.i === order.length - 1} onclick={() => move(m.i, m.i + 1)}><ArrowDown class="size-5" /> Move down</button>
			<button class="list-row danger" onclick={() => ((delId = m.b.id), (menuOpen = false), (delOpen = true))}><Trash2 class="size-5" /> Delete</button>
		</div>
	{/if}
</Sheet>

<Sheet bind:open title={editingId ? 'Edit banner' : 'New banner'}>
	{#key editingId ?? 'new'}
		<div class="editor-preview"><BannerCard title={draft.title || 'Banner title'} subtitle={draft.subtitle} ctaLabel={draft.ctaLabel || 'Explore'} imageSrc={preview} /></div>
		<form class="stack" method="POST" action="?/save" use:enhance={toasting(() => (open = false))}>
			<input type="hidden" name="id" value={editingId ?? ''} />
			<div class="field"><label class="label" for="b-title">Title</label><input id="b-title" class="input" name="title" bind:value={draft.title} required maxlength="120" placeholder="SSC GD 2026 batch: 40% off" /></div>
			<div class="field"><label class="label" for="b-sub">Subtitle (optional)</label><input id="b-sub" class="input" name="subtitle" bind:value={draft.subtitle} maxlength="240" /></div>
			<div class="form-row">
				<div class="field"><label class="label" for="b-cta">Button text</label><input id="b-cta" class="input" name="ctaLabel" bind:value={draft.ctaLabel} maxlength="40" /></div>
				<div class="field"><span class="label">Opens</span><Picker bind:value={dest} options={DESTS} label="Opens" onchange={(v) => v && v !== 'custom' && (draft.href = v)} /></div>
			</div>
			{#if dest === 'custom'}
				<div class="field"><label class="label" for="b-href">Link</label><input id="b-href" class="input" bind:value={draft.href} maxlength="500" placeholder="/app/tests/… or https://…" /></div>
			{/if}
			<input type="hidden" name="href" value={draft.href} />
			<div class="field">
				<span class="label">Image (optional)</span>
				<div class="segmented mb-2" role="radiogroup" aria-label="Image source">
					<label><input type="radio" value="upload" bind:group={imgMode} /> Upload</label>
					<label><input type="radio" value="url" bind:group={imgMode} /> Link</label>
				</div>
				{#if imgMode === 'upload'}
					<FileUpload accept="image" bind:value={file} name="imageFileId" label="Wide image (2.4:1). Without one, students see the orange card above." />
				{:else}
					<input class="input" name="imageUrl" bind:value={draft.imageUrl} placeholder="https://…" />
				{/if}
			</div>
			<Switch bind:checked={draft.enabled} name="enabled" label="Show to students" />
			<button class="btn btn-primary btn-block">{editingId ? 'Save banner' : 'Add banner'}</button>
		</form>
	{/key}
</Sheet>

<form bind:this={reorderForm} method="POST" action="?/reorder" hidden use:enhance={toasting()}><input type="hidden" name="ids" value={reorderIds} /></form>
<form bind:this={delForm} method="POST" action="?/delete" hidden use:enhance={toasting()}><input type="hidden" name="id" value={delId} /></form>
<ConfirmSheet bind:open={delOpen} title="Delete this banner?" body="Students stop seeing it right away. This cannot be undone." confirmLabel="Delete" danger onconfirm={() => delForm?.requestSubmit()} />

<style>
	.banners { display: grid; gap: .75rem; }
	.item { display: grid; gap: .625rem; padding: .625rem; }
	.item.dragging { opacity: .5; }
	.item.off .preview { opacity: .55; }
	.preview { display: block; width: 100%; text-align: left; border-radius: var(--radius); }
	.info { display: flex; align-items: center; gap: .5rem; min-width: 0; }
	.info-main { flex: 1; min-width: 0; text-align: left; min-height: 44px; }
	.switch-form { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
	.grip, .desk-actions { display: none; }
	.danger { color: hsl(var(--danger)); }
	.list-row:disabled { opacity: .4; }
	.editor-preview { margin-bottom: 1rem; }
	@media (min-width: 768px) {
		.item { grid-template-columns: auto 15rem minmax(0, 1fr); align-items: center; }
		.grip { display: inline-flex; color: hsl(var(--muted-foreground)); cursor: grab; }
		.grip :global(svg) { width: 18px; height: 18px; }
		.desk-actions { display: flex; gap: .125rem; }
		.phone-menu { display: none; }
	}
	@media (max-width: 359px) { .switch-text { display: none; } }
</style>
