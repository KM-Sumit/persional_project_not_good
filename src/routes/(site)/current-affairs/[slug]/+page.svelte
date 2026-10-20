<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PublicPost from '#lib/features/posts/components/PublicPost.svelte';

	let { data } = $props();
	const p = $derived(data.post);
	const crumbs = [
		{ href: '/', label: 'Home' },
		{ href: '/current-affairs', label: 'Current affairs' }
	];
	const ld = $derived({ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.publishedOn, inLanguage: 'en-IN' });
</script>

<Seo title={p.title} description={p.excerpt || p.title} crumbs={[...crumbs, { href: `/current-affairs/${p.slug}`, label: p.title }]} jsonld={[ld]} />

<div class="page-narrow site-page">
	<PageHeader title={p.title} eyebrow="Current affairs" {crumbs} />
	<PublicPost post={p}>
		{#snippet cta()}
			<div class="min-w-0">
				<p class="font-semibold">Test yourself on this</p>
				<p class="text-sm text-muted-foreground">A free 10-question quiz on today's news, with answers and your rank.</p>
			</div>
			<a href="/login?next=/app/daily" class="btn btn-primary">Take the quiz</a>
		{/snippet}
	</PublicPost>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
		padding-bottom: 3rem;
	}
</style>
