<script lang="ts">
	import { CircleAlert, CircleCheck, TriangleAlert, X } from '@lucide/svelte';
	import { dismissToast, toasts } from './toast.svelte';

	const icons = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert };
</script>

<div class="toasts" role="status" aria-live="polite">
	{#each toasts as t (t.id)}
		{@const Icon = icons[t.tone]}
		<div class="toast is-{t.tone}">
			<Icon class="toast-icon" />
			<span class="msg">{t.message}</span>
			<button type="button" onclick={() => dismissToast(t.id)} aria-label="Dismiss"><X /></button>
		</div>
	{/each}
</div>
