<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';

	// "Are you sure?" dialog, centred on every screen. Two ways to use it:
	//  - onconfirm: called when the confirm button is pressed, then the dialog closes.
	//  - action (+ fields): the confirm button POSTs a form to that SvelteKit action (progressively enhanced).
	let {
		open = $bindable(false),
		title,
		body,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		tone = 'primary',
		action,
		fields = {},
		onconfirm,
		children
	}: {
		open?: boolean;
		title: string;
		body?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'primary' | 'danger';
		action?: string;
		fields?: Record<string, string>;
		onconfirm?: () => void | Promise<void>;
		/** Extra content between the text and the buttons. */
		children?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let busy = $state(false);
	const uid = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	async function confirm() {
		busy = true;
		try {
			await onconfirm?.();
			open = false;
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="dialog"
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	aria-labelledby="{uid}-title"
>
	<h2 id="{uid}-title" class="dialog-title">{title}</h2>
	{#if body}<p class="dialog-body">{body}</p>{/if}
	{@render children?.()}
	{#if action}
		<form
			method="POST"
			{action}
			class="dialog-actions"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
					open = false;
				};
			}}
		>
			{#each Object.entries(fields) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			<button type="button" class="btn btn-secondary" onclick={() => (open = false)}>{cancelLabel}</button>
			<button class="btn btn-{tone}" disabled={busy} aria-busy={busy || undefined}>{confirmLabel}</button>
		</form>
	{:else}
		<div class="dialog-actions">
			<button type="button" class="btn btn-secondary" onclick={() => (open = false)}>{cancelLabel}</button>
			<button type="button" class="btn btn-{tone}" disabled={busy} aria-busy={busy || undefined} onclick={confirm}>{confirmLabel}</button>
		</div>
	{/if}
</dialog>
