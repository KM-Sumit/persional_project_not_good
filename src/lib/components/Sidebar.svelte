<script lang="ts">
	import { page } from '$app/state';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import House from '@lucide/svelte/icons/house';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Brand from '$lib/components/Brand.svelte';

	const items = [
		{ href: '/home', label: 'Home', icon: House, match: (p: string) => p === '/home' },
		{
			href: '/tests',
			label: 'Tests',
			icon: SquareCheck,
			match: (p: string) => p === '/tests' || p.startsWith('/tests/') || p.startsWith('/attempts/')
		},
		{
			href: '/study',
			label: 'Study',
			icon: BookOpen,
			match: (p: string) =>
				p === '/study' || p.startsWith('/courses') || p.startsWith('/notes')
		},
		{
			href: '/profile',
			label: 'You',
			icon: UserRound,
			match: (p: string) => p === '/profile' || p.startsWith('/profile/')
		}
	] as const;

	const path = $derived(page.url.pathname);
</script>

<aside class="sidebar" aria-label="Sidebar">
	<Brand class="sidebar-brand" href="/home" />
	<nav aria-label="Primary" class="sidebar-nav">
		{#each items as item (item.href)}
			{@const Icon = item.icon}
			{@const active = item.match(path)}
			<a href={item.href} aria-current={active ? 'page' : undefined}>
				<Icon strokeWidth={active ? 2.4 : 1.75} aria-hidden="true" />
				{item.label}
			</a>
		{/each}
	</nav>
	<div class="sidebar-foot">
		<p class="foot-copy">Upendra Competition Institute, Sehore</p>
		<ThemeToggle />
	</div>
</aside>

<style>
	.sidebar {
		display: none;
		position: sticky;
		top: 0;
		flex-shrink: 0;
		flex-direction: column;
		width: var(--sidebar-w, 15.5rem);
		height: 100svh;
		padding: 1.25rem 0.75rem calc(1rem + env(safe-area-inset-bottom));
		border-right: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
	}
	@media (min-width: 1024px) {
		.sidebar {
			display: flex;
		}
	}
	.sidebar :global(.sidebar-brand) {
		margin: 0 0.35rem 1.5rem;
		padding: 0.35rem 0.5rem;
	}
	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.sidebar-nav a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 2.75rem;
		padding: 0 0.85rem;
		border-radius: 12px;
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color 140ms var(--ease-material),
			color 140ms var(--ease-material);
	}
	.sidebar-nav a :global(svg) {
		width: 20px;
		height: 20px;
	}
	.sidebar-nav a:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}
	.sidebar-nav a[aria-current='page'] {
		background: hsl(var(--primary) / 0.12);
		color: hsl(var(--primary));
	}
	.sidebar-foot {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.35rem;
	}
	.foot-copy {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.35;
		color: hsl(var(--muted-foreground));
	}
</style>
