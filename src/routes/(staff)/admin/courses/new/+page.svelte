<script lang="ts">
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import CourseForm from '#lib/features/courses/components/admin/CourseForm.svelte';

	let { data } = $props();
</script>

<svelte:head><title>New course · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader title="New course" subtitle="Start with the details. You add chapters and YouTube lessons on the next screen." crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/courses', label: 'Courses' }]} />
	<div class="card card-pad rise">
		<CourseForm exams={data.exams} batches={data.batches} action="?" submitLabel="Create course" />
	</div>
</div>
