<script lang="ts">
	// Read-only MCQ: prompt, options as small OMR rows with the correct one filled, optional explanation.
	import { LETTERS } from './format';

	let {
		prompt,
		options,
		correctIndex,
		explanation = '',
		number,
		compact = false
	}: { prompt: string; options: string[]; correctIndex: number; explanation?: string; number?: number; compact?: boolean } = $props();
</script>

<div class="qv">
	<p class="qv-prompt">
		{#if number != null}<span class="qv-num font-mono tabular">Q{number}</span>{/if}{prompt}
	</p>
	<ol class="qv-opts" class:is-compact={compact}>
		{#each options as o, i (i)}
			<li class:is-correct={i === correctIndex}>
				<span class="qv-bubble" aria-hidden="true">{LETTERS[i]}</span>
				<span class="min-w-0">{o}</span>
				{#if i === correctIndex}<span class="sr-only">(correct)</span>{/if}
			</li>
		{/each}
	</ol>
	{#if explanation && !compact}<p class="qv-exp"><span class="font-semibold">Explanation.</span> {explanation}</p>{/if}
</div>

<style>
	.qv {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	.qv-prompt {
		font-weight: 500;
		line-height: 1.45;
		overflow-wrap: anywhere;
		white-space: pre-line;
	}
	.qv-num {
		margin-right: 0.5rem;
		font-size: 0.8rem;
		color: hsl(var(--muted-foreground));
	}
	.qv-opts {
		display: grid;
		gap: 0.25rem 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: 0.875rem;
	}
	@media (min-width: 640px) {
		.qv-opts.is-compact {
			grid-template-columns: 1fr 1fr;
		}
	}
	.qv-opts li {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		overflow-wrap: anywhere;
		color: hsl(var(--muted-foreground));
	}
	.qv-opts li.is-correct {
		color: hsl(var(--foreground));
		font-weight: 600;
	}
	.qv-bubble {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--foreground) / 0.35);
		font: 600 0.7rem var(--font-mono);
	}
	.is-correct .qv-bubble {
		background: hsl(var(--success));
		border-color: hsl(var(--success));
		color: hsl(var(--surface));
	}
	.qv-exp {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
