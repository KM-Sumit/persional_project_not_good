<script lang="ts">
	import AppShell from '#lib/components/shell/AppShell.svelte';
	import IntroSplash from '#lib/components/shell/IntroSplash.svelte';
	import { studentGroups, studentTabs } from '#lib/components/shell/nav';
	import PtAutoSubmit from '#lib/features/tests/components/PtAutoSubmit.svelte';

	let { data, children } = $props();
</script>

<IntroSplash />
<PtAutoSubmit attempt={data.pt} serverNow={data.serverNow} />

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
