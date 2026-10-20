<script lang="ts">
	// Stat tile (port of easy-business Kpi): label, value, delta % vs previous period (arrow + signed %),
	// a sparkline in the muted hue with the current point in primary. `href` makes the tile a link.
	import { ArrowDownRight, ArrowUpRight, Minus } from '@lucide/svelte';

	interface Props {
		label: string;
		value: string | number;
		/** Change vs the previous period in percent (12.5 = +12.5%). */
		delta?: number;
		hint?: string;
		spark?: number[];
		href?: string;
	}
	let { label, value, delta, hint, spark = [], href }: Props = $props();

	const dir = $derived(delta == null || Math.abs(delta) < 0.05 ? 0 : delta > 0 ? 1 : -1);
	const shown = $derived(typeof value === 'number' ? value.toLocaleString('en-IN') : value);

	const W = 88, H = 28;
	const pts = $derived.by(() => {
		if (spark.length < 2) return [];
		const lo = Math.min(...spark), hi = Math.max(...spark), span = hi - lo || 1;
		return spark.map((v, i) => ({ x: (i / (spark.length - 1)) * (W - 4) + 2, y: H - 3 - ((v - lo) / span) * (H - 6) }));
	});
	const path = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''));
</script>

<svelte:element this={href ? 'a' : 'div'} {href} class="stat kit-kpi" class:is-link={!!href}>
	<div class="stat-label">{label}</div>
	<div class="kit-kpi-row">
		<div class="stat-value kit-kpi-value" title={String(shown)}>{shown}</div>
		{#if path}
			<svg width={W} height={H} viewBox="0 0 {W} {H}" class="kit-spark" aria-hidden="true">
				<path d={path} />
				<circle cx={pts.at(-1)!.x} cy={pts.at(-1)!.y} r="2.5" />
			</svg>
		{/if}
	</div>
	{#if delta != null || hint}
		<div class="kit-kpi-foot">
			{#if delta != null}
				<span class="kit-delta" class:up={dir > 0} class:down={dir < 0}>
					{#if dir > 0}<ArrowUpRight aria-hidden="true" />{:else if dir < 0}<ArrowDownRight aria-hidden="true" />{:else}<Minus aria-hidden="true" />{/if}
					<span class="tabular">{dir > 0 ? '+' : dir < 0 ? '−' : ''}{Math.abs(delta).toFixed(1)}%</span>
					<span class="sr-only">{dir > 0 ? 'up' : dir < 0 ? 'down' : 'no change'} vs previous period</span>
				</span>
			{/if}
			{#if hint}<span class="kit-hint">{hint}</span>{/if}
		</div>
	{/if}
</svelte:element>

<style>
	.kit-kpi {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}
	.kit-kpi .stat-label {
		margin-top: 0;
	}
	.is-link {
		transition: border-color 0.15s;
	}
	.is-link:hover {
		border-color: hsl(var(--foreground) / 0.25);
	}
	.is-link:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	.kit-kpi-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		min-width: 0;
	}
	.kit-kpi-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kit-spark {
		flex-shrink: 0;
	}
	.kit-spark path {
		fill: none;
		stroke: hsl(var(--muted-foreground) / 0.6);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.kit-spark circle {
		fill: hsl(var(--primary));
	}
	.kit-kpi-foot {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 1.25rem;
		font-size: 0.75rem;
		white-space: nowrap;
		min-width: 0;
	}
	.kit-delta {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.kit-delta.up {
		color: hsl(var(--success));
	}
	.kit-delta.down {
		color: hsl(var(--danger));
	}
	.kit-delta :global(svg) {
		width: 14px;
		height: 14px;
	}
	.kit-hint {
		color: hsl(var(--muted-foreground));
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
