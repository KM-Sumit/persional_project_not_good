<script lang="ts">
	// Numbered question map in CBT shapes. The current question gets a ring; tapping jumps to it.
	import { STATE_LABEL, type QState } from './exam';
	import './pshape.css';

	let { states, current, onjump }: { states: QState[]; current: number; onjump: (i: number) => void } = $props();
</script>

<div class="pgrid">
	{#each states as s, i (i)}
		<button
			type="button"
			class="pbtn"
			class:is-current={i === current}
			aria-label="Question {i + 1}: {STATE_LABEL[s]}"
			aria-current={i === current ? 'step' : undefined}
			onclick={() => onjump(i)}
		>
			<span class="pshape" data-state={s}>{i + 1}</span>
		</button>
	{/each}
</div>

<style>
	.pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 0.375rem; }
	.pbtn { display: grid; place-items: center; min-height: 44px; border-radius: 12px; outline-offset: 1px; }
	.pbtn:hover { background: hsl(var(--muted)); }
	.pbtn.is-current { outline: 2px solid hsl(var(--primary)); }
	.pbtn .pshape { width: 36px; height: 36px; font-size: 0.8125rem; }
</style>
