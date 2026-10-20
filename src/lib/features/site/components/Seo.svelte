<script lang="ts">
	// Per-page SEO: title, description, canonical, OpenGraph/Twitter, optional JSON-LD and breadcrumbs.
	import { page } from '$app/state';

	interface Props {
		title: string;
		description: string;
		/** Ancestors + this page, root first; emitted as a schema.org BreadcrumbList. */
		crumbs?: { href: string; label: string }[];
		jsonld?: Record<string, unknown>[];
		noindex?: boolean;
		image?: string;
	}
	let { title, description, crumbs, jsonld = [], noindex = false, image = '/media/intro-poster.jpg' }: Props = $props();

	const origin = $derived(page.url.origin);
	const canonical = $derived(origin + page.url.pathname);
	const full = $derived(title.includes('UCI') ? title : `${title} · UCI`);
	const blocks = $derived([
		...jsonld,
		...(crumbs?.length
			? [
					{
						'@context': 'https://schema.org',
						'@type': 'BreadcrumbList',
						itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: origin + c.href }))
					}
				]
			: [])
	]);
	// JSON inside <script>: escape "<" so a title can never close the tag.
	const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</` + `script>`;
</script>

<svelte:head>
	<title>{full}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}<meta name="robots" content="noindex,follow" />{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="UCI" />
	<meta property="og:locale" content="en_IN" />
	<meta property="og:title" content={full} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={origin + image} />
	<meta name="twitter:card" content="summary_large_image" />
	{#if blocks.length}{@html blocks.map(ld).join('')}{/if}
</svelte:head>
