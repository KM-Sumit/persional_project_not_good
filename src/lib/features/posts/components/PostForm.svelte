<script lang="ts">
	// Staff post editor: kind, title, date (IST), exam, markdown body, optional PDF, published.
	import { enhance } from '$app/forms';
	import Switch from '#lib/components/ui/Switch.svelte';
	import Picker from '#lib/components/kit/Picker.svelte';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import { withToast } from '#lib/features/courses/components/admin/submit';
	import { fmtDay, kindLabel, type PostKind } from '../format';

	type Opt = { value: string; label: string; hint?: string; group?: string };
	type Post = { kind: PostKind; title: string; body: string; examId: string | null; fileId: string | null; publishedOn: string; published: boolean };
	interface Props {
		post?: Post | null;
		today: string;
		exams: Opt[];
		action: string;
		submitLabel: string;
		kind?: PostKind;
	}
	let { post = null, today, exams, action, submitLabel, kind: initialKind = 'current_affairs' }: Props = $props();

	// svelte-ignore state_referenced_locally
	const p = post;
	// svelte-ignore state_referenced_locally
	let kind = $state<PostKind>(p?.kind ?? initialKind);
	// svelte-ignore state_referenced_locally
	let publishedOn = $state(p?.publishedOn ?? today);
	let title = $state(p?.title ?? '');
	let body = $state(p?.body ?? '');
	let examId = $state<string | null>(p?.examId ?? null);
	let pdf = $state(p?.fileId ? { id: p.fileId, name: 'Attached PDF', url: `/api/files/${p.fileId}` } : null);
	let published = $state(p?.published ?? false);
	let busy = $state(false);
	// Announcements go through /admin/announcements (push + inbox); posts cover the dated reading content.
	const EDITOR_KINDS: PostKind[] = ['current_affairs', 'job_alert', 'syllabus'];
	const uid = $props.id();

	const placeholder = $derived(
		kind === 'current_affairs'
			? `Current affairs, ${fmtDay(publishedOn, { day: 'numeric', month: 'short', year: 'numeric' })}`
			: kind === 'job_alert'
				? 'MP Police Constable 2026: 7,500 posts'
				: kind === 'syllabus'
					? 'SSC CGL 2026 syllabus'
					: 'Holiday on Diwali'
	);
	const bodyHint = $derived(
		kind === 'current_affairs'
			? '## National\n\n- RBI kept the repo rate at 5.5%.\n\n## Sports\n\n- ...\n\nWrite one fact per line; the AI quiz is drafted from this text.'
			: kind === 'job_alert'
				? '**Posts:** 7,500\n**Last date:** 30 Nov 2026\n**Apply:** https://...'
				: 'Write in Markdown.'
	);
</script>

<form method="POST" {action} class="stack" use:enhance={withToast('Post saved', undefined, (b) => (busy = b))}>
	<fieldset class="field">
		<legend class="label">Type</legend>
		<div class="segmented" role="radiogroup">
			{#each EDITOR_KINDS as k (k)}
				<label><input type="radio" name="kind" value={k} bind:group={kind} />{kindLabel[k]}</label>
			{/each}
		</div>
	</fieldset>
	<div class="field">
		<label class="label" for="{uid}-title">Title</label>
		<input id="{uid}-title" class="input" name="title" bind:value={title} required maxlength="200" {placeholder} />
	</div>
	<div class="form-row">
		<div class="field">
			<label class="label" for="{uid}-date">Date</label>
			<input id="{uid}-date" class="input" type="date" name="publishedOn" bind:value={publishedOn} required />
		</div>
		<div class="field">
			<label class="label" for="{uid}-exam">Exam {#if kind !== 'syllabus'}<span class="opt">(optional)</span>{/if}</label>
			<Picker id="{uid}-exam" bind:value={examId} options={exams} name="examId" placeholder={kind === 'syllabus' ? 'Choose exam' : 'All exams'} label="Exam" />
		</div>
	</div>
	<div class="field">
		<span class="label">Text</span>
		<MarkdownEditor bind:value={body} name="body" rows={14} placeholder={bodyHint} />
	</div>
	<div class="field">
		<FileUpload accept="pdf" bind:value={pdf} name="fileId" label="PDF (optional)" />
	</div>
	<Switch bind:checked={published} name="published" label="Published" description="Visible to students and on the website from its date." />
	<div>
		<button class="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
	</div>
</form>
