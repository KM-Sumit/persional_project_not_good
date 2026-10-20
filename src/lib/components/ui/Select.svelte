<script lang="ts">
	// App-styled select (same behaviour as teacher/Dropdown, the Django select.js port). The list opens
	// in the top layer (popover) next to the field, above it when there's no room, so it works inside
	// sheets. A hidden input carries `name`, so plain GET/POST forms keep working.
	// Keyboard: arrows, Home/End, Enter/Space, Esc, type a letter to jump.
	type Opt = { value: string; label: string; hint?: string };
	let {
		value = $bindable(''),
		options,
		name,
		id,
		label,
		placeholder = 'Choose…',
		disabled = false,
		required = false,
		onchange
	}: {
		value?: string;
		options: Opt[];
		name?: string;
		id?: string;
		/** aria-label when there's no visible <label for={id}>. */
		label?: string;
		placeholder?: string;
		disabled?: boolean;
		required?: boolean;
		onchange?: (value: string) => void;
	} = $props();

	let open = $state(false);
	let active = $state(0);
	let trigger = $state<HTMLButtonElement>();
	let list = $state<HTMLUListElement>();
	let above = $state(false);
	const uid = $props.id();
	const current = $derived(options.find((o) => o.value === value));

	function place() {
		if (!trigger || !list) return;
		const r = trigger.getBoundingClientRect();
		const below = window.innerHeight - r.bottom - 8;
		above = below < 220 && r.top > below;
		const max = Math.min(320, (above ? r.top : below) - 8);
		Object.assign(list.style, {
			left: `${r.left}px`,
			width: `${r.width}px`,
			maxHeight: `${max}px`,
			top: above ? '' : `${r.bottom + 6}px`,
			bottom: above ? `${window.innerHeight - r.top + 6}px` : ''
		});
	}
	function show() {
		if (disabled || !options.length) return;
		active = Math.max(0, options.findIndex((o) => o.value === value));
		open = true;
		list?.showPopover();
		place();
		list?.children[active]?.scrollIntoView({ block: 'nearest' });
	}
	function hide(focus = true) {
		open = false;
		if (list?.matches(':popover-open')) list.hidePopover();
		if (focus) trigger?.focus();
	}
	function pick(i: number) {
		value = options[i].value;
		onchange?.(value);
		trigger?.closest('form')?.dispatchEvent(new Event('change', { bubbles: true }));
		hide();
	}
	function onkey(e: KeyboardEvent) {
		const n = options.length;
		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
				e.preventDefault();
				show();
			}
			return;
		}
		if (e.key === 'Escape' || e.key === 'Tab') {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation(); // don't also close the surrounding sheet
			}
			hide(e.key === 'Escape');
		} else if (e.key === 'ArrowDown') active = (active + 1) % n;
		else if (e.key === 'ArrowUp') active = (active - 1 + n) % n;
		else if (e.key === 'Home') active = 0;
		else if (e.key === 'End') active = n - 1;
		else if (e.key === 'Enter' || e.key === ' ') pick(active);
		else if (e.key.length === 1) {
			const k = e.key.toLowerCase();
			const j = [...options.keys()].map((x) => (active + 1 + x) % n).find((x) => options[x].label.toLowerCase().startsWith(k));
			if (j !== undefined) active = j;
		} else return;
		e.preventDefault();
		list?.children[active]?.scrollIntoView({ block: 'nearest' });
	}
	$effect(() => {
		if (!open) return;
		const close = (e: Event) => {
			if (e.type === 'scroll' && list?.contains(e.target as Node)) return;
			if (e.type === 'pointerdown' && (trigger?.contains(e.target as Node) || list?.contains(e.target as Node))) return;
			hide(false);
		};
		addEventListener('pointerdown', close, true);
		addEventListener('scroll', close, true);
		addEventListener('resize', close);
		return () => {
			removeEventListener('pointerdown', close, true);
			removeEventListener('scroll', close, true);
			removeEventListener('resize', close);
		};
	});
</script>

{#if name}<input type="hidden" {name} {value} {required} />{/if}
<button
	bind:this={trigger}
	{id}
	{disabled}
	type="button"
	class="select select-trigger"
	class:is-open={open}
	role="combobox"
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-controls="{uid}-list"
	aria-label={label}
	aria-activedescendant={open ? `${uid}-${active}` : undefined}
	onclick={() => (open ? hide() : show())}
	onkeydown={onkey}
>
	<span class="select-value" class:is-placeholder={!current}>{current?.label ?? placeholder}</span>
</button>
<ul bind:this={list} id="{uid}-list" class="select-list" class:is-above={above} role="listbox" popover="manual" tabindex="-1">
	{#each options as o, i (o.value)}
		<li
			id="{uid}-{i}"
			role="option"
			aria-selected={o.value === value}
			class:is-active={i === active}
			onpointerenter={() => (active = i)}
			onclick={() => pick(i)}
			onkeydown={onkey}
		>
			<span class="min-w-0 flex-1">
				{o.label}
				{#if o.hint}<span class="select-hint">{o.hint}</span>{/if}
			</span>
		</li>
	{/each}
</ul>
