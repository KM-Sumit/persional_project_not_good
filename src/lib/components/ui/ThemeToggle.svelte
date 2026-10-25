<script lang="ts">
	// Light/dark switch. Default is the same 44px icon button as the app bar bell, so bar icons match. app.html sets the .dark class before
	// paint, so both icons are rendered and CSS picks one: the server HTML already shows the right icon.
	import { Moon, Sun } from '@lucide/svelte';

	let { class: klass = 'icon-btn' }: { class?: string } = $props();

	// The OS-keyed theme-color metas would otherwise keep the wrong status bar colour after a manual pick.
	const paintThemeColor = (dark: boolean) => {
		for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#0f1218' : '#f4f6f8');
	};
	$effect(() => paintThemeColor(document.documentElement.classList.contains('dark')));

	function toggle() {
		const dark = document.documentElement.classList.toggle('dark');
		paintThemeColor(dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {}
	}
</script>

<button type="button" class={klass} onclick={toggle} aria-label="Switch light or dark mode" title="Light or dark mode">
	<Sun class="dark:hidden" aria-hidden="true" /><Moon class="hidden dark:block" aria-hidden="true" />
</button>
