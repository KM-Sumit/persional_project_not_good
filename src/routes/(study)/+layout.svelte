<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import AppBar from '$lib/components/AppBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import { haptic, navDirection, type NavDirection } from '$lib/components/motion';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const path = $derived(page.url.pathname);
	const exam = $derived(/^\/attempts\/[^/]+$/.test(path));

	let nav = $state<NavDirection | undefined>();
	let clearTimer: ReturnType<typeof setTimeout> | undefined;

	beforeNavigate((n) => {
		if (!n.from?.url || !n.to?.url || n.willUnload) return;
		if (n.from.url.pathname === n.to.url.pathname) return;
		if (
			n.type === 'popstate' &&
			(n.event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition
		) {
			nav = undefined;
			return;
		}
		const link = n.type === 'link' ? (n.event.target as Element | null)?.closest('a') : null;
		nav = navDirection(n.from.url.pathname, n.to.url.pathname, {
			pop: n.type === 'popstate' ? n.delta : 0,
			back: link?.hasAttribute('data-back')
		});
		const roots = ['/home', '/tests', '/study', '/profile'];
		const fromTab = roots.some(
			(r) => n.from!.url.pathname === r || n.from!.url.pathname.startsWith(r + '/')
		);
		const toTab = roots.some(
			(r) => n.to!.url.pathname === r || n.to!.url.pathname.startsWith(r + '/')
		);
		if (fromTab && toTab) haptic();
		clearTimeout(clearTimer);
		clearTimer = setTimeout(() => (nav = undefined), 600);
	});

	function endEnter(e: AnimationEvent) {
		if (e.target === e.currentTarget) nav = undefined;
	}
</script>

<div class="shell has-sidebar" style:--bottom-space={exam ? '0px' : 'var(--tabbar-space)'}>
	<Sidebar />
	<div class="shell-main">
		<AppBar />
		<main class="flex min-w-0 flex-1 flex-col overflow-x-clip">
			{#key path}
				<div
					class={['page-view pt-4 lg:pt-7', { exam }]}
					data-nav={nav}
					onanimationend={endEnter}
				>
					{@render children()}
				</div>
			{/key}
		</main>
	</div>
	{#if !exam}
		<TabBar />
	{/if}
</div>
