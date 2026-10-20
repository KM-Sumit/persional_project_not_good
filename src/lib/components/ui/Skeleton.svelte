<script lang="ts">
	// Loading placeholder. One block by default; `rows` draws a list-row skeleton (icon + two lines) n times.
	let { class: cls = 'h-4 w-full', rows = 0 }: { class?: string; rows?: number } = $props();
</script>

{#if rows}
	<div class="list" aria-hidden="true">
		{#each Array(rows) as _, i (i)}
			<div class="list-row">
				<div class="skeleton size-10 rounded-xl"></div>
				<div class="grow space-y-2">
					<div class="skeleton h-3.5 w-2/3"></div>
					<div class="skeleton h-3 w-1/3"></div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="skeleton {cls}" aria-hidden="true"></div>
{/if}
