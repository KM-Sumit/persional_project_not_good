<script lang="ts" module>
	import type { Snippet } from 'svelte';
	export type Column<T> = {
		key: string;
		label: string;
		cell?: Snippet<[T]>;
		align?: 'left' | 'right';
		hideOnPhone?: boolean;
		sortable?: boolean;
	};
</script>

<script lang="ts" generics="T">
	// Server-driven list (shape of easy-business datatable, trimmed): a table with a sticky header from 768px,
	// cards from the same column defs on phones (first column = title, first right-aligned = trailing, the
	// rest = meta). Sorting and paging live in the URL (?sort=&dir=, ?cursor=) so the load function owns data.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowDown, ArrowUp, ChevronRight, Inbox } from '@lucide/svelte';

	interface Props {
		rows: T[];
		columns: Column<T>[];
		rowHref?: (r: T) => string;
		selectable?: boolean;
		selected?: string[];
		getId?: (r: T) => string;
		empty?: Snippet;
		loading?: boolean;
		nextCursor?: string | null;
		bulk?: Snippet<[string[]]>;
	}
	let {
		rows,
		columns,
		rowHref,
		selectable = false,
		selected = $bindable([]),
		getId = (r: T) => String((r as { id?: unknown }).id),
		empty,
		loading = false,
		nextCursor = null,
		bulk
	}: Props = $props();

	const sort = $derived(page.url.searchParams.get('sort'));
	const dir = $derived(page.url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc');
	const title = $derived(columns[0]);
	const trail = $derived(columns.slice(1).find((c) => c.align === 'right' && !c.hideOnPhone));
	const meta = $derived(columns.slice(1).filter((c) => c !== trail && !c.hideOnPhone));

	const ids = $derived(rows.map(getId));
	const pageSelected = $derived(ids.filter((id) => selected.includes(id)).length);
	const allOnPage = $derived(ids.length > 0 && pageSelected === ids.length);

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}
	function toggleAll() {
		selected = allOnPage ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])];
	}

	function sortHref(key: string) {
		const u = new URL(page.url.href);
		u.searchParams.delete('cursor');
		u.searchParams.set('sort', key);
		u.searchParams.set('dir', sort === key && dir === 'asc' ? 'desc' : 'asc');
		return u.pathname + u.search;
	}
	const moreHref = $derived.by(() => {
		if (!nextCursor) return '';
		const u = new URL(page.url.href);
		u.searchParams.set('cursor', nextCursor);
		return u.pathname + u.search;
	});

	/** Row click opens the row unless the click was on a control inside it. */
	function open(e: MouseEvent, r: T) {
		if (!rowHref) return;
		if ((e.target as HTMLElement).closest('a, button, input, label, select, textarea, [role="button"]')) return;
		if (window.getSelection()?.toString()) return;
		goto(rowHref(r));
	}
	const text = (r: T, key: string) => {
		const v = (r as Record<string, unknown>)[key];
		return v == null || v === '' ? '—' : String(v);
	};
</script>

