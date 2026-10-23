<script lang="ts">
	import { onMount } from 'svelte';
	import { readPaperLang, writePaperLang, type PaperLang } from './paper';

	let { value = $bindable<PaperLang>('en') }: { value?: PaperLang } = $props();

	onMount(() => {
		value = readPaperLang();
	});

	function pick(lang: PaperLang) {
		value = lang;
		writePaperLang(lang);
	}
</script>

<div class="lang-row">
	<p class="small muted">Attempt in</p>
	<div class="segmented" role="tablist" aria-label="Test language">
		<button type="button" role="tab" aria-selected={value === 'en'} onclick={() => pick('en')}>English</button>
		<button type="button" role="tab" aria-selected={value === 'hi'} onclick={() => pick('hi')}>हिंदी</button>
	</div>
</div>

<style>
	.lang-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.segmented {
		flex: 0 1 16rem;
	}
</style>
