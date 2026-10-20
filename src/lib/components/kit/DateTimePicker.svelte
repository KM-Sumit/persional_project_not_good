<script lang="ts" module>
	// India Standard Time is UTC+05:30 all year (no DST), so plain offset math is exact.
	const IST = 330 * 60_000;
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	type Parts = { y: number; m: number; d: number; hh: number; mm: number };
	export function istParts(iso: string): Parts {
		const t = new Date(Date.parse(iso) + IST);
		return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
	}
	export const istIso = (p: Parts) => new Date(Date.UTC(p.y, p.m, p.d, p.hh, p.mm) - IST).toISOString();
	const dayKey = (y: number, m: number, d: number) => y * 10_000 + m * 100 + d;
	const time12 = (hh: number, mm: number) => `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;

	/** "Tue 21 Oct, 10:00 AM IST" (same output on server and client). */
	export function formatIst(iso: string): string {
		const p = istParts(iso);
		const wd = DAYS[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()];
		return `${wd} ${p.d} ${MONTHS[p.m]}, ${time12(p.hh, p.mm)} IST`;
	}
</script>

<script lang="ts">
	// Date + time picker in IST (port of easy-business DatePicker): Monday-first month grid with 44px days
	// and a time list in 15-minute steps. Popover on desktop, bottom sheet on phones. Value is a UTC ISO
	// string; the hidden input `name` carries it for form actions.
	import { CalendarClock, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import Dropdown from './Dropdown.svelte';

	interface Props {
		value: string | null;
		name?: string;
		/** Earliest allowed moment (ISO). Earlier days are disabled. */
		min?: string;
		label?: string;
		id?: string;
	}
	let { value = $bindable(null), name, min, label = 'Date and time', id }: Props = $props();

	let open = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let view = $state({ y: 2026, m: 0 });
	let focusKey = $state(0);
	let grid = $state<HTMLDivElement>();
	let times = $state<HTMLUListElement>();
	const uid = $props.id();

	const cur = $derived(value ? istParts(value) : null);
	const minP = $derived(min ? istParts(min) : null);
	const minKey = $derived(minP ? dayKey(minP.y, minP.m, minP.d) : 0);

	function show() {
		const p = cur ?? (min ? istParts(min) : istParts(new Date().toISOString()));
		view = { y: p.y, m: p.m };
		focusKey = dayKey(p.y, p.m, p.d);
		open = true;
		// After the sheet / popover has laid out.
		setTimeout(() => {
			grid?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
			// Scroll the time list to the chosen time, else the earliest allowed one, else 9 AM.
			const mp = min ? istParts(min) : null;
			const m = cur ? cur.hh * 60 + cur.mm : mp && dayKey(p.y, p.m, p.d) === minKey ? mp.hh * 60 + mp.mm : 540;
			const el = [...(times?.querySelectorAll<HTMLElement>('[data-m]') ?? [])].find((b) => Number(b.dataset.m) >= m);
			if (el && times) times.scrollTop = el.offsetTop;
		}, 50);
	}

	const cells = $derived.by(() => {
		const first = new Date(Date.UTC(view.y, view.m, 1));
		const lead = (first.getUTCDay() + 6) % 7; // Monday first
		return Array.from({ length: 42 }, (_, i) => {
			const d = new Date(Date.UTC(view.y, view.m, 1 - lead + i));
			const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
			return { y, m, d: day, key: dayKey(y, m, day), out: m !== view.m };
		});
	});
	const todayKey = $derived.by(() => {
		const p = istParts(new Date().toISOString());
		return dayKey(p.y, p.m, p.d);
	});
	const slots = $derived.by(() => {
		const list = Array.from({ length: 96 }, (_, i) => ({ hh: Math.floor(i / 4), mm: (i % 4) * 15 }));
		if (cur && cur.mm % 15) list.push({ hh: cur.hh, mm: cur.mm }), list.sort((a, b) => a.hh * 60 + a.mm - (b.hh * 60 + b.mm));
		return list;
	});

	function stepMonth(n: number) {
		const d = new Date(Date.UTC(view.y, view.m + n, 1));
		view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
	}

	function set(p: Parts) {
		let iso = istIso(p);
		if (min && Date.parse(iso) < Date.parse(min)) iso = min;
		value = iso;
	}

	function pickDay(c: { y: number; m: number; d: number; key: number }) {
		if (c.key < minKey) return;
		const t = cur ?? { hh: 10, mm: 0 };
		set({ y: c.y, m: c.m, d: c.d, hh: t.hh, mm: t.mm });
		focusKey = c.key;
		if (c.m !== view.m) view = { y: c.y, m: c.m };
	}

	function pickTime(hh: number, mm: number) {
		const base = cur ?? (minP ? { ...minP } : istParts(new Date().toISOString()));
		set({ ...base, hh, mm });
		open = false;
		trigger?.focus({ preventScroll: true });
	}

	function gridKey(e: KeyboardEvent) {
		const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
		const c = cells.find((x) => x.key === focusKey);
		if (!c) return;
		if (e.key in moves) {
			e.preventDefault();
			const d = new Date(Date.UTC(c.y, c.m, c.d + moves[e.key]));
			focusKey = dayKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
			if (d.getUTCMonth() !== view.m) view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
			requestAnimationFrame(() => grid?.querySelector<HTMLElement>('[tabindex="0"]')?.focus());
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			pickDay(c);
		}
	}
</script>

{#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
<button
	bind:this={trigger}
	{id}
	type="button"
	class="input kit-dt"
	class:is-open={open}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-label="{label}: {value ? formatIst(value) : 'not set'}"
	onclick={show}
>
	<CalendarClock aria-hidden="true" />
	<span class="kit-dt-value" class:is-placeholder={!value}>{value ? formatIst(value) : 'Pick date and time'}</span>
</button>

<Dropdown bind:open anchor={trigger} title={label} width={520}>
	<div class="kit-dt-pop">
		<div class="kit-cal">
			<div class="kit-cal-head">
				<button type="button" class="icon-btn icon-btn-sm" aria-label="Previous month" onclick={() => stepMonth(-1)}><ChevronLeft /></button>
				<p class="kit-cal-title" aria-live="polite">{MONTHS_LONG[view.m]} {view.y}</p>
				<button type="button" class="icon-btn icon-btn-sm" aria-label="Next month" onclick={() => stepMonth(1)}><ChevronRight /></button>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions (arrow keys move between day buttons) -->
			<div class="kit-cal-grid" role="group" aria-label="{MONTHS_LONG[view.m]} {view.y}" bind:this={grid} onkeydown={gridKey}>
				{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as w, i (i)}<span class="kit-cal-wd" aria-hidden="true">{w}</span>{/each}
				{#each cells as c (c.key)}
					<button
						type="button"
						class="kit-day"
						class:is-out={c.out}
						class:is-today={c.key === todayKey}
						aria-pressed={cur ? c.key === dayKey(cur.y, cur.m, cur.d) : false}
						aria-label="{c.d} {MONTHS_LONG[c.m]} {c.y}"
						disabled={c.key < minKey}
						tabindex={c.key === focusKey ? 0 : -1}
						onclick={() => pickDay(c)}
					>
						{c.d}
					</button>
				{/each}
			</div>
		</div>
		<div class="kit-times">
			<p class="kit-times-title">Time (IST)</p>
			<ul bind:this={times} aria-label="Time (IST)" id="{uid}-times">
				{#each slots as t (t.hh * 60 + t.mm)}
					{@const sel = !!cur && cur.hh === t.hh && cur.mm === t.mm}
					{@const early = !!minP && !!cur && dayKey(cur.y, cur.m, cur.d) === minKey && t.hh * 60 + t.mm < minP.hh * 60 + minP.mm}
					<li>
						<button type="button" aria-pressed={sel} data-m={t.hh * 60 + t.mm} disabled={early} class="kit-time" onclick={() => pickTime(t.hh, t.mm)}>{time12(t.hh, t.mm)}</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</Dropdown>

<style>
	.kit-dt {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		text-align: left;
		cursor: pointer;
	}
	.kit-dt.is-open {
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.18);
	}
	.kit-dt :global(svg) {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		color: hsl(var(--muted-foreground));
	}
	.kit-dt-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.is-placeholder {
		color: hsl(var(--muted-foreground) / 0.8);
	}
	.kit-dt-pop {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.25rem;
	}
	@media (min-width: 768px) {
		.kit-dt-pop {
			flex-direction: row;
			padding: 0.5rem;
		}
	}
	.kit-cal {
		flex: 1;
		min-width: 0;
	}
	.kit-cal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}
	.kit-cal-title {
		font-weight: 700;
		font-size: 0.9375rem;
	}
	.kit-cal-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 2px;
		outline: none;
	}
	.kit-cal-wd {
		display: grid;
		place-items: center;
		height: 28px;
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.kit-day {
		height: 44px;
		border-radius: 10px;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		transition: background-color 0.12s;
	}
	@media (min-width: 768px) and (pointer: fine) {
		.kit-day {
			height: 38px;
		}
	}
	.kit-day:hover:not(:disabled) {
		background: hsl(var(--muted));
	}
	.kit-day:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: -2px;
	}
	.kit-day.is-out {
		color: hsl(var(--muted-foreground) / 0.7);
	}
	.kit-day.is-today {
		font-weight: 700;
		box-shadow: inset 0 0 0 1px hsl(var(--border));
	}
	.kit-day[aria-pressed='true'] {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-weight: 700;
	}
	.kit-day:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.kit-times {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	@media (min-width: 768px) {
		.kit-times {
			width: 8.5rem;
			border-left: 1px solid hsl(var(--border));
			padding-left: 0.75rem;
		}
	}
	.kit-times-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		padding: 0.5rem 0.25rem;
	}
	.kit-times ul {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		max-height: 12rem;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 2px;
	}
	@media (min-width: 768px) {
		.kit-times ul {
			max-height: 19rem;
			grid-template-columns: 1fr;
		}
	}
	.kit-time {
		width: 100%;
		min-height: 44px;
		border-radius: 10px;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	@media (min-width: 768px) and (pointer: fine) {
		.kit-time {
			min-height: 36px;
		}
	}
	.kit-time:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.kit-time:hover:not(:disabled) {
		background: hsl(var(--muted));
	}
	.kit-time:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: -2px;
	}
	.kit-time[aria-pressed='true'] {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		font-weight: 600;
	}
</style>
