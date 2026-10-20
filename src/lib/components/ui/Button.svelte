<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger' | 'success';
		size?: 'sm' | 'md' | 'lg';
		block?: boolean;
		/** Renders an <a> instead of a <button>. */
		href?: string;
		/** Shows a spinner and blocks clicks; the label stays so the button keeps its width. */
		loading?: boolean;
		children: Snippet;
	};

	let { variant = 'primary', size = 'md', block = false, href, loading = false, class: cls = '', children, ...rest }: Props =
		$props();
	const classes = $derived(
		['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', loading && 'is-loading', cls].filter(Boolean).join(' ')
	);
</script>

{#if href}
	<a {href} class={classes}>{@render children()}</a>
{:else}
	<button type="button" {...rest} class={classes} disabled={rest.disabled || loading} aria-busy={loading || undefined}>
		{#if loading}<span class="btn-spinner" aria-hidden="true"></span>{/if}
		{@render children()}
	</button>
{/if}
