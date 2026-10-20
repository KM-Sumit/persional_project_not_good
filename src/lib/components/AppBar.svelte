<script lang="ts">
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Brand from '$lib/components/Brand.svelte';
</script>

<header class="appbar">
	<div class="appbar-inner">
		<div class="appbar-lead">
			<Brand href="/home" compact />
		</div>
		<ThemeToggle />
	</div>
</header>
