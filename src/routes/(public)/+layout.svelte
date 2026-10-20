<script lang="ts">
	import { page } from '$app/state';
	import Brand from '$lib/components/Brand.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	const signedIn = $derived(!!data.user);
	const onSignIn = $derived(page.url.pathname === '/signin');
</script>

<div class="public-shell">
	<header class="public-bar">
		<div class="public-bar-inner">
			<Brand />
			<nav class="public-nav" aria-label="Marketing">
				<a href="/#inside">Papers, courses, notes</a>
			</nav>
			<div class="public-actions">
				<ThemeToggle />
				{#if signedIn}
					<a class="btn-primary btn-sm no-underline" href="/home">Open app</a>
				{:else}
					{#if !onSignIn}
						<a class="btn-primary btn-sm no-underline" href="/signin">Start practice</a>
					{/if}
				{/if}
			</div>
		</div>
	</header>

	{@render children()}

	<footer class="public-foot">
		<div class="public-foot-inner">
			<div>
				<p class="brand foot-brand">
					<img src="/brand/uci.png" alt="" width="40" height="40" />
					<span class="brand-name">
						Upendra
						<span class="brand-sub">Competition Institute · Sehore</span>
					</span>
				</p>
				<p class="meta mt-2 max-w-sm">
					Timed practice for SSC, Railways, Police, Defence, and Agniveer — with a server clock you can trust.
				</p>
			</div>
			<nav class="foot-links" aria-label="Legal and account">
				<a href="/signin">Sign in</a>
				<a href="/terms">Terms</a>
				<a href="/privacy">Privacy</a>
				<a href="/cookies">Cookies</a>
			</nav>
		</div>
		<p class="meta foot-copy">
			© {new Date().getFullYear()} Upendra Competition Institute, Sehore. Draft policies — attorney review before production.
		</p>
	</footer>
</div>

<style>
	.public-shell {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}
	.public-bar {
		position: sticky;
		top: 0;
		z-index: 30;
		padding-top: env(safe-area-inset-top);
		background: color-mix(in oklab, hsl(var(--surface)) 90%, transparent);
		border-bottom: 1px solid hsl(var(--border) / 0.7);
		backdrop-filter: blur(16px) saturate(1.4);
		-webkit-backdrop-filter: blur(16px) saturate(1.4);
	}
	.public-bar-inner {
		display: flex;
		align-items: center;
		gap: 1rem;
		max-width: 72rem;
		margin-inline: auto;
		padding: 0.75rem var(--gutter, 1rem);
		min-height: 3.5rem;
	}
	.public-nav {
		display: none;
		align-items: center;
		gap: 1.25rem;
		margin-left: 1rem;
		flex: 1;
	}
	@media (min-width: 768px) {
		.public-nav {
			display: flex;
		}
	}
	.public-nav a {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
	}
	.public-nav a:hover {
		color: hsl(var(--foreground));
	}
	@media (max-width: 640px) {
		.public-bar :global(.brand-name) {
			display: none;
		}
	}
	.public-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.public-foot {
		margin-top: auto;
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		padding: 2.5rem var(--gutter, 1rem) calc(1.5rem + env(safe-area-inset-bottom));
	}
	.public-foot-inner {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 2rem;
		max-width: 72rem;
		margin-inline: auto;
	}
	.foot-brand {
		font-weight: 700;
	}
	.foot-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.25rem;
	}
	.foot-links a {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
	}
	.foot-links a:hover {
		color: hsl(var(--primary));
	}
	.foot-copy {
		max-width: 72rem;
		margin: 1.75rem auto 0;
		font-size: 0.75rem;
	}
</style>
