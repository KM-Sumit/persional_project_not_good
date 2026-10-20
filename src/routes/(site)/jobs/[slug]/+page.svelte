<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PublicPost from '#lib/features/posts/components/PublicPost.svelte';

	let { data } = $props();
	const p = $derived(data.post);
	const crumbs = [
		{ href: '/', label: 'Home' },
		{ href: '/jobs', label: 'Job alerts' }
	];
	const ld = $derived({ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.publishedOn, inLanguage: 'en-IN' });
</script>

<Seo title={p.title} description={p.excerpt || p.title} crumbs={[...crumbs, { href: `/jobs/${p.slug}`, label: p.title }]} jsonld={[ld]} />

<div class="page-narrow site-page">
	<PageHeader title={p.title} eyebrow="Job alert" {crumbs} />
	<PublicPost post={p}>
		{#snippet cta()}
			<div class="min-w-0">
				<p class="font-semibold">Start preparing today</p>
				<p class="text-sm text-muted-foreground">Free mock tests and daily current affairs for this exam.</p>
			</div>
			<a href="/login?next=/app/tests" class="btn btn-primary">Take a free mock</a>
		{/snippet}
	</PublicPost>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
		padding-bottom: 3rem;
	}
</style>
