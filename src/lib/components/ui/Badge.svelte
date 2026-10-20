<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** live = pulsing dot. success/warning are the same colours without the pulse. */
		tone?: 'default' | 'live' | 'draft' | 'closed' | 'primary' | 'danger' | 'success' | 'warning';
		class?: string;
		children: Snippet;
	}

	let { tone = 'default', class: cls = '', children }: Props = $props();
</script>

<span class="badge {tone !== 'default' ? `badge-${tone}` : ''} {cls}">
	{@render children()}
</span>
