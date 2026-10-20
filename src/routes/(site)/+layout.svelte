<script lang="ts">
	// Public website chrome: sticky header (menu sheet on phones), footer with legal links, and a fixed
	// call / WhatsApp / enquire bar on phones (how Indian coaching enquiries actually arrive).
	import { page } from '$app/state';
	import { beforeNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ArrowRight, Menu, MessageCircle, Phone, X } from '@lucide/svelte';
	import Brand from '#lib/components/shell/Brand.svelte';
	import ThemeToggle from '#lib/components/ui/ThemeToggle.svelte';

	let { data, children } = $props();

	const links = [
		{ href: '/exams', label: 'Exams' },
		{ href: '/courses', label: 'Courses' },
		{ href: '/results', label: 'Results' },
		{ href: '/faculty', label: 'Faculty' },
		{ href: '/about', label: 'About' },
		{ href: '/contact', label: 'Contact' }
	];
	const path = $derived(page.url.pathname);
	const current = (href: string) => path === href || path.startsWith(href + '/');
	const appHref = $derived(data.user ? (data.user.role === 'student' ? '/app' : '/admin') : null);
	const st = $derived(data.site.settings);
	const contact = $derived({ phone: st.contactPhone, email: st.email, address: st.address });
	const wa = $derived(st.whatsappNumber ? `https://wa.me/${st.whatsappNumber.replace(/\D/g, '')}` : null);
	const bare = $derived(path === '/login');

	let menu = $state(false);
	let scrolled = $state(false);
	beforeNavigate(() => (menu = false));
	onMount(() => {
		const on = () => (scrolled = scrollY > 8);
		on();
		addEventListener('scroll', on, { passive: true });
		return () => removeEventListener('scroll', on);
	});
</script>

