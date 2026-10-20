<script lang="ts">
	// Staff ⌘K / Ctrl+K "go to" palette (port of easy-business Palette, navigation only).
	// A <dialog> in the top layer: focus is trapped, Esc closes, focus returns to where it was.
	// ↑/↓ move, Enter opens, typing filters by label and group. `open` can also be bound by a trigger button.
	import { goto } from '$app/navigation';
	import { CornerDownLeft, Search } from '@lucide/svelte';

	interface Props {
		items: { label: string; href: string; group: string }[];
		open?: boolean;
	}
	let { items, open = $bindable(false) }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let listEl = $state<HTMLDivElement>();
	let q = $state('');
	let active = $state(0);
	const uid = $props.id();

	const found = $derived.by(() => {
		const n = q.trim().toLowerCase();
		return n ? items.filter((i) => `${i.label} ${i.group}`.toLowerCase().includes(n)) : items;
	});
	const grouped = $derived.by(() => {
		const out: { group: string; items: Props['items'] }[] = [];
		found.forEach((it) => {
			let g = out.find((x) => x.group === it.group);
			if (!g) out.push((g = { group: it.group, items: [] }));
			g.items.push(it);
		});
		return out;
	});
	// Keyboard order follows the grouped display order.
	const order = $derived(grouped.flatMap((g) => g.items));

	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				open = !open;
			}
		};
		addEventListener('keydown', onKey);
		return () => removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			q = '';
			active = 0;
			dialog.showModal();
			input?.focus();
		}
		if (!open && dialog.open) dialog.close();
	});
	$effect(() => {
		void active;
		listEl?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
	});

	function go(href: string) {
		open = false;
		goto(href);
	}

	function onkeydown(e: KeyboardEvent) {
		const n = order.length;
		if (e.key === 'ArrowDown') active = n ? (active + 1) % n : 0;
		else if (e.key === 'ArrowUp') active = n ? (active - 1 + n) % n : 0;
		else if (e.key === 'Enter' && order[active]) go(order[active].href);
		else return;
		e.preventDefault();
	}
</script>

<dialog
	bind:this={dialog}
	class="kit-palette"
	aria-label="Go to"
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
>
	<div class="kit-pal-search">
		<Search aria-hidden="true" />
		<input
			bind:this={input}
			bind:value={q}
			{onkeydown}
			oninput={() => (active = 0)}
			placeholder="Go to a page…"
			role="combobox"
			aria-expanded="true"
			aria-controls="{uid}-list"
			aria-autocomplete="list"
			aria-activedescendant={order[active] ? `${uid}-${active}` : undefined}
			autocomplete="off"
			spellcheck="false"
		/>
		<kbd class="kit-kbd">Esc</kbd>
	</div>
	<div bind:this={listEl} id="{uid}-list" role="listbox" aria-label="Pages" class="kit-pal-list">
		{#each grouped as g (g.group)}
			<div role="group" aria-label={g.group}>
				<p class="kit-pal-group" aria-hidden="true">{g.group}</p>
				{#each g.items as it (it.href)}
					{@const pos = order.indexOf(it)}
					<div
						id="{uid}-{pos}"
						role="option"
						aria-selected={pos === active}
						tabindex="-1"
						class="kit-pal-item"
						onpointermove={() => (active = pos)}
						onclick={() => go(it.href)}
						onkeydown={() => {}}
					>
						<span class="min-w-0 flex-1 truncate">{it.label}</span>
						{#if pos === active}<CornerDownLeft aria-hidden="true" />{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="kit-pal-none">No pages match “{q}”</p>
		{/each}
	</div>
	<div class="kit-pal-foot" aria-hidden="true">
		<span><kbd class="kit-kbd">↑↓</kbd> move</span>
		<span><kbd class="kit-kbd">↵</kbd> open</span>
		<span><kbd class="kit-kbd">esc</kbd> close</span>
	</div>
</dialog>

<style>
	.kit-palette {
		margin: min(12vh, 96px) auto auto;
		width: calc(100% - 1.5rem);
		max-width: 40rem;
		max-height: min(560px, 76svh);
		padding: 0;
		border: 1px solid hsl(var(--border));
		border-radius: 16px;
		background: hsl(var(--surface));
		color: hsl(var(--foreground));
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}
	.kit-palette[open] {
		display: flex;
		flex-direction: column;
		animation: kit-pal-in 0.14s var(--ease-smooth);
	}
	.kit-palette::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	@keyframes kit-pal-in {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kit-palette[open] {
			animation: none;
		}
	}
	.kit-pal-search {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0 1rem;
		border-bottom: 1px solid hsl(var(--border));
		flex-shrink: 0;
	}
	.kit-pal-search :global(svg) {
		width: 18px;
		height: 18px;
		color: hsl(var(--muted-foreground));
		flex-shrink: 0;
	}
	.kit-pal-search input {
		/* beat the global `.field input` style when this sits inside a .field */
		border: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
		padding: 0 !important;
		min-height: 0 !important;
		width: auto !important;
		flex: 1;
		min-width: 0;
		height: 3.5rem;
		background: transparent;
		outline: none;
		font-size: 16px;
	}
	.kit-pal-search input::placeholder {
		color: hsl(var(--muted-foreground));
	}
	.kit-pal-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.5rem;
	}
	.kit-pal-group {
		padding: 0.625rem 0.625rem 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.kit-pal-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 44px;
		padding: 0 0.625rem;
		border-radius: 10px;
		font-size: 0.9375rem;
		cursor: pointer;
	}
	.kit-pal-item[aria-selected='true'] {
		background: hsl(var(--muted));
	}
	.kit-pal-item :global(svg) {
		width: 16px;
		height: 16px;
		color: hsl(var(--muted-foreground));
	}
	.kit-pal-none {
		padding: 2.5rem 1rem;
		text-align: center;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.kit-pal-foot {
		display: none;
		gap: 1rem;
		padding: 0.5rem 1rem;
		border-top: 1px solid hsl(var(--border));
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	@media (hover: hover) and (min-width: 768px) {
		.kit-pal-foot {
			display: flex;
		}
	}
	.kit-kbd {
		font-family: var(--font-body);
		font-size: 0.6875rem;
		padding: 1px 6px;
		border: 1px solid hsl(var(--border));
		border-radius: 6px;
		color: hsl(var(--muted-foreground));
	}
</style>
