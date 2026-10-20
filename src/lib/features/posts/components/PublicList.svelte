<script lang="ts">
	// Public list of dated posts (current affairs, job alerts): newest first, grouped by month.
	import type { Component } from 'svelte';
	import { ChevronRight, FileText } from '@lucide/svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { fmtDay } from '../format';

	type Item = { id: string; slug: string; title: string; excerpt: string; publishedOn: string; examName: string | null; fileId: string | null };
	interface Props {
		items: Item[];
		base: string;
		emptyIcon: Component<{ class?: string; strokeWidth?: number }>;
		emptyTitle: string;
		emptyBody: string;
	}
	let { items, base, emptyIcon, emptyTitle, emptyBody }: Props = $props();

	const groups = $derived.by(() => {
		const m = new Map<string, Item[]>();
		for (const i of items) {
			const k = fmtDay(i.publishedOn, { month: 'long', year: 'numeric' });
			m.set(k, [...(m.get(k) ?? []), i]);
		}
		return [...m];
	});
</script>

{#if items.length}
	{#each groups as [month, rows], gi (month)}
		<section class="rise" style="--i: {gi}">
			<h2 class="eyebrow month">{month}</h2>
			<ul class="list">
				{#each rows as r (r.id)}
					<li>
						<a class="list-row row" href="{base}/{r.slug}">
							<span class="date font-mono tabular" aria-hidden="true">
								<span class="d">{Number(r.publishedOn.slice(8))}</span><span class="m">{fmtDay(r.publishedOn, { month: 'short' })}</span>
							</span>
							<span class="min-w-0 flex-1">
								<span class="flex items-center gap-1.5 font-semibold">
									<span class="truncate">{r.title}</span>
									{#if r.fileId}<FileText class="size-4 flex-none text-muted-foreground" aria-label="Has PDF" />{/if}
								</span>
								<span class="excerpt">{r.examName ? `${r.examName} · ` : ''}{r.excerpt}</span>
							</span>
							<ChevronRight class="size-4 flex-none text-muted-foreground" aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{:else}
	<EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />
{/if}

<style>
	section + section {
		margin-top: 1.5rem;
	}
	.month {
		margin-bottom: 0.5rem;
	}
	.row {
		gap: 0.875rem;
	}
	.date {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.75rem;
		padding: 0.25rem 0;
		border-radius: 10px;
		background: hsl(var(--muted));
		line-height: 1.1;
	}
	.d {
		font-size: 1.0625rem;
		font-weight: 600;
	}
	.m {
		font-size: 0.6875rem;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.excerpt {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
</style>
