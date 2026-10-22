<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import CourseForm from '#lib/features/courses/components/admin/CourseForm.svelte';

	let { data } = $props();
	const paid = $derived(page.url.searchParams.get('paid') === '1');
	const locked = $derived(page.url.searchParams.has('paid'));
</script>

<svelte:head><title>New folder · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader
		title={locked ? (paid ? 'New paid folder' : 'New free folder') : 'New folder'}
		subtitle="Give it a name and a banner. On the next screen you add videos and notes."
		crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: `/admin/courses?access=${paid ? 'paid' : 'free'}`, label: paid ? 'Paid courses' : 'Free courses' }]}
	/>
	<div class="card card-pad rise">
		<CourseForm exams={data.exams} batches={data.batches} action="?" submitLabel="Create folder" lockPaid={locked ? paid : null} />
	</div>
</div>
