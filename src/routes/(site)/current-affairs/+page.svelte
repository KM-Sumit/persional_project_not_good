<script lang="ts">
	import { Newspaper } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PublicList from '#lib/features/posts/components/PublicList.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
</script>

<Seo
	title="Daily current affairs"
	description="Daily current affairs for SSC, Railway, MPPSC and MP Police exams: short exam-focused summaries with a free 10-question quiz every day."
	crumbs={[...crumbs, { href: '/current-affairs', label: 'Current affairs' }]}
/>

<div class="page-narrow site-page">
	<PageHeader title="Current affairs" subtitle="Exam-focused summaries every day. Sign in to take the daily quiz." {crumbs}>
		{#snippet actions()}<a href="/login?next=/app/daily" class="btn btn-primary">Take today's quiz</a>{/snippet}
	</PageHeader>
	<PublicList items={data.items} base="/current-affairs" emptyIcon={Newspaper} emptyTitle="No current affairs yet" emptyBody="The first daily summary goes up soon." />
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
		padding-bottom: 3rem;
	}
</style>
