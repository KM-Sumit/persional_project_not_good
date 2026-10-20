<script lang="ts">
	interface Props {
		href?: string;
		/** App bar: logo + short name only. */
		compact?: boolean;
		/** Small label under the name, e.g. "Staff". */
		area?: string;
	}
	let { href = '/', compact = false, area }: Props = $props();
</script>

<a {href} class="brand" aria-label="UCI home">
	<img src="/brand/uci.png" alt="" class="brand-mark" width="32" height="32" />
	<span class="brand-name">
		<span>UCI</span>
		{#if !compact}<small>{area ?? 'Upendra Competition Institute'}</small>{/if}
	</span>
</a>
