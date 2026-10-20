<script lang="ts">
	let {
		href = '/',
		compact = false,
		class: klass = ''
	}: {
		href?: string;
		compact?: boolean;
		class?: string;
	} = $props();
</script>

<a class={['brand', klass, { compact }]} {href} aria-label="Upendra Competition Institute">
	<img src="/brand/uci.png" alt="" width="40" height="40" />
	{#if !compact}
		<span class="brand-name">
			Upendra
			<span class="brand-sub">Competition Institute</span>
		</span>
	{/if}
</a>
