<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { CircleCheck, CircleDashed, ExternalLink, Trash2 } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Switch from '#lib/components/ui/Switch.svelte';
	import { toast } from '#lib/components/ui';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import CourseForm from '#lib/features/courses/components/admin/CourseForm.svelte';
	import CourseOutline from '#lib/features/courses/components/admin/CourseOutline.svelte';
	import { postAction, withToast } from '#lib/features/courses/components/admin/submit';

	let { data } = $props();
	const c = $derived(data.course);
	const lessons = $derived(c.chapters.flatMap((ch) => ch.lessons));
	const incomplete = $derived(
		lessons.filter((l) => (l.kind === 'video' && !l.youtubeId) || (l.kind === 'pdf' && !l.fileId) || (l.kind === 'reading' && !l.body.trim())).length
	);
	const checks = $derived([
		{ ok: lessons.length > 0, label: lessons.length ? `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} in ${c.chapters.length} chapter${c.chapters.length === 1 ? '' : 's'}` : 'At least one lesson' },
		{ ok: lessons.length > 0 && incomplete === 0, label: incomplete ? `${incomplete} lesson${incomplete === 1 ? ' is' : 's are'} incomplete` : 'Every lesson has its video, text or PDF' },
		{ ok: Boolean(c.coverFileId || c.coverUrl), label: c.coverFileId || c.coverUrl ? 'Cover image set' : 'Cover image (first video thumbnail is used)' }
	]);
	const ready = $derived(checks[0]!.ok && checks[1]!.ok);

	let tab = $state<'outline' | 'details'>('outline');
	let notify = $state(true);
	let busy = $state(false);
	let deleteOpen = $state(false);

	onMount(() => {
		if (page.url.searchParams.has('created')) {
			toast('Folder created. Add a video or notes.');
			const u = new URL(page.url.href);
			u.searchParams.delete('created');
			replaceState(u, page.state);
		}
	});
</script>

<svelte:head><title>{c.title} · Courses · UCI staff</title></svelte:head>

<div class="page">
	<PageHeader title={c.title} eyebrow={c.published ? 'Published course' : 'Draft course'} crumbs={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/courses', label: 'Courses' }]}>
		{#snippet actions()}
			{#if c.published}
				<a href="/courses/{c.slug}" class="btn btn-ghost" target="_blank" rel="noopener"><ExternalLink aria-hidden="true" />View</a>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="segmented tabs-touch mb-4" role="tablist" aria-label="Editor sections">
		<button type="button" role="tab" aria-selected={tab === 'outline'} onclick={() => (tab = 'outline')}>Outline</button>
		<button type="button" role="tab" aria-selected={tab === 'details'} onclick={() => (tab = 'details')}>Details</button>
	</div>

	<div class="editor" data-tab={tab}>
		<section class="outline-col" aria-label="Outline">
			<CourseOutline course={c} />
		</section>

		<aside class="side stack">
			<section class="card card-pad stack-sm" aria-label="Publishing">
				<div class="flex items-center justify-between gap-2">
					<h2 class="section-title">Publishing</h2>
					<span class="badge {c.published ? 'badge-success' : 'badge-draft'}">{c.published ? 'Published' : 'Draft'}</span>
				</div>
				<ul class="checks">
					{#each checks as k (k.label)}
						<li class:ok={k.ok}>
							{#if k.ok}<CircleCheck aria-hidden="true" />{:else}<CircleDashed aria-hidden="true" />{/if}
							<span>{k.label}</span>
						</li>
					{/each}
				</ul>
				{#if c.published}
					<form method="POST" action="?/unpublish" use:enhance={withToast('Course moved to drafts')}>
						<button class="btn btn-secondary btn-block">Unpublish</button>
					</form>
				{:else}
					<form
						method="POST"
						action="?/publish"
						class="stack-sm"
						use:enhance={withToast('Course published', undefined, (b) => (busy = b))}
					>
						<Switch bind:checked={notify} name="notify" label="Notify students" description={c.batchId ? 'Sends an inbox message to this batch.' : 'Sends an inbox message to every student.'} />
						<button class="btn btn-primary btn-block" disabled={!ready || busy}>{busy ? 'Publishing…' : 'Publish course'}</button>
					</form>
				{/if}
			</section>

			<section class="card card-pad details" aria-label="Details">
				<h2 class="section-title mb-3">Details</h2>
				{#key c.id + c.updatedAt}
					<CourseForm course={c} exams={data.exams} batches={data.batches} action="?/save" submitLabel="Save details" />
				{/key}
			</section>

			<button type="button" class="btn btn-ghost text-danger delete" onclick={() => (deleteOpen = true)}><Trash2 aria-hidden="true" />Delete course</button>
		</aside>
	</div>
</div>

<ConfirmSheet
	bind:open={deleteOpen}
	title="Delete this course?"
	body="Its chapters, lessons and every student's progress are deleted. This cannot be undone. Type DELETE to confirm."
	confirmLabel="Delete course"
	typed="DELETE"
	danger
	onconfirm={async () => {
		if (!(await postAction('?/delete', {}))) throw new Error('failed');
	}}
/>

<style>
	.editor {
		display: grid;
		gap: 1.25rem;
		padding-bottom: 2rem;
	}
	.checks {
		display: grid;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.checks li {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.checks li.ok {
		color: hsl(var(--foreground));
	}
	.checks :global(svg) {
		flex: none;
		width: 1rem;
		height: 1rem;
		margin-top: 0.125rem;
	}
	.checks li.ok :global(svg) {
		color: hsl(var(--success));
	}
	.delete {
		justify-self: start;
	}
	@media (max-width: 1023px) {
		.side {
			order: -1;
		}
		.editor[data-tab='outline'] .details,
		.editor[data-tab='outline'] .delete,
		.editor[data-tab='details'] .outline-col {
			display: none;
		}
	}
	@media (min-width: 1024px) {
		.tabs-touch {
			display: none;
		}
		.editor {
			grid-template-columns: minmax(0, 1fr) 24rem;
			align-items: start;
		}
	}
</style>
