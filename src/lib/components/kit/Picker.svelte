<script lang="ts">
	// Custom select (port of easy-business Picker): popover on desktop, bottom sheet on phones.
	// Search appears for long lists (or `searchable`). Options with `group` get group headings.
	// Keyboard: ↑/↓ Home/End move, Enter picks, Esc closes, typing filters. A hidden input carries `name`.
	import { Check, Search } from '@lucide/svelte';
	import { haptic } from '#lib/client/platform';
	import Dropdown from './Dropdown.svelte';

	type Opt = { value: string; label: string; hint?: string; group?: string };
	interface Props {
		value: string | null;
		options: Opt[];
		placeholder?: string;
		name?: string;
		searchable?: boolean;
		/** Accessible name and sheet title (use when there is no visible <label for={id}>). */
		label?: string;
		id?: string;
		disabled?: boolean;
		onchange?: (value: string | null) => void;
	}
	let {
		value = $bindable(null),
		options,
		placeholder = 'Choose…',
		name,
		searchable,
		label,
		id,
		disabled = false,
		onchange
	}: Props = $props();

	let open = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let query = $state('');
	let active = $state(0);
	const uid = $props.id();

	const showSearch = $derived(searchable ?? options.length > 8);
	const current = $derived(options.find((o) => o.value === value));
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q ? options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase().includes(q)) : options;
	});

	function show() {
		if (disabled) return;
		query = '';
		active = Math.max(0, options.findIndex((o) => o.value === value));
		open = true;
	}

	function pick(o: Opt) {
		value = o.value;
		onchange?.(o.value);
		haptic(8);
		open = false;
		trigger?.focus({ preventScroll: true });
		// Let GET filter forms that listen for `change` react like they do to a native select.
		trigger?.closest('form')?.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function onKey(e: KeyboardEvent) {
		const n = filtered.length;
		if (!n) return;
		if (e.key === 'ArrowDown') active = Math.min(n - 1, active + 1);
		else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
		else if (e.key === 'Home') active = 0;
		else if (e.key === 'End') active = n - 1;
		else if (e.key === 'Enter' || (e.key === ' ' && !showSearch)) pick(filtered[active]);
		else return;
		e.preventDefault();
	}

	function triggerKey(e: KeyboardEvent) {
		if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
			e.preventDefault();
			show();
		}
	}

	let list = $state<HTMLUListElement>();
	let search = $state<HTMLInputElement>();
	$effect(() => {
		if (!open) return;
		list?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});
	// Focus search on desktop; on phones focus the list so the keyboard doesn't cover the sheet.
	$effect(() => {
		if (!open) return;
		const typing = showSearch && matchMedia('(min-width: 768px)').matches;
		requestAnimationFrame(() => (typing ? search : list)?.focus({ preventScroll: true }));
	});
</script>

{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
<button
	bind:this={trigger}
	{id}
	type="button"
	class="select kit-trigger"
	class:is-open={open}
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-label={label ? `${label}: ${current?.label ?? placeholder}` : undefined}
	{disabled}
	onclick={show}
	onkeydown={triggerKey}
>
	<span class="select-value" class:is-placeholder={!current}>{current?.label ?? placeholder}</span>
</button>

<Dropdown bind:open anchor={trigger} title={label ?? placeholder}>
	{#if showSearch}
		<div class="kit-search">
			<Search aria-hidden="true" />
			<input
				bind:this={search}
				placeholder="Search"
				aria-label="Search {label ?? 'options'}"
				aria-controls="{uid}-list"
				bind:value={query}
				oninput={() => (active = 0)}
				onkeydown={onKey}
			/>
		</div>
	{/if}
	<ul
		bind:this={list}
		id="{uid}-list"
		role="listbox"
		aria-label={label ?? placeholder}
		aria-activedescendant={filtered[active] ? `${uid}-${active}` : undefined}
		tabindex="-1"
		class="kit-list"
		onkeydown={onKey}
	>
		{#each filtered as o, i (o.value)}
			{#if o.group && o.group !== filtered[i - 1]?.group}
				<li class="kit-group" role="presentation">{o.group}</li>
			{/if}
			<li
				id="{uid}-{i}"
				role="option"
				aria-selected={o.value === value}
				data-i={i}
				class="kit-opt"
				class:is-active={i === active}
				onclick={() => pick(o)}
				onkeydown={onKey}
				onpointermove={() => (active = i)}
			>
				<span class="min-w-0 flex-1">
					<span class="block truncate">{o.label}</span>
					{#if o.hint}<span class="select-hint truncate">{o.hint}</span>{/if}
				</span>
				{#if o.value === value}<Check class="kit-check" aria-hidden="true" />{/if}
			</li>
		{:else}
			<li class="kit-opt kit-none" role="option" aria-selected="false" aria-disabled="true">No matches</li>
		{/each}
	</ul>
</Dropdown>

<style>
	.kit-trigger {
		width: 100%;
		text-align: left;
		cursor: pointer;
	}
	.kit-trigger:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.kit-trigger.is-open {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.18);
	}
	.kit-search {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
		padding: 0 0.75rem;
		min-height: 44px;
		border-radius: 10px;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	.kit-search :global(svg) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.kit-search input {
		/* beat the global `.field input` style when this sits inside a .field */
		border: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
		padding: 0 !important;
		min-height: 0 !important;
		width: auto !important;
		flex: 1;
		min-width: 0;
		background: transparent;
		outline: none;
		color: hsl(var(--foreground));
		font-size: 16px;
	}
	.kit-list {
		outline: none;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.kit-group {
		padding: 0.625rem 0.75rem 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.kit-opt {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		font-size: 0.9375rem;
		cursor: pointer;
		user-select: none;
	}
	.kit-opt.is-active {
		background: hsl(var(--muted));
	}
	.kit-opt[aria-selected='true'] {
		font-weight: 600;
	}
	.kit-none {
		color: hsl(var(--muted-foreground));
		cursor: default;
	}
	.kit-opt :global(.kit-check) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: hsl(var(--primary));
	}
</style>
