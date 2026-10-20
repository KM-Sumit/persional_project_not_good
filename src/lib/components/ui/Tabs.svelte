<script lang="ts">
	// Segmented tabs. Give items an `href` for page-level tabs (links, aria-current), or bind `value`
	// for in-page switching (buttons, arrow keys move between tabs). Scrolls sideways on narrow phones.
	type Item = { value: string; label: string; href?: string; count?: number };
	let {
		items,
		value = $bindable(''),
		label,
		onchange
	}: { items: Item[]; value?: string; label?: string; onchange?: (value: string) => void } = $props();

	const isLinks = $derived(items.some((i) => i.href));
	let root = $state<HTMLDivElement>();

	function select(v: string) {
		value = v;
		onchange?.(v);
	}
	function onkey(e: KeyboardEvent, i: number) {
		const n = items.length;
		let j = -1;
		if (e.key === 'ArrowRight') j = (i + 1) % n;
		else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
		else if (e.key === 'Home') j = 0;
		else if (e.key === 'End') j = n - 1;
		if (j < 0) return;
		e.preventDefault();
		select(items[j].value);
		(root?.children[j] as HTMLElement | undefined)?.focus();
	}
</script>

<div bind:this={root} class="segmented" role={isLinks ? undefined : 'tablist'} aria-label={label}>
	{#each items as it, i (it.value)}
		{#if it.href}
			<a href={it.href} aria-current={it.value === value ? 'page' : undefined}>
				{it.label}{#if it.count != null}<span class="seg-count">{it.count}</span>{/if}
			</a>
		{:else}
			<button
				type="button"
				role="tab"
				aria-selected={it.value === value}
				tabindex={it.value === value || (!items.some((x) => x.value === value) && i === 0) ? 0 : -1}
				onclick={() => select(it.value)}
				onkeydown={(e) => onkey(e, i)}
			>
				{it.label}{#if it.count != null}<span class="seg-count">{it.count}</span>{/if}
			</button>
		{/if}
	{/each}
</div>
