<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import PostForm from '#lib/features/posts/components/PostForm.svelte';
	import type { PostKind } from '#lib/features/posts/format';

	let { data } = $props();
	const kind = (['current_affairs', 'job_alert', 'syllabus'].includes(page.url.searchParams.get('kind') ?? '') ? page.url.searchParams.get('kind') : 'current_affairs') as PostKind;
</script>

<svelte:head><title>New post · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader title="New post" subtitle="Paste today's current affairs, a job alert or an exam syllabus." crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/posts', label: 'Daily posts' }]} />
	<div class="card card-pad rise">
		<PostForm {kind} today={data.today} exams={data.exams} action="?" submitLabel="Save post" />
	</div>
</div>
