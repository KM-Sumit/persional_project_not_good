<script lang="ts">
	import { page } from '$app/state';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import House from '@lucide/svelte/icons/house';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { haptic } from '$lib/components/motion';

	const tabs = [
		{ href: '/home', label: 'Home', icon: House, match: (p: string) => p === '/home' },
		{
			href: '/tests',
			label: 'Tests',
			icon: SquareCheck,
			match: (p: string) =>
				p === '/tests' || p.startsWith('/tests/') || p.startsWith('/attempts/')
		},
		{
			href: '/study',
			label: 'Study',
			icon: BookOpen,
			match: (p: string) =>
				p === '/study' ||
				p.startsWith('/study/') ||
				p.startsWith('/courses') ||
				p.startsWith('/notes')
		},
		{
			href: '/profile',
			label: 'You',
			icon: UserRound,
			match: (p: string) => p === '/profile' || p.startsWith('/profile/')
		}
	] as const;

	const path = $derived(page.url.pathname);
	const active = $derived(tabs.findIndex((t) => t.match(path)));
</script>

<nav class="tabbar" aria-label="Primary">
	<div class="tabbar-inner">
		{#if active >= 0}
			<span class="pill-track" style="transform: translateX({active * 100}%)" aria-hidden="true">
				<span class="pill"></span>
			</span>
		{/if}
		{#each tabs as tab, i (tab.href)}
			{@const Icon = tab.icon}
			<a
				href={tab.href}
				class="tab"
				aria-current={i === active ? 'page' : undefined}
				onclick={() => i !== active && haptic()}
			>
				<span class="tab-icon">
					<Icon class="size-[22px]" strokeWidth={i === active ? 2.4 : 1.8} aria-hidden="true" />
				</span>
				<span class="tab-label">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.tabbar {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		z-index: 40;
		padding-bottom: env(safe-area-inset-bottom);
		background: color-mix(in oklab, hsl(var(--surface)) 94%, transparent);
		border-top: 1px solid hsl(var(--border));
		backdrop-filter: blur(20px) saturate(1.4);
		-webkit-backdrop-filter: blur(20px) saturate(1.4);
	}
	.tabbar-inner {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		height: 4rem;
		max-width: 32rem;
		margin-inline: auto;
	}
	.pill-track {
		position: absolute;
		inset-block: 0;
		left: 0;
		width: 25%;
		display: grid;
		place-items: center;
		pointer-events: none;
		transition: transform 220ms var(--ease-material);
	}
	.pill {
		width: 4rem;
		height: 2rem;
		margin-top: -1.15rem;
		border-radius: 999px;
		background: hsl(var(--primary) / 0.12);
	}
	.tab {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		min-height: 44px;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
		user-select: none;
		transition: color 160ms var(--ease-material);
	}
	.tab[aria-current='page'] {
		color: hsl(var(--primary));
	}
	.tab-icon {
		display: grid;
		place-items: center;
		height: 2rem;
		transition: transform var(--dur-fast) var(--ease-interactive);
	}
	:global(html[data-platform='ios']) .tab:active .tab-icon,
	:global(html[data-platform='android']) .tab:active .tab-icon {
		transform: scale(0.9);
	}
	.tab-label {
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1;
	}

	:global(html[data-platform='ios']) .tabbar {
		left: 1rem;
		right: 1rem;
		bottom: max(env(safe-area-inset-bottom), 0.75rem);
		padding-bottom: 0;
		border: 1px solid hsl(var(--border) / 0.7);
		border-radius: 999px;
		background: color-mix(in oklab, hsl(var(--surface)) 92%, transparent);
		box-shadow: 0 8px 24px -12px hsl(0 0% 0% / 0.22);
		max-width: 26rem;
		margin-inline: auto;
	}
	:global(html[data-platform='ios']) .tabbar-inner {
		padding: 0.25rem;
	}
	:global(html[data-platform='ios']) .pill-track {
		inset-block: 0.25rem;
		left: 0.25rem;
		width: calc((100% - 0.5rem) / 4);
		transition: transform 260ms var(--ease-snappy);
	}
	:global(html[data-platform='ios']) .pill {
		width: calc(100% - 0.25rem);
		height: 100%;
		margin: 0;
		border-radius: 999px;
	}

	/* Narrow desktop window: edge bar, not a floating toy capsule. */
	@media (min-width: 640px) {
		:global(html[data-platform='desktop']) .tabbar {
			/* Keep edge bar — floating capsules feel playful on pointer UIs. */
			left: 0;
			right: 0;
			bottom: 0;
			width: auto;
			max-width: none;
			transform: none;
			border-radius: 0;
			border: 0;
			border-top: 1px solid hsl(var(--border));
			box-shadow: none;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}

	@media (min-width: 1024px) {
		.tabbar {
			display: none;
		}
	}
</style>
