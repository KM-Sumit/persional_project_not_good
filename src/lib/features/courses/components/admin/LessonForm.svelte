<script lang="ts">
	// One lesson: video (any YouTube link -> id, thumbnail, title), reading (markdown) or PDF.
	// `compact` is the inline "Add lesson" form in the outline: notes editor only for reading lessons.
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { BookOpenText, FileText, PlaySquare } from '@lucide/svelte';
	import Switch from '#lib/components/ui/Switch.svelte';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import type { LessonDTO, LessonKind } from '#lib/features/courses/schema';
	import { withToast } from './submit';

	interface Props {
		lesson?: LessonDTO | null;
		action: string;
		submitLabel: string;
		chapterId?: string;
		compact?: boolean;
		/** Called after a successful save (e.g. reset the add form). */
		onsaved?: () => void;
		/** Extra fields (e.g. a chapter picker), shown above the preview switch. */
		fields?: Snippet;
		/** Buttons next to submit. */
		children?: Snippet;
	}
	let { lesson = null, action, submitLabel, chapterId, compact = false, onsaved, fields, children }: Props = $props();

	// svelte-ignore state_referenced_locally
	const l = lesson;
	let kind = $state<LessonKind>(l?.kind ?? 'video');
	let title = $state(l?.title ?? '');
	let youtube = $state(l?.youtubeId ? `https://youtu.be/${l.youtubeId}` : '');
	let minutes = $state(l?.durationSec ? String(Math.round(l.durationSec / 60)) : '');
	let body = $state(l?.body ?? '');
	let file = $state(l?.fileId ? { id: l.fileId, name: 'Lesson PDF', url: `/api/files/${l.fileId}` } : null);
	let preview = $state(l?.isPreview ?? false);
	let busy = $state(false);
	let lookingUp = $state(false);
	const uid = $props.id();

	// The server parses the link (keeps zod out of the client bundle) and fetches the title.
	let videoId = $state<string | null>(l?.youtubeId ?? null);
	let invalid = $state(false);
	$effect(() => {
		const url = youtube.trim();
		if (!url) {
			videoId = null;
			invalid = false;
			return;
		}
		lookingUp = true;
		const t = setTimeout(async () => {
			try {
				const r = await fetch(`/admin/courses/youtube?url=${encodeURIComponent(url)}`);
				const info = r.ok ? ((await r.json()) as { id: string; title: string }) : null;
				videoId = info?.id ?? null;
				invalid = !info;
				if (info?.title && !title.trim()) title = info.title;
			} finally {
				lookingUp = false;
			}
		}, 300);
		return () => {
			clearTimeout(t);
			lookingUp = false;
		};
	});

	const kinds: { value: LessonKind; label: string; icon: typeof PlaySquare }[] = [
		{ value: 'video', label: 'Video', icon: PlaySquare },
		{ value: 'reading', label: 'Reading', icon: BookOpenText },
		{ value: 'pdf', label: 'PDF', icon: FileText }
	];
	function reset() {
		if (l) return;
		title = youtube = minutes = body = '';
		file = null;
		preview = false;
	}
</script>

<form
	method="POST"
	{action}
	class="stack"
	use:enhance={withToast('Lesson saved', () => {
			reset();
			onsaved?.();
		}, (b) => (busy = b))}
>
	{#if chapterId}<input type="hidden" name="chapterId" value={chapterId} />{/if}
	<div class="segmented" role="radiogroup" aria-label="Lesson type">
		{#each kinds as k (k.value)}
			<label><input type="radio" name="kind" value={k.value} bind:group={kind} /><k.icon aria-hidden="true" class="size-4" />{k.label}</label>
		{/each}
	</div>

	{#if kind === 'video'}
		<div class="field">
			<label class="label" for="{uid}-yt">YouTube link</label>
			<input id="{uid}-yt" class="input" name="youtube" bind:value={youtube} inputmode="url" autocomplete="off" placeholder="https://youtu.be/… or any YouTube link" required />
			{#if invalid && !lookingUp}<p class="error" role="alert">That is not a YouTube link.</p>{/if}
		</div>
		{#if videoId}
			<div class="yt">
				<img src="https://i.ytimg.com/vi/{videoId}/mqdefault.jpg" alt="" width="160" height="90" />
				<div class="min-w-0 text-sm">
					<p class="font-mono text-muted-foreground">{videoId}</p>
					<p class="line-clamp-2 font-semibold">{lookingUp ? 'Getting the title…' : title || 'No title found. Type one below.'}</p>
				</div>
			</div>
		{/if}
	{/if}

	<div class="form-row">
		<div class="field">
			<label class="label" for="{uid}-title">Title{#if kind === 'video'} <span class="opt">(from YouTube if empty)</span>{/if}</label>
			<input id="{uid}-title" class="input" name="title" bind:value={title} maxlength="200" required={kind !== 'video'} />
		</div>
		<div class="field">
			<label class="label" for="{uid}-min">Minutes <span class="opt">(optional)</span></label>
			<input id="{uid}-min" class="input font-mono tabular" name="durationMin" bind:value={minutes} type="number" min="0" max="1440" step="1" inputmode="numeric" />
		</div>
	</div>

	{#if kind === 'pdf'}
		<div class="field">
			<FileUpload accept="pdf" bind:value={file} name="fileId" label="PDF" />
		</div>
	{/if}

	{#if kind === 'reading' || !compact}
		<div class="field">
			<span class="label">{kind === 'reading' ? 'Lesson text' : 'Notes under the lesson'} {#if kind !== 'reading'}<span class="opt">(optional)</span>{/if}</span>
			<MarkdownEditor bind:value={body} name="body" rows={compact ? 6 : 12} />
		</div>
	{:else}
		<input type="hidden" name="body" value={body} />
	{/if}

	{@render fields?.()}
	<Switch bind:checked={preview} name="isPreview" label="Free preview" description="Anyone can open this lesson, even on a paid course." />

	<div class="flex flex-wrap items-center gap-2">
		<button class="btn btn-primary" disabled={busy || (kind === 'video' && (!videoId || lookingUp))}>{busy ? 'Saving…' : submitLabel}</button>
		{@render children?.()}
	</div>
</form>

<style>
	.yt {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-md);
		background: hsl(var(--muted) / 0.5);
	}
	.yt img {
		flex: none;
		width: 7.5rem;
		height: auto;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}
</style>
