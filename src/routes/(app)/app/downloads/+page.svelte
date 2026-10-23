<script lang="ts">
	// Everything saved with "Save offline", read straight from Cache Storage (works with no network).
	import { onMount } from 'svelte';
	import { CloudOff, FileText, NotebookText, Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { toast } from '#lib/components/ui';
	import { formatSize, listSaved, offlineSupported, removeSaved, type SavedItem } from '#lib/components/pwa/offline';
	import PushToggle from '#lib/features/push/components/PushToggle.svelte';
	import { day } from '#lib/features/courses/components/format';

	let items = $state<SavedItem[] | null>(null);
	let supported = $state(true);
	const total = $derived((items ?? []).reduce((n, i) => n + i.size, 0));

	onMount(async () => {
		supported = offlineSupported();
		items = await listSaved().catch(() => []);
	});

	async function remove(i: SavedItem) {
		await removeSaved(i.url);
		items = (items ?? []).filter((x) => x.url !== i.url);
		toast('Removed from downloads');
	}
</script>

<svelte:head><title>Downloads · UCI</title></svelte:head>

<div class="page-narrow pb-10 stack-lg">
	<PageHeader
		title="Downloads"
		subtitle={items?.length ? `${items.length} saved · ${formatSize(total)} on this device` : 'Notes and PDFs you saved to read without internet.'}
		crumbs={[{ href: '/app', label: 'Home' }]}
	/>

	{#if !supported}
		<EmptyState icon={CloudOff} title="Offline saving is not available" body="This browser does not allow saving pages. Try Chrome, Edge or Safari." />
	{:else if items === null}
		<div class="list" aria-busy="true">
			{#each [0, 1, 2] as i (i)}<div class="list-row"><span class="skeleton sk-icon"></span><span class="grow"><span class="skeleton sk-line"></span></span></div>{/each}
		</div>
	{:else if items.length === 0}
		<EmptyState icon={CloudOff} title="Nothing saved yet" body="Open a note and tap Save offline. It stays here, even with no internet or after you sign out.">
			{#snippet action()}<a class="btn btn-primary" href="/app/notes">Browse notes</a>{/snippet}
		</EmptyState>
	{:else}
		<ul class="list">
			{#each items as i, n (i.url)}
				<li class="row rise" style="--i: {n}">
					<a class="list-row grow" href={i.url} data-sveltekit-reload>
						<span class="leading-icon">{#if i.kind === 'file'}<FileText />{:else}<NotebookText />{/if}</span>
						<span class="grow">
							<span class="title block">{i.title}</span>
							<span class="meta block"><span>{i.kind === 'file' ? 'PDF' : 'Note'}</span> · <span class="tabular">{formatSize(i.size)}</span> · Saved {day(i.savedAt)}</span>
						</span>
					</a>
					<button type="button" class="icon-btn" aria-label="Remove {i.title}" onclick={() => remove(i)}><Trash2 /></button>
				</li>
			{/each}
		</ul>
	{/if}

	<section class="list" aria-label="Notifications">
		<PushToggle />
	</section>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		padding-right: 0.25rem;
	}
	.row .list-row {
		min-width: 0;
		flex: 1;
	}
	.icon-btn {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		color: hsl(var(--muted-foreground));
	}
	.sk-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
	}
	.sk-line {
		display: block;
		height: 14px;
		width: 60%;
	}
</style>