<div class="site">
	<header class="site-head" class:is-scrolled={scrolled}>
		<div class="site-wrap site-head-inner">
			<Brand href="/" />
			{#if !bare}
				<nav class="site-nav" aria-label="Main">
					{#each links as l (l.href)}
						<a href={l.href} aria-current={current(l.href) ? 'page' : undefined}>{l.label}</a>
					{/each}
				</nav>
			{/if}
			<div class="site-actions">
				<ThemeToggle />
				{#if appHref}
					<a href={appHref} class="btn btn-ink btn-sm">Open app<ArrowRight /></a>
				{:else if !bare}
					<a href="/login" class="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</a>
					<a href="/login?next=/app/tests" class="btn btn-primary btn-sm hidden sm:inline-flex">Free mock test</a>
				{/if}
				{#if !bare}
					<button type="button" class="icon-btn site-menu-btn" aria-label="Menu" aria-expanded={menu} onclick={() => (menu = true)}><Menu /></button>
				{/if}
			</div>
		</div>
	</header>

	{#if menu}
		<div class="site-scrim" role="presentation" onclick={() => (menu = false)}></div>
		<div class="site-sheet" role="dialog" aria-modal="true" aria-label="Menu">
			<div class="flex items-center justify-between">
				<Brand href="/" />
				<button type="button" class="icon-btn" aria-label="Close menu" onclick={() => (menu = false)}><X /></button>
			</div>
			<nav class="site-sheet-nav" aria-label="Main">
				{#each links as l (l.href)}
					<a href={l.href} aria-current={current(l.href) ? 'page' : undefined}>{l.label}<ArrowRight /></a>
				{/each}
			</nav>
			<div class="grid gap-2">
				{#if appHref}
					<a href={appHref} class="btn btn-ink btn-lg btn-block">Open app</a>
				{:else}
					<a href="/login?next=/app/tests" class="btn btn-primary btn-lg btn-block">Take a free mock test</a>
					<a href="/login" class="btn btn-secondary btn-lg btn-block">Sign in with Google</a>
				{/if}
			</div>
		</div>
	{/if}

	<main id="main" class="site-main">{@render children()}</main>

	{#if !bare}
		<footer class="site-foot">
			<div class="site-wrap site-foot-grid">
				<div class="max-w-xs">
					<Brand href="/" />
					<p class="mt-3 text-sm muted">Coaching for SSC, Railway, MPPSC and MP Police exams. Classes, video courses, notes and live mock tests in one place.</p>
					<p class="foot-motto mt-4">Dream. Prepare. Achieve.</p>
				</div>
				<div>
					<p class="foot-h">Study</p>
					<a href="/exams">Exams</a><a href="/courses">Courses</a><a href="/results">Results</a><a href="/login?next=/app/tests">Mock tests</a>
				</div>
				<div>
					<p class="foot-h">Institute</p>
					<a href="/about">About</a><a href="/faculty">Faculty</a><a href="/contact">Admissions</a>
				</div>
				<div>
					<p class="foot-h">Legal</p>
					<a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a><a href="/legal/cookies">Cookies</a>
				</div>
				{#if contact.phone || contact.address}
					<div>
						<p class="foot-h">Visit or call</p>
						{#if contact.phone}<a href="tel:{contact.phone}">{contact.phone}</a>{/if}
						{#if contact.email}<a href="mailto:{contact.email}">{contact.email}</a>{/if}
						{#if contact.address}<p class="text-sm muted mt-1">{contact.address}</p>{/if}
					</div>
				{/if}
			</div>
			<div class="site-wrap foot-base">
				<span>© {new Date().getFullYear()} Upendra Competition Institute</span>
			</div>
		</footer>

		{#if contact.phone || wa}
			<div class="contact-bar" aria-label="Contact">
				{#if contact.phone}<a href="tel:{contact.phone}" class="btn btn-secondary"><Phone />Call</a>{/if}
				{#if wa}<a href={wa} class="btn btn-secondary" target="_blank" rel="noopener"><MessageCircle />WhatsApp</a>{/if}
				<a href="/contact" class="btn btn-primary">Enquire</a>
			</div>
		{/if}
	{/if}
</div>

<style>
	.site {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}
	:global(.site-wrap) {
		width: 100%;
		max-width: calc(76rem + 2 * var(--gutter));
		margin: 0 auto;
		padding: 0 var(--gutter);
	}
	.site-head {
		position: sticky;
		top: 0;
		z-index: 40;
		padding-top: var(--safe-top);
		background: hsl(var(--background) / 0.82);
		backdrop-filter: saturate(1.4) blur(14px);
		-webkit-backdrop-filter: saturate(1.4) blur(14px);
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s;
	}
	.site-head.is-scrolled {
		border-bottom-color: hsl(var(--border));
	}
	.site-head-inner {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		height: 64px;
	}
	/* Narrow phones: the brand subtitle truncates instead of pushing the actions off-screen. */
	.site-head-inner :global(.brand),
	.site-head-inner :global(.brand-name) {
		min-width: 0;
	}
	.site-head-inner :global(.brand-name small) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.site-actions {
		flex-shrink: 0;
	}
	.site-nav {
		display: none;
		gap: 0.25rem;
		margin-left: auto;
	}
	.site-nav a {
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		font-size: 0.9375rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		transition: color 0.15s, background-color 0.15s;
	}
	.site-nav a:hover {
		color: hsl(var(--foreground));
		background: hsl(var(--muted));
	}
	.site-nav a[aria-current='page'] {
		color: hsl(var(--foreground));
		font-weight: 600;
	}
	.site-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-left: auto;
	}
	@media (min-width: 1024px) {
		.site-nav {
			display: flex;
		}
		.site-actions {
			margin-left: 0;
		}
		.site-menu-btn {
			display: none;
		}
	}
	.site-scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: hsl(222 22% 10% / 0.4);
		animation: cq-fade 0.2s ease-out;
	}
	.site-sheet {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 61;
		width: min(24rem, 100%);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: calc(0.75rem + var(--safe-top)) 1.25rem calc(1.25rem + var(--safe-bottom));
		background: hsl(var(--surface));
		box-shadow: var(--shadow-lg);
		animation: menu-in 0.28s var(--ease-ios);
		overflow-y: auto;
	}
	@keyframes menu-in {
		from {
			transform: translateX(100%);
		}
	}
	.site-sheet-nav {
		display: flex;
		flex-direction: column;
	}
	.site-sheet-nav a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 56px;
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-size: 1.5rem;
		font-weight: 700;
		border-bottom: 1px solid hsl(var(--border));
	}
	.site-sheet-nav a :global(svg) {
		width: 20px;
		height: 20px;
		color: hsl(var(--muted-foreground));
	}
	.site-sheet-nav a[aria-current='page'] {
		color: hsl(var(--primary));
	}
	.site-main {
		flex: 1;
		min-width: 0;
	}
	.site-foot {
		margin-top: 4rem;
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		padding: 3rem 0 calc(1.5rem + var(--safe-bottom));
	}
	@media (max-width: 767px) {
		.site-foot {
			padding-bottom: calc(5.5rem + var(--safe-bottom));
		}
	}
	.site-foot-grid {
		display: grid;
		gap: 2rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.site-foot-grid > :first-child {
		grid-column: 1 / -1;
	}
	@media (min-width: 900px) {
		.site-foot-grid {
			grid-template-columns: 2fr repeat(4, minmax(0, 1fr));
		}
		.site-foot-grid > :first-child {
			grid-column: auto;
		}
	}
	.site-foot-grid a {
		display: block;
		padding: 0.3rem 0;
		font-size: 0.9375rem;
		color: hsl(var(--muted-foreground));
	}
	.site-foot-grid a:hover {
		color: hsl(var(--foreground));
	}
	.foot-h {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 0.5rem;
	}
	.foot-motto {
		font-family: var(--font-display);
		font-stretch: 80%;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-size: 0.8125rem;
		color: hsl(var(--primary));
	}
	.foot-base {
		margin-top: 2.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid hsl(var(--border));
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	.contact-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		display: flex;
		gap: 0.5rem;
		padding: 0.625rem var(--gutter) calc(0.625rem + var(--safe-bottom));
		background: hsl(var(--surface) / 0.92);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-top: 1px solid hsl(var(--border));
	}
	.contact-bar > :global(*) {
		flex: 1;
	}
	@media (min-width: 768px) {
		.contact-bar {
			display: none;
		}
	}
</style>
