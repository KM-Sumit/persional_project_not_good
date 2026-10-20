<script lang="ts">
	import AppShell from '#lib/components/shell/AppShell.svelte';
	import { staffGroups, staffTabs } from '#lib/components/shell/nav';

	let { data, children } = $props();
</script>

<AppShell groups={staffGroups} tabs={staffTabs} more user={data.user} area="Staff console">
	{@render children()}
</AppShell>
