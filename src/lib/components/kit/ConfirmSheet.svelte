<script lang="ts">
	// "Are you sure?" sheet (port of easy-business ConfirmSheet). With `typed`, the confirm button stays
	// disabled until that word is typed (case-insensitive). onconfirm resolves -> close; throws -> stays open.
	import Sheet from '../ui/Sheet.svelte';

	interface Props {
		open: boolean;
		title: string;
		body?: string;
		confirmLabel: string;
		danger?: boolean;
		/** Word the user must type, e.g. "DELETE" or the test name. */
		typed?: string;
		onconfirm: () => void | Promise<void>;
	}
	let { open = $bindable(false), title, body, confirmLabel, danger = false, typed, onconfirm }: Props = $props();

	let text = $state('');
	let busy = $state(false);
	const uid = $props.id();
	const ok = $derived(!busy && (!typed || text.trim().toLowerCase() === typed.trim().toLowerCase()));

	$effect(() => {
		if (open) text = '';
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!ok) return;
		busy = true;
		try {
			await onconfirm();
			open = false;
		} catch {
			/* the caller shows the error toast; keep the sheet open */
		} finally {
			busy = false;
		}
	}
</script>

<Sheet bind:open {title}>
	<form id="{uid}-form" class="stack" onsubmit={submit}>
		{#if body}<p class="muted">{body}</p>{/if}
		{#if typed}
			<div class="field">
				<label class="label" for="{uid}-typed">Type <strong class="select-all">{typed}</strong> to confirm</label>
				<input id="{uid}-typed" class="input" bind:value={text} autocomplete="off" autocapitalize="off" spellcheck="false" />
			</div>
		{/if}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-secondary" onclick={() => (open = false)}>Cancel</button>
		<button
			type="submit"
			form="{uid}-form"
			class="btn {danger ? 'btn-danger' : 'btn-primary'}"
			class:is-loading={busy}
			disabled={!ok}
			aria-busy={busy || undefined}
		>
			{busy ? 'Working…' : confirmLabel}
		</button>
	{/snippet}
</Sheet>
