<script lang="ts">
	// One-series bar chart (port of easy-business Chart, bar mode): ≤28px columns with 4px rounded tops,
	// hairline grid with clean 1/2/2.5/5×10ⁿ ticks, hover/keyboard tooltip, and an accessible table.
	interface Props {
		data: { label: string; value: number }[];
		format?: (n: number) => string;
		height?: number;
	}
	let { data, format = (n) => n.toLocaleString('en-IN'), height = 220 }: Props = $props();

	let w = $state(0);
	let hover = $state<number | null>(null);
	let showTable = $state(false);
	const pad = { t: 14, r: 8, b: 26, l: 44 };
	const ih = $derived(height - pad.t - pad.b);
	const iw = $derived(Math.max(0, w - pad.l - pad.r));

	const max = $derived(Math.max(1, ...data.map((d) => d.value)));
	const step = $derived.by(() => {
		const raw = max / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		return ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
	});
	const top = $derived(step * Math.ceil(max / step));
	const empty = $derived(data.every((d) => !d.value));
	const ticks = $derived(empty ? [0] : Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step));
	const y = (v: number) => pad.t + ih - (v / top) * ih;

	const band = $derived(data.length ? iw / data.length : 0);
	const x = (i: number) => pad.l + band * i + band / 2;
	const barW = $derived(Math.max(2, Math.min(28, band * 0.7)));
	// Thin the x labels so they never collide (≈ 7px per character).
	const every = $derived(Math.max(1, Math.ceil((Math.max(...data.map((d) => d.label.length), 1) * 7 + 8) / Math.max(band, 1))));

	function bar(i: number, v: number) {
		const h = Math.max(0, pad.t + ih - y(v));
		const r = Math.min(4, h, barW / 2);
		const x0 = x(i) - barW / 2, y0 = pad.t + ih - h;
		return `M${x0},${pad.t + ih}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${pad.t + ih}Z`;
	}
	function move(e: PointerEvent) {
		const r = (e.currentTarget as SVGElement).getBoundingClientRect();
		const i = Math.floor((e.clientX - r.left - pad.l) / band);
		hover = i >= 0 && i < data.length ? i : null;
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') hover = Math.min(data.length - 1, (hover ?? -1) + 1);
		else if (e.key === 'ArrowLeft') hover = Math.max(0, (hover ?? data.length) - 1);
		else return;
		e.preventDefault();
	}
	const tipLeft = $derived(hover == null ? 0 : Math.min(Math.max(x(hover), 60), w - 60));
</script>

<div class="kit-chart" bind:clientWidth={w} style:height="{height}px">
	{#if w && data.length}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (role=application: arrow keys read values) -->
		<svg
			width={w}
			{height}
			role="application"
			aria-roledescription="chart"
			aria-label="Bar chart. Use left and right arrow keys to read values."
			tabindex="0"
			onpointermove={move}
			onpointerleave={() => (hover = null)}
			onkeydown={key}
			onblur={() => (hover = null)}
		>
			{#each ticks as t (t)}
				<line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} class="grid" />
				<text x={pad.l - 8} y={y(t)} dy="0.32em" text-anchor="end" class="tick">{format(t)}</text>
			{/each}
			{#each data as d, i (i)}
				<path d={bar(i, d.value)} class="bar" class:dim={hover != null && hover !== i} />
				{#if i % every === 0}
					<text x={x(i)} y={height - 8} text-anchor="middle" class="tick">{d.label}</text>
				{/if}
			{/each}
		</svg>
		{#if empty}
			<p class="kit-chart-empty">Nothing to show yet</p>
		{/if}
		{#if hover != null && data[hover]}
			<div class="kit-tip" style:left="{tipLeft}px">
				<div class="font-mono tabular kit-tip-v">{format(data[hover].value)}</div>
				<div class="kit-tip-l">{data[hover].label}</div>
			</div>
		{/if}
	{:else if !data.length}
		<p class="kit-chart-empty">Nothing to show yet</p>
	{/if}
</div>

<div class="kit-chart-toggle">
	<button type="button" class="btn btn-ghost btn-sm" aria-expanded={showTable} onclick={() => (showTable = !showTable)}>
		{showTable ? 'Hide table' : 'View as table'}
	</button>
</div>
<div class:sr-only={!showTable}>
<table class="kit-chart-table">
	<thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead>
	<tbody>
		{#each data as d, i (i)}<tr><th scope="row">{d.label}</th><td class="tabular">{format(d.value)}</td></tr>{/each}
	</tbody>
</table>
</div>

<style>
	.kit-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		outline: none;
		touch-action: pan-y;
	}
	svg:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
		border-radius: 8px;
	}
	.grid {
		stroke: hsl(var(--foreground) / 0.08);
		stroke-width: 1;
	}
	.tick {
		fill: hsl(var(--muted-foreground));
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.bar {
		fill: hsl(var(--primary));
		transition: opacity 0.15s;
	}
	.bar.dim {
		opacity: 0.4;
	}
	.kit-chart-empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		pointer-events: none;
	}
	.kit-tip {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		pointer-events: none;
		padding: 0.375rem 0.625rem;
		border-radius: 8px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		box-shadow: var(--shadow-lg);
		white-space: nowrap;
	}
	.kit-tip-v {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.kit-tip-l {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.kit-chart-toggle {
		display: flex;
		justify-content: flex-end;
	}
	.kit-chart-table {
		width: 100%;
		font-size: 0.8125rem;
		border-collapse: collapse;
	}
	.kit-chart-table th,
	.kit-chart-table td {
		padding: 0.375rem 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
		text-align: left;
	}
	.kit-chart-table td {
		text-align: right;
	}
	.kit-chart-table th[scope='row'] {
		font-weight: 400;
		color: hsl(var(--muted-foreground));
	}
</style>
