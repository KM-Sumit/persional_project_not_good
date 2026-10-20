<script lang="ts">
	import { BookOpen, Check, FileText, Lock, PlayCircle } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import YouTubePlayer from '#lib/components/kit/YouTubePlayer.svelte';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import SectionHead from '#lib/features/site/components/SectionHead.svelte';
	import { hours, inr, plural } from '#lib/features/site/components/format';
	import type { LessonDTO } from '#lib/features/courses/schema';

	let { data } = $props();
	const c = $derived(data.course);
	const crumbs = [
		{ href: '/', label: 'Home' },
		{ href: '/courses', label: 'Courses' }
	];
	const lessons = $derived(c.chapters.flatMap((ch) => ch.lessons));
	const previews = $derived(lessons.filter((l) => l.isPreview && l.youtubeId));
	let picked = $state<LessonDTO | null>(null);
	const playing = $derived(picked ?? previews[0] ?? null);
	const byKind = $derived({
		video: lessons.filter((l) => l.kind === 'video').length,
		reading: lessons.filter((l) => l.kind === 'reading').length,
		pdf: lessons.filter((l) => l.kind === 'pdf').length
	});
	const p = $derived(data.product);
	const cta = $derived(p ? { href: `/login?next=/app/checkout/${p.id}`, label: `Enrol for ${inr(p.priceInr)}` } : { href: `/login?next=/app/learn/${c.slug}`, label: 'Start learning free' });
	const icon = { video: PlayCircle, reading: BookOpen, pdf: FileText };
	const courseLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'Course',
		name: c.title,
		description: c.summary || c.title,
		inLanguage: 'hi-IN',
		provider: { '@type': 'EducationalOrganization', name: 'Upendra Competition Institute' },
		...(p ? { offers: { '@type': 'Offer', price: p.priceInr, priceCurrency: 'INR', category: 'Paid' } } : { isAccessibleForFree: true })
	});
</script>

<Seo
	title={c.title}
	description={c.summary || `${c.title}: ${plural(c.lessonCount, 'lesson')} by ${c.instructor} at UCI.`}
	crumbs={[...crumbs, { href: `/courses/${c.slug}`, label: c.title }]}
	jsonld={[courseLd]}
/>

