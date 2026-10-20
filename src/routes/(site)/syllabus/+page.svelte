<script lang="ts">
	import { ChevronRight, ScrollText } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Seo from '#lib/features/site/components/Seo.svelte';

	let { data } = $props();
	const crumbs = [{ href: '/', label: 'Home' }];
</script>

<Seo
	title="Exam syllabus"
	description="Latest syllabus and exam pattern for SSC, Railway, MPPSC and MP Police exams."
	crumbs={[...crumbs, { href: '/syllabus', label: 'Syllabus' }]}
/>

<div class="page-narrow site-page">
	<PageHeader title="Syllabus" subtitle="Latest syllabus and exam pattern, exam by exam." {crumbs} />
	{#if data.exams.length}
		<ul class="list rise">
			{#each data.exams as e (e.slug)}
				<li>
					<a class="list-row" href="/syllabus/{e.slug}">
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{e.name}</span>
							<span class="block truncate text-sm text-muted-foreground">{e.title}</span>
						</span>
						<ChevronRight class="size-4 flex-none text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState icon={ScrollText} title="No syllabus pages yet" body="Syllabus pages for each exam are being added." />
	{/if}
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
		padding-bottom: 3rem;
	}
</style>