{#snippet value(c: Column<T>, r: T)}
	{#if c.cell}{@render c.cell(r)}{:else}{text(r, c.key)}{/if}
{/snippet}

{#snippet check(id: string, label: string)}
	<label class="kit-check">
		<input type="checkbox" checked={selected.includes(id)} onchange={() => toggle(id)} aria-label="Select {label}" />
	</label>
{/snippet}

<div class="kit-table-root" aria-busy={loading}>
	{#if !loading && rows.length === 0}
		{#if empty}
			{@render empty()}
		{:else}
			<div class="empty empty-compact card">
				<div class="empty-icon"><Inbox /></div>
				<p class="empty-title">Nothing here yet</p>
			</div>
		{/if}
	{:else}
		<!-- Desktop / tablet: table -->
		<div class="kit-table-wrap">
			<table class="kit-table">
				<thead>
					<tr>
						{#if selectable}
							<th class="kit-col-check" scope="col">
								<label class="kit-check">
									<input
										type="checkbox"
										checked={allOnPage}
										indeterminate={pageSelected > 0 && !allOnPage}
										onchange={toggleAll}
										aria-label="Select all on this page"
									/>
								</label>
							</th>
						{/if}
						{#each columns as c (c.key)}
							<th scope="col" class:right={c.align === 'right'} aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
								{#if c.sortable}
									<a href={sortHref(c.key)} class="kit-sort" data-sveltekit-replacestate data-sveltekit-reset="false">
										{c.label}
										{#if sort === c.key}{#if dir === 'asc'}<ArrowUp aria-hidden="true" />{:else}<ArrowDown aria-hidden="true" />{/if}{/if}
									</a>
								{:else}
									{c.label}
								{/if}
							</th>
						{/each}
						{#if rowHref}<th class="kit-col-go" scope="col"><span class="sr-only">Open</span></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#if loading}
						{#each { length: 5 } as _, i (i)}
							<tr class="kit-skel">
								{#if selectable}<td></td>{/if}
								{#each columns as c (c.key)}<td><div class="skeleton h-4 w-3/4"></div></td>{/each}
								{#if rowHref}<td></td>{/if}
							</tr>
						{/each}
					{:else}
						{#each rows as r, i (ids[i])}
							<tr class:is-link={!!rowHref} class:is-selected={selected.includes(ids[i])} onclick={(e) => open(e, r)}>
								{#if selectable}<td class="kit-col-check">{@render check(ids[i], text(r, columns[0].key))}</td>{/if}
								{#each columns as c, j (c.key)}
									<td class:right={c.align === 'right'} class:kit-first={j === 0}>{@render value(c, r)}</td>
								{/each}
								{#if rowHref}
									<td class="kit-col-go"><a href={rowHref(r)} class="icon-btn icon-btn-sm" aria-label="Open {text(r, columns[0].key)}"><ChevronRight /></a></td>
								{/if}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<!-- Phones: cards from the same columns -->
		<ul class="list kit-cards">
			{#if loading}
				{#each { length: 5 } as _, i (i)}
					<li class="list-row"><div class="grow stack-sm"><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-3 w-1/2"></div></div></li>
				{/each}
			{:else}
				{#each rows as r, i (ids[i])}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (the chevron link is the keyboard path) -->
					<li class="list-row kit-card" class:is-link={!!rowHref} class:is-selected={selected.includes(ids[i])} onclick={(e) => open(e, r)}>
						{#if selectable}{@render check(ids[i], text(r, title.key))}{/if}
						<div class="grow">
							<div class="title kit-card-title">{@render value(title, r)}</div>
							{#if meta.length}
								<div class="kit-card-meta">
									{#each meta as c (c.key)}<span><span class="sr-only">{c.label}: </span>{@render value(c, r)}</span>{/each}
								</div>
							{/if}
						</div>
						{#if trail}<div class="trail">{@render value(trail, r)}</div>{/if}
						{#if rowHref}<a href={rowHref(r)} class="kit-card-go" aria-label="Open {text(r, title.key)}"><ChevronRight class="chev" /></a>{/if}
					</li>
				{/each}
			{/if}
		</ul>

		{#if moreHref && !loading}
			<div class="kit-more">
				<a href={moreHref} class="btn btn-secondary" data-sveltekit-reset="false">Load more</a>
			</div>
		{/if}
	{/if}

	{#if bulk && selected.length}
		<div class="kit-bulk" role="region" aria-label="Bulk actions">
			<span class="kit-bulk-n"><span class="font-mono tabular">{selected.length}</span> selected</span>
			<div class="kit-bulk-actions">{@render bulk(selected)}</div>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (selected = [])}>Clear</button>
		</div>
	{/if}
</div>

<style>
	.kit-table-root {
		min-width: 0;
	}
	.kit-table-wrap {
		display: none;
	}
	.kit-cards {
		display: block;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	@media (min-width: 768px) {
		.kit-table-wrap {
			display: block;
			/* clip (not hidden) keeps the sticky header working: it doesn't create a scroll container. */
			overflow: clip;
			border: 1px solid hsl(var(--border));
			border-radius: var(--radius);
			background: hsl(var(--surface));
			box-shadow: var(--shadow-sm);
		}
		.kit-cards {
			display: none;
		}
	}
	.kit-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.875rem;
	}
	.kit-table th {
		position: sticky;
		top: calc(var(--appbar-h) + var(--safe-top));
		z-index: 2;
		padding: 0.625rem 0.875rem;
		background: hsl(var(--muted));
		border-bottom: 1px solid hsl(var(--border));
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		text-align: left;
		white-space: nowrap;
	}
	@media (min-width: 1024px) {
		.kit-table th {
			top: 0;
		}
	}
	.kit-table td {
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid hsl(var(--border));
		vertical-align: middle;
		overflow-wrap: anywhere;
	}
	.kit-table tbody tr:last-child td {
		border-bottom: 0;
	}
	.kit-table .right {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.kit-table .kit-first {
		font-weight: 600;
	}
	.kit-table tr.is-link {
		cursor: pointer;
	}
	.kit-table tbody tr {
		transition: background-color 0.12s;
	}
	.kit-table tbody tr.is-link:hover {
		background: hsl(var(--muted) / 0.5);
	}
	.kit-table tr.is-selected,
	.kit-card.is-selected {
		background: hsl(var(--accent));
	}
	.kit-col-check {
		width: 1%;
		padding-right: 0 !important;
	}
	.kit-col-go {
		width: 1%;
		padding: 0 0.375rem !important;
	}
	.kit-sort {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 6px;
	}
	.kit-sort:hover {
		color: hsl(var(--foreground));
	}
	.kit-sort :global(svg) {
		width: 14px;
		height: 14px;
	}
	.kit-check {
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		margin: -0.5rem 0 -0.5rem -0.5rem;
		cursor: pointer;
	}
	.kit-check input {
		width: 18px;
		height: 18px;
		accent-color: hsl(var(--primary));
		cursor: pointer;
	}
	@media (pointer: fine) {
		.kit-table .kit-check {
			min-width: 32px;
			min-height: 32px;
			margin: -0.25rem 0;
		}
	}
	.kit-card.is-link {
		cursor: pointer;
	}
	.kit-card-title {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.kit-card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.125rem 0.75rem;
		margin-top: 2px;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.kit-card .trail {
		font-variant-numeric: tabular-nums;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.kit-card-go {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -0.5rem -0.75rem -0.5rem -0.5rem;
		flex-shrink: 0;
	}
	.kit-more {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}
	.kit-bulk {
		position: sticky;
		bottom: calc(var(--bottom-space, 0px) + 0.75rem);
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		margin-top: 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border-radius: 14px;
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		box-shadow: var(--shadow-lg);
	}
	.kit-bulk-n {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.kit-bulk-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-left: auto;
	}
	.kit-bulk .btn-ghost {
		color: inherit;
	}
</style>
