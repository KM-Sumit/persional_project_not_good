<script lang="ts">
	// The CBT legend: each state has a colour AND a shape, so it reads without colour too.
	import { STATE_LABEL, STATE_ORDER, type QState } from './exam';
	import './pshape.css';

	let { counts }: { counts?: Record<QState, number> } = $props();
</script>

<ul class="legend">
	{#each STATE_ORDER as s (s)}
		<li>
			<span class="pshape" data-state={s} aria-hidden="true">{counts ? counts[s] : ''}</span>
			<span>{STATE_LABEL[s]}</span>
		</li>
	{/each}
</ul>

<style>
	.legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem 0.75rem; font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
	.legend li { display: flex; align-items: center; gap: 0.5rem; min-width: 0; line-height: 1.25; }
	.legend li:last-child { grid-column: 1 / -1; }
	.legend .pshape { width: 26px; height: 26px; font-size: 0.6875rem; }
</style>
