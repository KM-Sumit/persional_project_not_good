<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		/** id of the control inside, for the <label for>. */
		for?: string;
		optional?: boolean;
		help?: string;
		error?: string | null;
		children: Snippet;
	}

	let { label, for: htmlFor, optional = false, help, error, children }: Props = $props();
</script>

<!-- Wrap a native <input>/<select>/<textarea>; .field styles them. -->
<div class="field" class:has-error={!!error}>
	<label class="label" for={htmlFor}>{label}{#if optional}<span class="opt"> (optional)</span>{/if}</label>
	{@render children()}
	{#if error}<p class="error" role="alert">{error}</p>{:else if help}<p class="help">{help}</p>{/if}
</div>