<div class="page site-page">
	<PageHeader title={c.title} eyebrow={data.exam?.name} subtitle={c.summary} {crumbs} />

	<div class="layout">
		<div class="main">
			{#if playing?.youtubeId}
				<div class="player">
					{#key playing.id}<YouTubePlayer videoId={playing.youtubeId} />{/key}
					<p class="small muted mt-2">Free preview: <span class="font-semibold text-foreground">{playing.title}</span></p>
				</div>
			{/if}

			{#if data.descriptionHtml}
				<section aria-labelledby="about-h">
					<SectionHead id="about-h" title="About this course" />
					<Markdown html={data.descriptionHtml} />
				</section>
			{/if}

			<section aria-labelledby="outline-h">
				<SectionHead id="outline-h" title="Course outline" />
				{#if c.chapters.length}
					<div class="syllabus">
						{#each c.chapters as ch, i (ch.id)}
							<details open={i === 0}>
								<summary>
									<span class="ch-n font-mono tabular">{String(i + 1).padStart(2, '0')}</span>
									<span class="ch-title">{ch.title}</span>
									<span class="ch-meta font-mono tabular">{plural(ch.lessons.length, 'lesson')}</span>
								</summary>
								<ul>
									{#each ch.lessons as l (l.id)}
										{@const Icon = icon[l.kind]}
										<li>
											{#if l.isPreview && l.youtubeId}
												<button type="button" class="lesson is-preview" aria-current={playing?.id === l.id ? 'true' : undefined} onclick={() => (picked = l)}>
													<Icon /><span class="l-title">{l.title}</span><span class="badge badge-primary">Free preview</span>
												</button>
											{:else}
												<div class="lesson">
													<Icon /><span class="l-title">{l.title}</span>
													{#if l.durationSec}<span class="l-dur font-mono tabular">{hours(l.durationSec)}</span>{/if}
													{#if p && !l.isPreview}<Lock class="l-lock" aria-label="Enrol to watch" />{/if}
												</div>
											{/if}
										</li>
									{/each}
								</ul>
							</details>
						{/each}
					</div>
				{:else}
					<div class="empty empty-compact"><h3>Lessons are being added</h3><p>The outline appears here as soon as the first chapter is published.</p></div>
				{/if}
			</section>
		</div>

		<aside class="aside">
			<div class="buy card">
				<p class="buy-price font-mono tabular">
					{#if p}{inr(p.priceInr)}{#if p.mrpInr && p.mrpInr > p.priceInr}<s>{inr(p.mrpInr)}</s>{/if}{:else}Free{/if}
				</p>
				<a href={cta.href} class="btn btn-primary btn-lg btn-block">{cta.label}</a>
				<ul class="incl">
					{#if byKind.video}<li><Check />{plural(byKind.video, 'video lesson')}{#if c.durationSec} · {hours(c.durationSec)}{/if}</li>{/if}
					{#if byKind.reading}<li><Check />{plural(byKind.reading, 'reading lesson')}</li>{/if}
					{#if byKind.pdf}<li><Check />{plural(byKind.pdf, 'PDF')}</li>{/if}
					<li><Check />Progress saved, resume where you stopped</li>
					<li><Check />Hindi medium</li>
					{#if p?.validityDays}<li><Check />Access for {plural(p.validityDays, 'day')}</li>{/if}
				</ul>
				<div class="instructor">
					<span class="avatar" aria-hidden="true">{c.instructor[0]}</span>
					<div class="min-w-0"><p class="tiny muted">Instructor</p><p class="font-semibold">{c.instructor}</p></div>
				</div>
				{#if data.exam}<a href={data.exam.href} class="small exam-link">More for {data.exam.name}</a>{/if}
				{#if p}<p class="tiny muted">Paid via Razorpay. See the <a href="/legal/refunds" class="underline">refund policy</a>.</p>{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.layout {
		display: grid;
		gap: 2rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 21rem;
			align-items: start;
		}
		.aside {
			position: sticky;
			top: 80px;
		}
	}
	.main {
		display: grid;
		gap: 2.5rem;
		min-width: 0;
	}
	.syllabus {
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--surface));
		overflow: hidden;
	}
	details + details {
		border-top: 1px solid hsl(var(--border));
	}
	summary {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 56px;
		padding: 0.75rem 1rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.ch-n {
		color: hsl(var(--primary));
		font-weight: 600;
	}
	.ch-title {
		flex: 1;
		min-width: 0;
		font-weight: 700;
	}
	.ch-meta {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		white-space: nowrap;
	}
	details ul {
		padding: 0 0.5rem 0.5rem;
	}
	.lesson {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		text-align: left;
		font-size: 0.9375rem;
	}
	.lesson :global(svg) {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		color: hsl(var(--muted-foreground));
	}
	.lesson.is-preview :global(svg) {
		color: hsl(var(--primary));
	}
	.lesson.is-preview:hover,
	.lesson[aria-current='true'] {
		background: hsl(var(--accent));
	}
	.l-title {
		flex: 1;
		min-width: 0;
	}
	.l-dur {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.buy {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		border-top: 3px solid hsl(var(--sun));
	}
	.buy-price {
		font-size: 2rem;
		font-weight: 600;
		line-height: 1;
	}
	.buy-price s {
		font-size: 1rem;
		margin-left: 0.5rem;
		color: hsl(var(--muted-foreground));
	}
	.incl {
		display: grid;
		gap: 0.5rem;
		font-size: 0.9375rem;
	}
	.incl li {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.incl :global(svg) {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		margin-top: 2px;
		color: hsl(var(--success));
	}
	.instructor {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid hsl(var(--border));
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
		font-weight: 800;
	}
	.exam-link {
		color: hsl(var(--primary));
		font-weight: 600;
	}
</style>
