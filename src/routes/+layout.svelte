<script lang="ts">
	import '../app.css';
	import { Toaster } from '#lib/components/ui';
	import UpdatePrompt from '#lib/components/pwa/UpdatePrompt.svelte';
	import OfflineBanner from '#lib/components/pwa/OfflineBanner.svelte';

	let { children } = $props();
</script>

{@render children()}

<Toaster />
<UpdatePrompt />
<OfflineBanner />
