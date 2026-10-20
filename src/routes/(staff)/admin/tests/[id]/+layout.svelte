<script lang="ts">
	import { page } from '$app/state';
	import { Badge, PageHeader, Tabs } from '#lib/components/ui';
	import { accessLabel, kindLabel, statusTone } from '#lib/features/bank/components/format';

	let { data, children } = $props();
	const t = $derived(data.test);
	const base = $derived(`/admin/tests/${t.id}`);
	const tabs = $derived([
		{ value: base, label: 'Overview', href: base },
		{ value: `${base}/questions`, label: 'Questions', href: `${base}/questions`, count: t.questionCount },
		{ value: `${base}/results`, label: 'Results', href: `${base}/results`, count: t.attemptCount },
		{ value: `${base}/access`, label: 'Access', href: `${base}/access` }
	]);
	const status = $derived(t.status === 'published' && t.kind === 'live' && t.window === 'live' ? 'Live now' : t.status[0].toUpperCase() + t.status.slice(1));
</script>

<div class="page">
	<PageHeader title={t.title} eyebrow="{kindLabel[t.kind]} · {accessLabel[t.access]}" crumbs={[{ href: '/admin/tests', label: 'Tests' }]}>
		{#snippet actions()}
			<Badge tone={status === 'Live now' ? 'live' : statusTone[t.status]}>{status}</Badge>
		{/snippet}
	</PageHeader>
	<div class="mb-5"><Tabs label="Test sections" value={page.url.pathname} items={tabs} /></div>
	{@render children()}
</div>
