<script lang="ts">
	// Note editor: markdown body (write / preview, or fill it from a .md file), optional PDF, exam, subject, batch.
	import { enhance } from '$app/forms';
	import { FileUp } from '@lucide/svelte';
	import Switch from '#lib/components/ui/Switch.svelte';
	import { toast } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import { withToast } from '#lib/features/courses/components/admin/submit';

	type Opt = { value: string; label: string; hint?: string; group?: string };
	type Note = {
		title: string;
		summary: string;
		body: string;
		examId: string | null;
		subjectId: string | null;
		batchId: string | null;
		fileId: string | null;
		published: boolean;
		paid: boolean;
	};
	interface Props {
		note?: Note | null;
		exams: Opt[];
		subjects: Opt[];
		batches: Opt[];
		action: string;
		submitLabel: string;
	}
	let { note = null, exams, subjects, batches, action, submitLabel }: Props = $props();

	// svelte-ignore state_referenced_locally
	const n = note;
	let title = $state(n?.title ?? '');
	let body = $state(n?.body ?? '');
	let examId = $state<string | null>(n?.examId ?? null);
	let subjectId = $state<string | null>(n?.subjectId ?? null);
	let batchId = $state<string | null>(n?.batchId ?? '');
	let pdf = $state(n?.fileId ? { id: n.fileId, name: 'Note PDF', url: `/api/files/${n.fileId}` } : null);
	let paid = $state(n?.paid ?? false);
	let published = $state(n?.published ?? false);
	let busy = $state(false);
	const uid = $props.id();

	async function loadMd(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		if (file.size > 1024 * 1024) return toast('That file is over 1 MB. Notes are text; check the file.', 'error');
		const text = (await file.text()).replace(/\r\n/g, '\n');
		if (body.trim() && !confirm('Replace the current text with this file?')) return;
		body = text;
		if (!title.trim()) title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.name.replace(/\.(md|markdown|txt)$/i, '');
		toast(`Loaded ${file.name}`);
	}
</script>

<form
	method="POST"
	{action}
	class="stack"
	use:enhance={withToast('Note saved', undefined, (b) => (busy = b))}
>
	<div class="field">
		<label class="label" for="{uid}-title">Title</label>
		<input id="{uid}-title" class="input" name="title" bind:value={title} required maxlength="200" placeholder="Percentage: short tricks" />
	</div>
	<div class="field">
		<label class="label" for="{uid}-summary">One-line summary <span class="opt">(optional)</span></label>
		<input id="{uid}-summary" class="input" name="summary" maxlength="500" value={n?.summary ?? ''} placeholder="What this note covers" />
	</div>
	<div class="form-row">
		<div class="field">
			<label class="label" for="{uid}-exam">Exam</label>
			<Picker id="{uid}-exam" bind:value={examId} options={exams} name="examId" placeholder="Any exam" label="Exam" />
		</div>
		<div class="field">
			<label class="label" for="{uid}-subject">Subject</label>
			<Picker id="{uid}-subject" bind:value={subjectId} options={subjects} name="subjectId" placeholder="Choose subject" label="Subject" />
		</div>
	</div>
	<div class="field">
		<label class="label" for="{uid}-batch">Who can see it</label>
		<Picker id="{uid}-batch" bind:value={batchId} options={batches} name="batchId" label="Who can see it" />
	</div>

	<div class="field">
		<div class="mb-1.5 flex items-center justify-between gap-2">
			<span class="label mb-0">Note</span>
			<label class="btn btn-ghost btn-sm">
				<FileUp aria-hidden="true" />Upload .md
				<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" class="sr-only" onchange={loadMd} />
			</label>
		</div>
		<MarkdownEditor bind:value={body} name="body" rows={16} placeholder={'## Heading\n\nWrite in Markdown. Use $x^2$ for maths and $$...$$ for display formulas.'} />
	</div>

	<div class="field">
		<FileUpload accept="pdf" bind:value={pdf} name="fileId" label="PDF (optional)" />
	</div>

	<Switch bind:checked={paid} name="isPaid" label="Paid note" description="Only students with the exam pass can open it." />
	<Switch bind:checked={published} name="published" label="Published" description="Students can find and read it." />

	<div>
		<button class="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>
