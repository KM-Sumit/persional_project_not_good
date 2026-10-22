<script lang="ts">
	// Course details: title, summary, markdown description, instructor, exam, visibility, cover, paid.
	import { enhance } from '$app/forms';
	import Switch from '#lib/components/ui/Switch.svelte';
	import Picker from '#lib/components/kit/Picker.svelte';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import { withToast } from './submit';

	type Opt = { value: string; label: string; hint?: string; group?: string };
	type Course = {
		title: string;
		summary: string;
		description: string;
		instructor: string;
		examId: string | null;
		batchId: string | null;
		coverFileId: string | null;
		coverUrl: string | null;
		paid: boolean;
	};
	interface Props {
		course?: Course | null;
		exams: Opt[];
		batches: Opt[];
		action: string;
		submitLabel: string;
		/** When set, the course is created as free or paid and the switch is hidden. */
		lockPaid?: boolean | null;
	}
	let { course = null, exams, batches, action, submitLabel, lockPaid = null }: Props = $props();

	// Editor state starts from the saved course; the page remounts this form when the course changes.
	// svelte-ignore state_referenced_locally
	const c = course;
	let description = $state(c?.description ?? '');
	let examId = $state<string | null>(c?.examId ?? null);
	let batchId = $state<string | null>(c?.batchId ?? '');
	let paid = $state(lockPaid ?? c?.paid ?? false);
	let cover = $state(c?.coverFileId ? { id: c.coverFileId, name: 'Cover image', url: `/api/files/${c.coverFileId}` } : null);
	let coverUrl = $state(c?.coverUrl ?? '');
	let busy = $state(false);
	const ytCover = $derived(/i\.ytimg\.com/.test(coverUrl));
</script>

<form
	method="POST"
	{action}
	class="stack"
	use:enhance={withToast('Course saved', undefined, (b) => (busy = b))}
>
	<div class="field">
		<label class="label" for="c-title">Folder name</label>
		<input id="c-title" class="input" name="title" required maxlength="200" value={c?.title ?? ''} placeholder="Maths Basics" />
	</div>
	<div class="field">
		<FileUpload accept="image" bind:value={cover} name="coverFileId" label="Banner" />
		{#if !cover}
			<input class="input mt-2" name="coverUrl" bind:value={coverUrl} inputmode="url" placeholder="Or paste a banner image link" aria-label="Banner image link" />
			<p class="help">{ytCover ? 'Using the first video’s YouTube thumbnail.' : 'Students see this banner on the course.'}</p>
		{:else}
			<input type="hidden" name="coverUrl" value="" />
		{/if}
	</div>
	{#if lockPaid === true}
		<input type="hidden" name="isPaid" value="on" />
	{/if}
	<details class="more">
		<summary>More details</summary>
		<div class="stack mt-3">
	<div class="field">
		<label class="label" for="c-summary">One-line summary <span class="opt">(optional)</span></label>
		<input id="c-summary" class="input" name="summary" maxlength="500" value={c?.summary ?? ''} placeholder="What a student can do after this course" />
	</div>
	<div class="field">
		<span class="label">Description <span class="opt">(optional, markdown)</span></span>
		<MarkdownEditor bind:value={description} name="description" rows={8} placeholder="Who it is for, what is inside, how to study it." />
	</div>
	<div class="form-row">
		<div class="field">
			<label class="label" for="c-instructor">Instructor</label>
			<input id="c-instructor" class="input" name="instructor" maxlength="120" value={c?.instructor ?? 'UCI Faculty'} />
		</div>
		<div class="field">
			<label class="label" for="c-exam">Exam</label>
			<Picker id="c-exam" bind:value={examId} options={exams} name="examId" placeholder="Choose exam" label="Exam" />
		</div>
	</div>
	<div class="field">
		<label class="label" for="c-batch">Who can see it</label>
		<Picker id="c-batch" bind:value={batchId} options={batches} name="batchId" label="Who can see it" />
	</div>
	{#if lockPaid === null}
		<Switch bind:checked={paid} name="isPaid" label="Paid course" description="Students need the course product or the exam pass. Preview lessons stay free." />
	{/if}
		</div>
	</details>
	<div>
		<button class="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>
