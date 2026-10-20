<script lang="ts">
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import NoteForm from '#lib/features/notes/components/admin/NoteForm.svelte';

	let { data } = $props();
</script>

<svelte:head><title>New note · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader title="New note" subtitle="Write in Markdown, paste from a .md file, or attach a PDF." crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/notes', label: 'Notes' }]} />
	<div class="card card-pad rise">
		<NoteForm exams={data.exams} subjects={data.subjects} batches={data.batches} action="?" submitLabel="Save note" />
	</div>
</div>
