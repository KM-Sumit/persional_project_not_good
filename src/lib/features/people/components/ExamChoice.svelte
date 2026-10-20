<script lang="ts">
	// Target-exam picker: exams grouped by category as OMR-style radio chips. Native radios, so it posts with the form.
	import type { CategoryDTO } from '#lib/features/taxonomy/schema';

	let { categories, value = null, name = 'targetExamId' }: { categories: CategoryDTO[]; value?: string | null; name?: string } =
		$props();
</script>

<div class="stack">
	{#each categories as c (c.id)}
		{#if c.exams.length}
			<fieldset>
				<legend class="eyebrow mb-2">{c.name}</legend>
				<div class="exam-grid">
					{#each c.exams as e (e.id)}
						<label class="omr">
							<input type="radio" {name} value={e.id} checked={value === e.id} required />
							<span class="omr-bubble" aria-hidden="true"></span>
							<span class="omr-text">{e.name}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
	{/each}
</div>

<style>
	.exam-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
	}
</style>
