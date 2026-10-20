<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	interface Props {
		open: boolean;
		title: string;
		/** One plain sentence under the title. */
		description?: string;
		footer?: Snippet;
		children: Snippet;
	}

	let { open = $bindable(false), title, description, footer, children }: Props = $props();
	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<!-- Bottom sheet on phones, centered dialog on desktop. Esc and backdrop click close it. -->
<dialog
	bind:this={dialog}
	class="sheet"
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	aria-label={title}
>
	<div class="sheet-grip"></div>
	<div class="sheet-head">
		<div class="min-w-0">
			<h2>{title}</h2>
			{#if description}<p class="sheet-desc">{description}</p>{/if}
		</div>
		<button type="button" class="icon-btn icon-btn-sm" onclick={() => (open = false)} aria-label="Close"><X /></button>
	</div>
	<div class="sheet-body">{@render children()}</div>
	{#if footer}<div class="sheet-foot">{@render footer()}</div>{/if}
</dialog>
