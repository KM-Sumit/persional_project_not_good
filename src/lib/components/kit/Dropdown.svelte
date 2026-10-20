<script lang="ts">
	// Shared surface for kit pickers (port of easy-business Dropdown): a bottom sheet on phones, an anchored
	// popover from 768px. The popover lives in the top layer (popover API), so it works inside dialogs too.
	import type { Snippet } from 'svelte';
	import Sheet from '../ui/Sheet.svelte';

	interface Props {
		open?: boolean;
		/** The trigger the popover anchors to (desktop); focus returns here on close. */
		anchor: HTMLElement | undefined;
		title: string;
		/** Popover width in px; defaults to the trigger width (min 260). */
		width?: number;
		children: Snippet;
	}
	let { open = $bindable(false), anchor, title, width, children }: Props = $props();

	let wide = $state(false);
	$effect(() => {
		const mq = matchMedia('(min-width: 768px)');
		const set = () => (wide = mq.matches);
		set();
		mq.addEventListener('change', set);
		return () => mq.removeEventListener('change', set);
	});

	let panel = $state<HTMLDivElement>();

	function place() {
		if (!anchor || !panel) return;
		const r = anchor.getBoundingClientRect();
		const w = Math.min(Math.max(width ?? r.width, 260), innerWidth - 24);
		const gap = 6;
		const below = innerHeight - r.bottom - gap - 12;
		const aboveRoom = r.top - gap - 12;
		const need = Math.min(440, Math.max(160, panel.scrollHeight));
		const flip = below < need && aboveRoom > below;
		const left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
		Object.assign(panel.style, {
			left: `${left}px`,
			width: `${w}px`,
			maxHeight: `${Math.min(440, Math.max(160, flip ? aboveRoom : below))}px`,
			top: flip ? '' : `${r.bottom + gap}px`,
			bottom: flip ? `${innerHeight - r.top + gap}px` : ''
		});
	}

	function close(focus = true) {
		open = false;
		if (focus) anchor?.focus({ preventScroll: true });
	}

	$effect(() => {
		if (!wide || !panel) return;
		const p = panel;
		if (!open) {
			if (p.matches(':popover-open')) p.hidePopover();
			return;
		}
		if (!p.matches(':popover-open')) p.showPopover();
		place();
		const onDown = (e: PointerEvent) => {
			const t = e.target as Node;
			if (!p.contains(t) && !anchor?.contains(t)) close(false);
		};
		// Capture + stop: over a sheet, Esc closes only the popover.
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				close();
			}
		};
		const onScroll = (e: Event) => !p.contains(e.target as Node) && place();
		addEventListener('pointerdown', onDown, true);
		addEventListener('keydown', onKey, true);
		addEventListener('resize', place);
		addEventListener('scroll', onScroll, true);
		return () => {
			removeEventListener('pointerdown', onDown, true);
			removeEventListener('keydown', onKey, true);
			removeEventListener('resize', place);
			removeEventListener('scroll', onScroll, true);
		};
	});
</script>

{#if wide}
	<div bind:this={panel} popover="manual" class="kit-pop" role="dialog" aria-label={title}>
		{#if open}{@render children()}{/if}
	</div>
{:else}
	<Sheet bind:open {title}>
		{#if open}{@render children()}{/if}
	</Sheet>
{/if}

<style>
	.kit-pop {
		position: fixed;
		inset: auto;
		margin: 0;
		padding: 0.25rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border-radius: 14px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		color: hsl(var(--foreground));
		box-shadow: var(--shadow-lg);
	}
	.kit-pop:popover-open {
		animation: kit-fade 0.12s var(--ease-smooth);
	}
	@keyframes kit-fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kit-pop:popover-open {
			animation: none;
		}
	}
</style>
