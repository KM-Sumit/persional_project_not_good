<script lang="ts">
	import { page } from '$app/state';
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import SectionHead from '#lib/features/site/components/SectionHead.svelte';
	import { orgJsonLd } from '#lib/features/site/components/format';

	let { data } = $props();
	const st = $derived(data.site.settings);
	const crumbs = [{ href: '/', label: 'Home' }];
	const words = [
		{ k: 'Dream', body: 'A government job changes a family. We take that goal seriously from the first enquiry.' },
		{ k: 'Prepare', body: 'Classes in Hindi medium, chapter-wise video lessons, revision notes and tests that follow the real exam pattern.' },
		{ k: 'Achieve', body: 'Live mock tests on a shared clock with ranks and question-wise analysis, so exam day feels familiar.' }
	];
</script>

<Seo
	title="About UCI"
	description="Upendra Competition Institute (UCI) is a coaching institute in Madhya Pradesh preparing students for SSC, Railway, MPPSC and MP Police exams."
	crumbs={[...crumbs, { href: '/about', label: 'About' }]}
	jsonld={[orgJsonLd(st, page.url.origin)]}
/>

<div class="page site-page">
	<PageHeader title="About UCI" subtitle="Upendra Competition Institute, Madhya Pradesh." {crumbs} />

	<div class="intro">
		<img src="/brand/uci.png" alt="UCI logo" width="120" height="120" />
		<div class="min-w-0">
			<p class="lead">
				UCI prepares students for government exams: SSC, Railway, MPPSC and MP Police. Students study in our classroom batches and
				continue in the UCI app, where the same teachers' courses, notes and mock tests are available on the phone.
			</p>
			<p class="motto">Dream. Prepare. Achieve.</p>
		</div>
	</div>

	{#if st.stats?.length}
		<dl class="stats-row">
			{#each st.stats as s (s.label)}
				<div><dd class="font-mono tabular">{s.value}</dd><dt>{s.label}</dt></div>
			{/each}
		</dl>
	{/if}

	<section class="sec" aria-labelledby="motto-h">
		<SectionHead id="motto-h" title="What the motto means in practice" />
		<div class="words">
			{#each words as w, i (w.k)}
				<article class="card card-pad rise" style="--i: {i}">
					<h3>{w.k}</h3>
					<p>{w.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<div class="links">
		<a href="/faculty" class="btn btn-secondary">Meet the faculty</a>
		<a href="/results" class="btn btn-secondary">See results</a>
		<a href="/contact" class="btn btn-primary">Visit or enquire</a>
	</div>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.intro {
		display: flex;
		gap: 1.5rem;
		align-items: flex-start;
		max-width: 52rem;
	}
	.intro img {
		flex-shrink: 0;
		width: clamp(72px, 10vw, 120px);
		height: auto;
		border-radius: 999px;
		background: #fff;
	}
	.lead {
		font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
		line-height: 1.65;
	}
	.motto {
		margin-top: 1rem;
		font-family: var(--font-display);
		font-stretch: 80%;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: hsl(var(--primary));
	}
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem 3rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid hsl(var(--border));
	}
	.stats-row dd {
		font-size: 2rem;
		font-weight: 600;
	}
	.stats-row dt {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.sec {
		margin-top: 3rem;
	}
	.words {
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 768px) {
		.words {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.words h3 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: 1.5rem;
	}
	.words p {
		margin-top: 0.375rem;
		color: hsl(var(--muted-foreground));
		line-height: 1.6;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 2.5rem;
	}
</style>
