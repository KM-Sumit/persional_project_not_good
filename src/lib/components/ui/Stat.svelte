<script lang="ts">
	import type { Component } from 'svelte';

	// One number with a plain label. Put several inside <div class="stats"> (3 across) or "stats stats-4".
	let {
		label,
		value,
		hint,
		icon: Icon,
		tone
	}: {
		label: string;
		value: string | number;
		/** Small line under the label, e.g. "this week". */
		hint?: string;
		icon?: Component<{ class?: string }>;
		tone?: 'success' | 'warning' | 'danger' | 'primary';
	} = $props();
</script>

<div class="stat">
	{#if Icon}<Icon class="stat-icon" />{/if}
	<div class="stat-value" style:color={tone ? `hsl(var(--${tone}))` : undefined}>{value}</div>
	<div class="stat-label">{label}</div>
	{#if hint}<div class="stat-hint">{hint}</div>{/if}
</div>
