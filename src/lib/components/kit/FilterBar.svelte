<script lang="ts">
	// Search + filters kept in the URL (?q=, ?<key>=), so lists are linkable and survive reloads.
	// Desktop: one Picker per filter. Phones: a chip row per filter. Any change drops ?cursor= (back to page 1).
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Search, X } from '@lucide/svelte';
	import Picker from './Picker.svelte';

	type Opt = { value: string; label: string; count?: number };
	interface Props {
		search?: boolean;
		placeholder?: string;
		filters: { key: string; label: string; options: Opt[] }[];
	}
	let { search = true, placeholder = 'Search', filters }: Props = $props();

	const params = $derived(page.url.searchParams);
	let q = $state(page.url.searchParams.get('q') ?? '');
	// Follow back/forward navigation unless the user is typing.
	let typing = false;
	$effect(() => {
		const v = params.get('q') ?? '';
		if (!typing) q = v;
	});

	const active = $derived(filters.filter((f) => params.get(f.key)));
	const dirty = $derived(active.length > 0 || !!params.get('q'));

	function hrefWith(changes: Record<string, string | null>) {
		const u = new URL(page.url.href);
		u.searchParams.delete('cursor');
		for (const [k, v] of Object.entries(changes)) {
			if (v) u.searchParams.set(k, v);
			else u.searchParams.delete(k);
		}
		return u.pathname + u.search;
	}
	const apply = (changes: Record<string, string | null>) =>
		goto(hrefWith(changes), { replaceState: true, reset: false });

	let t: ReturnType<typeof setTimeout> | undefined;
	function oninput() {
		typing = true;
		clearTimeout(t);
		t = setTimeout(async () => {
			await apply({ q: q.trim() || null });
			typing = false;
		}, 250);
	}
	const clearHref = $derived(hrefWith({ q: null, ...Object.fromEntries(filters.map((f) => [f.key, null])) }));
	const withCount = (o: Opt) => (o.count != null ? `${o.label} (${o.count})` : o.label);
</script>

<div class="kit-filters">
	{#if search}
		<label class="kit-fsearch">
			<Search aria-hidden="true" />
			<input type="search" bind:value={q} {oninput} {placeholder} aria-label={placeholder} enterkeyhint="search" />
			{#if q}
				<button type="button" class="icon-btn icon-btn-sm" aria-label="Clear search" onclick={() => ((q = ''), apply({ q: null }))}><X /></button>
			{/if}
		</label>
	{/if}

	{#if filters.length}
		<div class="kit-fdesk">
			{#each filters as f (f.key)}
				<div class="kit-fpick">
					<Picker
						label={f.label}
						value={params.get(f.key) ?? ''}
						options={[{ value: '', label: `Any ${f.label.toLowerCase()}` }, ...f.options.map((o) => ({ value: o.value, label: withCount(o) }))]}
						onchange={(v) => apply({ [f.key]: v || null })}
					/>
				</div>
			{/each}
		</div>
		<div class="kit-fphone">
			{#each filters as f (f.key)}
				<div class="chips" role="group" aria-label={f.label}>
					<a class="chip" href={hrefWith({ [f.key]: null })} aria-current={!params.get(f.key) ? 'true' : undefined} data-sveltekit-replacestate data-sveltekit-reset="false">
						Any {f.label.toLowerCase()}
					</a>
					{#each f.options as o (o.value)}
						<a class="chip" href={hrefWith({ [f.key]: o.value })} aria-current={params.get(f.key) === o.value ? 'true' : undefined} data-sveltekit-replacestate data-sveltekit-reset="false">
							{o.label}{#if o.count != null}<span class="count">{o.count}</span>{/if}
						</a>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	{#if dirty}
		<a class="btn btn-ghost btn-sm kit-fclear" href={clearHref} data-sveltekit-replacestate data-sveltekit-reset="false">Clear all</a>
	{/if}
</div>

<style>
	.kit-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.625rem;
		min-width: 0;
	}
	.kit-fsearch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1 1 16rem;
		min-width: 0;
		min-height: 44px;
		padding: 0 0.25rem 0 0.875rem;
		border: 1px solid hsl(var(--input));
		border-radius: 12px;
		background: hsl(var(--surface));
		color: hsl(var(--muted-foreground));
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.kit-fsearch:focus-within {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.18);
	}
	.kit-fsearch > :global(svg) {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
	.kit-fsearch input {
		/* beat the global `.field input` style when this sits inside a .field */
		border: 0 !important;
		border-radius: 0 !important;
		box-shadow: none !important;
		padding: 0 !important;
		min-height: 0 !important;
		width: auto !important;
		flex: 1;
		min-width: 0;
		height: 42px;
		background: transparent;
		outline: none;
		color: hsl(var(--foreground));
		font-size: 16px;
	}
	.kit-fsearch input::-webkit-search-cancel-button {
		display: none;
	}
	@media (min-width: 768px) {
		.kit-fsearch input {
			font-size: 0.9375rem;
		}
	}
	.kit-fdesk {
		display: none;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.kit-fpick {
		width: 12.5rem;
	}
	.kit-fpick :global(.select) {
		min-height: 44px;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
	}
	.kit-fphone {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
	}
	@media (min-width: 768px) {
		.kit-fdesk {
			display: flex;
		}
		.kit-fphone {
			display: none;
		}
	}
</style>
