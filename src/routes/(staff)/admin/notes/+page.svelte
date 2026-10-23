<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { ChevronLeft, ChevronRight, NotebookText, Plus, Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { toast } from '#lib/components/ui';
	import { withToast } from '#lib/features/courses/components/admin/submit';

	let { data, form } = $props();
	const subject = $derived(data.subject);

	onMount(() => {
		if (!page.url.searchParams.has('deleted')) return;
		toast('Deleted');
		const u = new URL(page.url.href);
		u.searchParams.delete('deleted');
		replaceState(u, page.state);
	});

	const confirmDelete = (e: SubmitEvent, label: string) => {
		if (!confirm(`Delete ${label}?`)) e.preventDefault();
	};
</script>

<svelte:head><title>{subject ? subject.name : 'Notes'} · UCI staff</title></svelte:head>

<div class="page stack">
	{#if !subject}
		<PageHeader title="Notes" subtitle="Every subject. Open one to add notes." crumbs={[{ href: '/admin', label: 'Dashboard' }]} />

		<form method="POST" action="?/createSubject" class="card card-pad create" use:enhance={withToast(null)}>
			<label class="label" for="subject-name">New subject</label>
			<div class="row">
				<input id="subject-name" class="input" name="name" required maxlength="120" placeholder="Subject name" />
				<button class="btn btn-primary"><Plus />Create subject</button>
			</div>
			{#if form?.message}<p class="alert alert-danger">{form.message}</p>{/if}
		</form>

		{#if data.subjects.length}
			<nav class="list" aria-label="Subjects">
				{#each data.subjects as s (s.id)}
					<div class="list-row">
						<a class="grow subject" href="/admin/notes?subject={s.id}">
							<span class="leading-icon"><NotebookText /></span>
							<span class="min-w-0">
								<span class="title block truncate">{s.name}</span>
								<span class="meta block">{s.count} {s.count === 1 ? 'note' : 'notes'}</span>
							</span>
							<ChevronRight class="chev" />
						</a>
						<form method="POST" action="?/deleteSubject" onsubmit={(e) => confirmDelete(e, s.name)}>
							<input type="hidden" name="id" value={s.id} />
							<button class="icon-btn" aria-label="Delete {s.name}"><Trash2 /></button>
						</form>
					</div>
				{/each}
			</nav>
		{:else}
			<EmptyState icon={NotebookText} title="No subjects yet" body="Create a subject, then open it and add notes." />
		{/if}
		{#if data.loose}<p class="small muted">{data.loose} {data.loose === 1 ? 'note is' : 'notes are'} not in a subject. Open the note and choose one.</p>{/if}
	{:else}
		<PageHeader title={subject.name} subtitle="Notes in this subject" crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/notes', label: 'Notes' }]}>
			{#snippet actions()}
				<a href="/admin/notes/new?subject={subject.id}" class="btn btn-primary"><Plus />Add note</a>
			{/snippet}
		</PageHeader>
		<a class="back-link" href="/admin/notes" data-back><ChevronLeft />All subjects</a>

		{#if data.notes.length}
			<div class="list">
				{#each data.notes as n (n.id)}
					<div class="list-row">
						<a class="grow subject" href="/admin/notes/{n.id}">
							<span class="min-w-0">
								<span class="title block truncate">{n.title}</span>
								<span class="meta block">{n.published ? 'Published' : 'Draft'} · {n.readingMinutes} min</span>
							</span>
							<ChevronRight class="chev" />
						</a>
						<form method="POST" action="?/publish" use:enhance={withToast(null)}>
							<input type="hidden" name="id" value={n.id} />
							<input type="hidden" name="on" value={String(!n.published)} />
							<button class="btn btn-ghost btn-sm">{n.published ? 'Unpublish' : 'Publish'}</button>
						</form>
						<form method="POST" action="?/deleteNote" onsubmit={(e) => confirmDelete(e, n.title)}>
							<input type="hidden" name="id" value={n.id} />
							<input type="hidden" name="subject" value={subject.id} />
							<button class="icon-btn" aria-label="Delete {n.title}"><Trash2 /></button>
						</form>
					</div>
				{/each}
			</div>
		{:else}
			<EmptyState icon={NotebookText} title="No notes in this subject" body="Add a note, write it, and publish it for students.">
				{#snippet action()}<a href="/admin/notes/new?subject={subject.id}" class="btn btn-primary">Add note</a>{/snippet}
			</EmptyState>
		{/if}
	{/if}
</div>

<style>
	.create { display: grid; gap: 0.5rem; }
	.row { display: flex; gap: 0.5rem; align-items: center; }
	.row .input { flex: 1; min-width: 0; }
	.subject {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
</style>
