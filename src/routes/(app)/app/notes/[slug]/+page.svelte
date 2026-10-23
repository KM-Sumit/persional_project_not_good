<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bookmark, Clock, Download, ListTree } from '@lucide/svelte';
	import OfferPanel from '#lib/features/billing/components/OfferPanel.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import SaveOffline from '#lib/components/pwa/SaveOffline.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import { toast } from '#lib/components/ui';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import PdfViewer from '#lib/components/kit/PdfViewer.svelte';
	import { day } from '#lib/features/courses/components/format';

	let { data } = $props();
	const n = $derived(data.note);
	let tocOpen = $state(false);
	let saving = $state(false);
</script>

<svelte:head><title>{n.title} · Notes · UCI</title></svelte:head>

{#snippet toc()}
	<nav aria-label="On this page">
		<ol class="toc">
			{#each n.toc as t (t.id)}
				<li class="lvl-{t.level}"><a href="#{t.id}" onclick={() => (tocOpen = false)}>{t.text}</a></li>
			{/each}
		</ol>
	</nav>
{/snippet}

<div class="page pb-10">
	<PageHeader title={n.title} eyebrow={data.examName ?? 'Notes'} crumbs={[{ href: '/app/notes', label: 'Notes' }]}>
		{#snippet actions()}
			<form
				method="POST"
				action="?/bookmark"
				use:enhance={() => {
					saving = true;
					return async ({ result, update }) => {
						saving = false;
						if (result.type === 'success') toast((result.data as { bookmarked?: boolean })?.bookmarked ? 'Saved for revision' : 'Removed from saved');
						await update();
					};
				}}
			>
				<input type="hidden" name="on" value={n.bookmarked ? 'false' : 'true'} />
				<button class="icon-btn" disabled={saving} aria-pressed={n.bookmarked} aria-label={n.bookmarked ? 'Remove bookmark' : 'Bookmark this note'}>
					<Bookmark class={n.bookmarked ? 'fill-current text-primary' : ''} />
				</button>
			</form>
		{/snippet}
	</PageHeader>

	<div class="reader">
		{#if n.toc.length > 1}
			<aside class="toc-side">
				<p class="eyebrow mb-2">On this page</p>
				{@render toc()}
			</aside>
		{/if}

		<article class="min-w-0">
			<div class="meta">
				<span class="flex items-center gap-1.5"><Clock class="size-4" /><span class="tabular">{n.readingMinutes}</span> min read</span>
				<span>Updated {day(n.updatedAt)}</span>
				{#if n.toc.length > 1}
					<button type="button" class="btn btn-ghost btn-sm toc-btn" onclick={() => (tocOpen = true)}><ListTree />Contents</button>
				{/if}
			</div>
			{#if n.summary}<p class="lede">{n.summary}</p>{/if}
			{#if data.paywall.locked}
				<div class="teaser"><Markdown html={n.html} /></div>
				<div class="unlock-card"><OfferPanel offer={data.paywall.offer} eyebrow="Keep reading this note" free={{ href: '/app/notes', label: 'Browse free notes' }} /></div>
			{:else}
				<Markdown html={n.html} />
			{/if}

			{#if n.fileId && !data.paywall.locked}
				<PdfViewer src="/api/files/{n.fileId}" title={n.title} />
			{/if}
			{#if n.fileId}
				<div class="card card-pad pdf">
					<div class="min-w-0"><p class="font-semibold">PDF version</p><p class="muted small">Read it above, or save a copy.</p></div>
					<div class="flex flex-wrap gap-2">
						<a class="btn btn-secondary" href="/api/files/{n.fileId}" target="_blank" rel="noopener"><Download />Download PDF</a>
						{#if !data.paywall.locked}<SaveOffline kind="file" id={n.slug} title={n.title} />{/if}
					</div>
				</div>
			{/if}
			{#if !data.paywall.locked}
				<div class="flex justify-center"><SaveOffline kind="note" id={n.slug} title={n.title} class="btn btn-ghost" /></div>
			{/if}
			<div class="end">
				<a class="btn {data.paywall.locked ? 'btn-secondary' : 'btn-primary'}" href="/app/tests">Practise with a test</a>
				<a class="btn btn-ghost" href="/app/notes">More notes</a>
			</div>
		</article>
	</div>
</div>

<Sheet bind:open={tocOpen} title="Contents">{@render toc()}</Sheet>

<style>
	.reader {
		display: grid;
		gap: 2rem;
		justify-content: center;
		grid-template-columns: minmax(0, 70ch);
	}
	.toc-side {
		display: none;
	}
	@media (min-width: 1024px) {
		.reader {
			grid-template-columns: 14rem minmax(0, 70ch);
		}
		.toc-side {
			display: block;
			position: sticky;
			top: calc(var(--appbar-h) + 1rem);
			align-self: start;
			max-height: calc(100dvh - var(--appbar-h) - 2rem);
			overflow-y: auto;
		}
		.toc-btn {
			display: none;
		}
	}
	.toc {
		display: grid;
		gap: 0.125rem;
		font-size: 0.875rem;
	}
	.toc a {
		display: block;
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		color: hsl(var(--muted-foreground));
		line-height: 1.35;
	}
	.toc a:hover {
		color: hsl(var(--foreground));
		background: hsl(var(--muted));
	}
	.toc .lvl-3 a {
		padding-left: 1.25rem;
	}
	.toc .lvl-4 a {
		padding-left: 2rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		padding-bottom: 1rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid hsl(var(--border));
	}
	.toc-btn {
		margin-left: auto;
	}
	.lede {
		font-size: 1.0625rem;
		color: hsl(var(--muted-foreground));
		margin-bottom: 1.25rem;
		line-height: 1.6;
	}
	.teaser {
		position: relative;
		max-height: 32rem;
		overflow: hidden;
		-webkit-mask-image: linear-gradient(to bottom, black 60%, transparent);
		mask-image: linear-gradient(to bottom, black 60%, transparent);
	}
	.unlock-card {
		margin-top: 0.5rem;
	}
	.pdf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 2rem;
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 2rem;
		padding-top: 1.25rem;
		border-top: 1px solid hsl(var(--border));
	}
</style>
