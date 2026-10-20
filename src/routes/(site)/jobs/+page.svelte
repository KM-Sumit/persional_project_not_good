<script lang="ts">
	import { BriefcaseBusiness } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PublicList from '#lib/features/posts/components/PublicList.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
</script>

<Seo
	title="Latest government job alerts"
	description="New vacancies for SSC, Railway, MPPSC and MP Police: posts, eligibility, last dates and how to apply."
	crumbs={[...crumbs, { href: '/jobs', label: 'Job alerts' }]}
/>

<div class="page-narrow site-page">
	<PageHeader title="Job alerts" subtitle="New vacancies, last dates and how to apply." {crumbs} />
	<PublicList items={data.items} base="/jobs" emptyIcon={BriefcaseBusiness} emptyTitle="No job alerts yet" emptyBody="New vacancies are posted here as soon as they are notified." />
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
		padding-bottom: 3rem;
	}
</style>
