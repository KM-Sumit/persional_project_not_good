<script lang="ts">
	import { ArrowRight, BookOpen } from '@lucide/svelte';
	import OfferPanel from '#lib/features/billing/components/OfferPanel.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Outline from '#lib/features/courses/components/Outline.svelte';
	import { duration } from '#lib/features/courses/components/format';

	let { data } = $props();
	const c = $derived(data.course);
	const first = $derived(c.chapters.flatMap((ch) => ch.lessons)[0] ?? null);
	const target = $derived(data.resume ?? first);
	const locked = $derived(data.paywall.locked);
	const demo = $derived(c.chapters.flatMap((ch) => ch.lessons).find((l) => l.isPreview) ?? null);
	const offer = $derived(data.paywall.offer);
	const label = $derived(data.progress.completed === 0 ? 'Start course' : data.resume ? 'Continue' : 'Watch again');
</script>

<svelte:head><title>{c.title} · UCI</title></svelte:head>

<div class="page pb-28 lg:pb-10">
	<PageHeader title={c.title} eyebrow={data.examName ?? 'Course'} subtitle={c.summary || undefined} crumbs={[{ href: '/app/learn', label: 'Learn' }]} />

	<div class="course-grid">
		<div class="min-w-0 rise" style="--i: 1">
			{#if c.lessonCount}
				<Outline slug={c.slug} chapters={c.chapters} state={data.state} {locked} />
			{:else}
				<EmptyState icon={BookOpen} title="Lessons are on the way" body="Your teacher is recording this course. The first lessons will show up here." />
			{/if}
		</div>

		<aside class="side rise" style="--i: 2">
			{#if locked}
				<OfferPanel {offer} free={demo ? { href: `/app/learn/${c.slug}/${demo.id}`, label: 'Watch free demo', play: true } : null} />
			{:else}
			<div class="card card-pad stack">
				<div class="flex items-center gap-4">
					<div class="score-ring ring-sm" style="--pct: {data.progress.percent}" role="img" aria-label="{data.progress.percent}% complete">
						<div><div class="value">{data.progress.percent}<span class="pct">%</span></div></div>
					</div>
					<dl class="facts">
						<div><dt>Done</dt><dd class="font-mono tabular">{data.progress.completed}/{data.progress.total}</dd></div>
						{#if c.durationSec}<div><dt>Length</dt><dd>{duration(c.durationSec)}</dd></div>{/if}
						<div><dt>Teacher</dt><dd>{c.instructor}</dd></div>
					</dl>
				</div>
				{#if target}
					<div class="actionbar inline-desktop">
						<div class="actionbar-inner">
							<a class="btn btn-primary btn-lg" href="/app/learn/{c.slug}/{target.id}">
								<span class="truncate">{label}{data.resume && data.progress.completed ? `: ${target.title}` : ''}</span><ArrowRight />
							</a>
						</div>
					</div>
				{/if}
			</div>
			{/if}
		</aside>
	</div>
</div>

<style>
	.course-grid {
		display: grid;
		gap: 1.25rem;
	}
	.side {
		order: -1;
	}
	@media (min-width: 1024px) {
		.course-grid {
			grid-template-columns: minmax(0, 1fr) 20rem;
			align-items: start;
		}
		.side {
			order: 0;
			position: sticky;
			top: calc(var(--appbar-h) + 1rem);
		}
		.side .btn {
			width: 100%;
		}
	}
	.ring-sm {
		width: 84px;
		height: 84px;
		flex-shrink: 0;
		--tone: var(--sun);
		background:
			radial-gradient(closest-side, hsl(var(--surface)) calc(100% - 8px), transparent calc(100% - 7px)),
			conic-gradient(hsl(var(--tone)) calc(var(--pct) * 1%), hsl(var(--muted)) 0);
	}
	.ring-sm .value {
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 600;
	}
	.pct {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.facts {
		display: grid;
		gap: 0.375rem;
		min-width: 0;
	}
	.facts div {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.facts dt {
		color: hsl(var(--muted-foreground));
		width: 4.25rem;
		flex-shrink: 0;
	}
	.facts dd {
		font-weight: 600;
		min-width: 0;
		overflow-wrap: anywhere;
	}
</style>
