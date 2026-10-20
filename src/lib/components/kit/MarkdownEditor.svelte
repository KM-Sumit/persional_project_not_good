<script lang="ts">
	// Markdown textarea with a small toolbar and Write / Preview tabs. Preview is rendered by the server
	// (POST /api/markdown) with the same renderer the student pages use, so what you see is what ships.
	// Shortcuts: Ctrl/Cmd+B bold, Ctrl/Cmd+I italic, Ctrl/Cmd+K link.
	import { Bold, Heading2, Italic, Link, List, Sigma } from '@lucide/svelte';
	import Tabs from '../ui/Tabs.svelte';
	import Markdown from './Markdown.svelte';

	interface Props {
		value: string;
		name?: string;
		rows?: number;
		placeholder?: string;
	}
	let { value = $bindable(''), name, rows = 12, placeholder = 'Write in Markdown. Use $x^2$ for maths.' }: Props = $props();

	let tab = $state('write');
	let area = $state<HTMLTextAreaElement>();
	let html = $state('');
	let loading = $state(false);
	let failed = $state('');
	let rendered: string | null = null;
	const uid = $props.id();

	/** Wraps the selection (or inserts a placeholder) and keeps the selection on the inner text. */
	function wrap(before: string, after = before, fallback = 'text') {
		if (!area) return;
		const { selectionStart: s, selectionEnd: e } = area;
		const inner = value.slice(s, e) || fallback;
		value = value.slice(0, s) + before + inner + after + value.slice(e);
		requestAnimationFrame(() => {
			area?.focus();
			area?.setSelectionRange(s + before.length, s + before.length + inner.length);
		});
	}
	/** Prefixes every selected line (headings, lists). */
	function prefix(p: string) {
		if (!area) return;
		const s = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
		const e = area.selectionEnd;
		const block = value.slice(s, e) || '';
		const next = block
			.split('\n')
			.map((l) => (l.startsWith(p) ? l : p + l))
			.join('\n');
		value = value.slice(0, s) + next + value.slice(e);
		requestAnimationFrame(() => {
			area?.focus();
			area?.setSelectionRange(s + next.length, s + next.length);
		});
	}

	const tools = [
		{ label: 'Bold', icon: Bold, run: () => wrap('**') },
		{ label: 'Italic', icon: Italic, run: () => wrap('_') },
		{ label: 'Heading', icon: Heading2, run: () => prefix('## ') },
		{ label: 'List', icon: List, run: () => prefix('- ') },
		{ label: 'Link', icon: Link, run: () => wrap('[', '](https://)', 'link text') },
		{ label: 'Maths', icon: Sigma, run: () => wrap('$', '$', 'x^2') }
	];

	function onkey(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey)) return;
		const k = e.key.toLowerCase();
		const t = k === 'b' ? tools[0] : k === 'i' ? tools[1] : k === 'k' ? tools[4] : null;
		if (!t) return;
		e.preventDefault();
		t.run();
	}

	async function preview() {
		if (rendered === value) return;
		loading = true;
		failed = '';
		try {
			const res = await fetch('/api/markdown', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ md: value })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Could not render the preview.');
			html = (await res.json()).html;
			rendered = value;
		} catch (e) {
			failed = (e as Error).message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="kit-md">
	<div class="kit-md-bar">
		<Tabs
			label="Editor mode"
			bind:value={tab}
			items={[
				{ value: 'write', label: 'Write' },
				{ value: 'preview', label: 'Preview' }
			]}
			onchange={(v) => v === 'preview' && preview()}
		/>
		{#if tab === 'write'}
			<div class="kit-md-tools" role="toolbar" aria-label="Formatting" aria-controls="{uid}-area">
				{#each tools as t (t.label)}
					<button type="button" class="icon-btn icon-btn-sm" title={t.label} aria-label={t.label} onclick={t.run}><t.icon /></button>
				{/each}
			</div>
		{/if}
	</div>
	<textarea
		bind:this={area}
		id="{uid}-area"
		class="textarea kit-md-area"
		class:hidden={tab !== 'write'}
		bind:value
		{name}
		{rows}
		{placeholder}
		onkeydown={onkey}
		spellcheck="true"
	></textarea>
	{#if tab === 'preview'}
		<div class="kit-md-preview" aria-live="polite" aria-busy={loading}>
			{#if loading}
				<div class="stack-sm" aria-label="Loading preview">
					<div class="skeleton h-5 w-2/3"></div>
					<div class="skeleton h-4 w-full"></div>
					<div class="skeleton h-4 w-5/6"></div>
				</div>
			{:else if failed}
				<p class="error">{failed} <button type="button" class="btn btn-ghost btn-sm" onclick={preview}>Try again</button></p>
			{:else if !value.trim()}
				<p class="muted">Nothing to preview yet.</p>
			{:else}
				<Markdown {html} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.kit-md {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.kit-md-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.kit-md-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.125rem;
	}
	.kit-md-area {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	@media (max-width: 767px) {
		.kit-md-area {
			font-size: 16px;
		}
	}
	.kit-md-preview {
		min-height: 8rem;
		padding: 0.875rem 1rem;
		border: 1px solid hsl(var(--input));
		border-radius: 12px;
		background: hsl(var(--surface));
	}
</style>
