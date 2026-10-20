<script lang="ts">
	import AppShell from '#lib/components/shell/AppShell.svelte';
	import { studentGroups, studentTabs } from '#lib/components/shell/nav';

	let { data, children } = $props();
</script>

<AppShell
	groups={studentGroups}
	tabs={studentTabs}
	user={data.user}
	unread={data.unread}
	inboxHref="/app/inbox"
	fullScreen={/^\/app\/tests\/[^/]+\/attempt\/|^\/onboarding(\/|$)/}
>
	{@render children()}
</AppShell>
