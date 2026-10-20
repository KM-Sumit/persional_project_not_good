<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import { renderMarkdown } from '$lib/features/catalog/markdown';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const html = $derived(renderMarkdown(data.body));
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<article class="note">
	<Trail
		items={[
			{ label: 'Study', href: '/study' },
			{ label: 'Notes', href: '/study?tab=notes' },
			{ label: data.title }
		]}
	/>

	<header>
		<p class="kicker">{data.subject}</p>
		<h1 class="page-title">{data.title}</h1>
		{#if data.description}
			<p class="lead">{data.description}</p>
		{/if}
		{#if data.total > 1}
			<p class="meta">Sheet {data.index + 1} of {data.total}</p>
		{/if}
	</header>

	<div class="md">{@html html}</div>

	{#if data.previous || data.next}
		<nav class="list-plain" aria-label="Other notes">
			{#if data.previous}
				<a class="row" href="/notes/{data.previous.id}" data-back>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="meta">Previous</span>
						<span class="link-title">{data.previous.title}</span>
					</span>
				</a>
			{/if}
			{#if data.next}
				<a class="row" href="/notes/{data.next.id}">
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="meta">Next</span>
						<span class="link-title">{data.next.title}</span>
					</span>
				</a>
			{/if}
		</nav>
	{/if}
</article>

<style>
	.note {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}
	.lead {
		max-width: 62ch;
		margin: 0.45rem 0 0;
		font-size: 1rem;
		line-height: 1.5;
	}
	.link-title {
		font-size: 0.975rem;
		font-weight: 700;
		line-height: 1.35;
		color: hsl(var(--foreground));
	}
</style>
