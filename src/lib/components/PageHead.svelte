<script lang="ts">
	let { title, lede }: { title: string; lede?: string } = $props();
</script>

<header>
	<h1 class="page-title">{title}</h1>
	{#if lede}
		<p class="text-muted">{lede}</p>
	{/if}
</header>

<style>
	header {
		display: grid;
		gap: 0.35rem;
		margin-bottom: 1.25rem;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
	}

	p {
		line-height: 1.45;
	}
</style>
