<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { ExternalLink, Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import NoteForm from '#lib/features/notes/components/admin/NoteForm.svelte';
	import { postAction } from '#lib/features/courses/components/admin/submit';

	let { data } = $props();
	const n = $derived(data.note);
	let deleteOpen = $state(false);

	onMount(() => {
		if (page.url.searchParams.has('created')) {
			toast('Note saved');
			const u = new URL(page.url.href);
			u.searchParams.delete('created');
			replaceState(u, page.state);
		}
	});
</script>

<svelte:head><title>{n.title} · Notes · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader title={n.title} eyebrow={n.published ? 'Published note' : 'Draft note'} crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/notes', label: 'Notes' }]}>
		{#snippet actions()}
			{#if n.published}<a href="/app/notes/{n.slug}" class="btn btn-ghost" target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View</a>{/if}
		{/snippet}
	</PageHeader>
	<div class="card card-pad rise">
		{#key n.id + n.updatedAt}
			<NoteForm note={n} exams={data.exams} subjects={data.subjects} batches={data.batches} action="?/save" submitLabel="Save note" />
		{/key}
	</div>
	<button type="button" class="btn btn-ghost text-danger" onclick={() => (deleteOpen = true)}><Trash2 aria-hidden="true" />Delete note</button>
</div>

<ConfirmSheet
	bind:open={deleteOpen}
	title="Delete this note?"
	body="Students lose it and their bookmarks of it. This cannot be undone."
	confirmLabel="Delete note"
	danger
	onconfirm={async () => {
		if (!(await postAction('?/delete', {}))) throw new Error('failed');
	}}
/>
