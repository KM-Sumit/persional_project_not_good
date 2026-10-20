<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import PublicPost from '#lib/features/posts/components/PublicPost.svelte';

	let { data } = $props();
	const p = $derived(data.post);
	const crumbs = [
		{ href: '/', label: 'Home' },
		{ href: '/syllabus', label: 'Syllabus' }
	];
</script>

<Seo
	title="{p.examName} syllabus and exam pattern"
	description={p.excerpt || `Latest ${p.examName} syllabus and exam pattern.`}
	crumbs={[...crumbs, { href: `/syllabus/${p.examSlug}`, label: p.examName ?? 'Syllabus' }]}
/>

<div class="page-narrow site-page">
	<PageHeader title="{p.examName} syllabus" eyebrow="Updated {p.publishedOn.split('-').reverse().join('/')}" {crumbs} />
	<PublicPost post={p}>
		{#snippet cta()}
			<div class="min-w-0">
				<p class="font-semibold">Practise this syllabus</p>
				<p class="text-sm text-muted-foreground">Topic-wise free mock tests with solutions.</p>
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
