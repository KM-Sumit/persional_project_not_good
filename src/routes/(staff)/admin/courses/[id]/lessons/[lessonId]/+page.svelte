<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import Picker from '#lib/components/kit/Picker.svelte';
	import LessonForm from '#lib/features/courses/components/admin/LessonForm.svelte';
	import { postAction } from '#lib/features/courses/components/admin/submit';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	let chapterId = $state<string | null>(data.lesson.chapterId);
	let deleteOpen = $state(false);
	const crumbs = $derived([
		{ href: '/admin', label: 'Dashboard' },
		{ href: '/admin/courses', label: 'Courses' },
		{ href: `/admin/courses/${data.course.id}`, label: data.course.title }
	]);
</script>

<svelte:head><title>{data.lesson.title} · UCI staff</title></svelte:head>

<div class="page-narrow stack">
	<PageHeader title={data.lesson.title} eyebrow="Edit lesson" {crumbs} />
	<div class="card card-pad rise">
		{#key data.lesson}
			<LessonForm lesson={data.lesson} action="?/save" submitLabel="Save lesson">
				{#snippet fields()}
					{#if data.chapters.length > 1}
						<div class="field">
							<label class="label" for="lesson-chapter">Chapter</label>
							<Picker id="lesson-chapter" bind:value={chapterId} options={data.chapters} name="chapterId" label="Chapter" />
						</div>
					{/if}
				{/snippet}
				<a href="/admin/courses/{data.course.id}" class="btn btn-ghost">Back to outline</a>
			</LessonForm>
		{/key}
	</div>
	<button type="button" class="btn btn-ghost text-danger" onclick={() => (deleteOpen = true)}><Trash2 aria-hidden="true" />Delete lesson</button>
</div>

<ConfirmSheet
	bind:open={deleteOpen}
	title="Delete this lesson?"
	body="Students' progress on it is deleted too."
	confirmLabel="Delete lesson"
	danger
	onconfirm={async () => {
		if (!(await postAction('?/delete', {}))) throw new Error('failed');
	}}
/>
