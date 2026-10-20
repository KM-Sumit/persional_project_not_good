<script lang="ts">
	// "Ask a doubt" button + sheet. Usable from any screen: posts to the /app/doubts `ask` action, so a lesson or
	// question screen only passes its id. Optional photo (JPEG/PNG/WebP, 5 MB) goes up with the same request.
	import { enhance } from '$app/forms';
	import { ImagePlus, MessageCircleQuestion, X } from '@lucide/svelte';
	import { Sheet, toast } from '#lib/components/ui';

	interface Props {
		lessonId?: string;
		questionId?: string;
		label?: string;
		/** Button look; defaults to a secondary button. */
		variant?: 'primary' | 'secondary' | 'ghost';
	}
	let { lessonId, questionId, label = 'Ask a doubt', variant = 'secondary' }: Props = $props();

	const MAX = 5 * 1024 * 1024;
	const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const uid = $props.id();
	let open = $state(false);
	let busy = $state(false);
	let text = $state('');
	let preview = $state<string | null>(null);
	let photoError = $state('');
	let fileInput = $state<HTMLInputElement>();

	function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		photoError = '';
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		if (!f) return;
		if (!TYPES.includes(f.type)) photoError = 'Use a JPEG, PNG or WebP photo.';
		else if (f.size > MAX) photoError = 'That photo is too large (max 5 MB).';
		if (photoError) return void (fileInput!.value = '');
		preview = URL.createObjectURL(f);
	}
	function clearPhoto() {
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		photoError = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<button type="button" class="btn btn-{variant}" onclick={() => (open = true)}><MessageCircleQuestion />{label}</button>

<Sheet bind:open title="Ask a doubt" description="A teacher answers here, usually within a day.">
	<form
		id="{uid}-form"
		method="POST"
		action="/app/doubts?/ask"
		enctype="multipart/form-data"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'success') {
					toast('Doubt sent. We will answer soon.');
					text = '';
					clearPhoto();
					open = false;
					await update();
				} else if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not send. Try again.'), 'error');
				else if (result.type === 'error') toast(result.error?.message ?? 'Could not send. Try again.', 'error');
				else await update();
			};
		}}
	>
		{#if lessonId}<input type="hidden" name="lessonId" value={lessonId} />{/if}
		{#if questionId}<input type="hidden" name="questionId" value={questionId} />{/if}
		<label class="field">
			<span class="label">Your doubt</span>
			<textarea name="body" rows="5" maxlength="2000" required minlength="5" bind:value={text} placeholder="What is not clear? Add the step where you got stuck."></textarea>
		</label>
		<div class="field">
			<span class="label">Photo <span class="opt">optional</span></span>
			{#if preview}
				<div class="ask-photo">
					<img src={preview} alt="Selected" />
					<button type="button" class="icon-btn" aria-label="Remove photo" onclick={clearPhoto}><X /></button>
				</div>
			{:else}
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => fileInput?.click()}><ImagePlus />Add a photo of your work</button>
			{/if}
			<input bind:this={fileInput} type="file" name="photo" accept={TYPES.join(',')} class="sr-only" tabindex="-1" aria-hidden="true" onchange={pick} />
			{#if photoError}<p class="error" role="alert">{photoError}</p>{/if}
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-secondary" onclick={() => (open = false)}>Cancel</button>
		<button type="submit" form="{uid}-form" class="btn btn-primary" disabled={busy || text.trim().length < 5}>{busy ? 'Sending…' : 'Send doubt'}</button>
	{/snippet}
</Sheet>

<style>
	.ask-photo {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.ask-photo img {
		max-height: 160px;
		max-width: 100%;
		border-radius: 12px;
		border: 1px solid hsl(var(--border));
		object-fit: contain;
		background: hsl(var(--muted));
	}
</style>
