<script lang="ts">
	// On/off row: label (+ one plain sentence) on the left, switch on the right; the whole row is tappable.
	// Submits like a checkbox: `name=on` when checked, nothing when off.
	let {
		checked = $bindable(false),
		label,
		description,
		name,
		value = 'on',
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		label: string;
		description?: string;
		name?: string;
		value?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	} = $props();
</script>

<label class="switch-row" class:is-disabled={disabled}>
	<span class="min-w-0">
		<span class="switch-label">{label}</span>
		{#if description}<span class="switch-desc">{description}</span>{/if}
	</span>
	<span class="switch">
		<input type="checkbox" role="switch" {name} {value} {disabled} bind:checked onchange={() => onchange?.(checked)} />
		<span></span>
	</span>
</label>
