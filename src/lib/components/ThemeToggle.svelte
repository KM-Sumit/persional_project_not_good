<script lang="ts">
	/** CampusQuiz pattern: sun/moon in chrome; `.dark` on <html> before paint. */
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	let { class: klass = 'icon-btn' }: { class?: string } = $props();

	const paintThemeColor = (dark: boolean) => {
		for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
			m.setAttribute('content', dark ? '#161311' : '#faf6f2');
		}
	};

	$effect(() => {
		paintThemeColor(document.documentElement.classList.contains('dark'));
	});

	function toggle() {
		const dark = document.documentElement.classList.toggle('dark');
		paintThemeColor(dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {
			/* private mode */
		}
	}
</script>

<button
	type="button"
	class={klass}
	onclick={toggle}
	aria-label="Switch light or dark mode"
	title="Light or dark mode"
>
	<Sun class="hidden dark:block" aria-hidden="true" />
	<Moon class="dark:hidden" aria-hidden="true" />
</button>
