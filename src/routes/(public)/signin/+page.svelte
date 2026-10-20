<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const googleHref = $derived(`/api/auth/google/start?next=${encodeURIComponent(data.next)}`);
</script>

<svelte:head>
	<title>Sign in · Upendra Competition Institute</title>
</svelte:head>

<main class="gate">
	<div class="panel">
		<Trail items={[{ label: 'Home', href: '/' }, { label: 'Sign in' }]} />
		<h1 class="page-title">Sign in to practice</h1>
		<p class="lead">
			Continue with Google to open timed tests, courses, and notes. By continuing you agree to the
			<a href="/terms">Terms</a>
			and
			<a href="/privacy">Privacy Policy</a>.
		</p>

		{#if data.error}
			<p class="err">Google sign-in did not finish. Try again.</p>
		{/if}

		{#if data.google || data.mock}
			<div class="stack">
				{#if data.google}
					<a class="btn btn-primary btn-block no-underline" href={googleHref}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
							<path
								fill="#EA4335"
								d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
							/>
							<path
								fill="#4285F4"
								d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
							/>
							<path
								fill="#FBBC05"
								d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
							/>
							<path
								fill="#34A853"
								d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
							/>
						</svg>
						Continue with Google
					</a>
				{/if}
				{#if data.mock}
					<a class="btn btn-secondary btn-block no-underline" href="/api/auth/google/mock?as=student">
						Continue as student
					</a>
					<a class="btn btn-secondary btn-block no-underline" href="/api/auth/google/mock?as=admin">
						Continue as admin
					</a>
				{/if}
			</div>
		{:else}
			<p class="meta">Sign-in is not configured for this environment.</p>
		{/if}
	</div>
</main>

<style>
	.gate {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 2.5rem var(--gutter, 1rem) 3rem;
	}
	.panel {
		width: min(100%, 26rem);
	}
	.lead {
		margin: 0.7rem 0 0;
		font-size: 1rem;
		line-height: 1.55;
	}
	.lead a {
		font-weight: 700;
		color: hsl(var(--primary));
		text-decoration: none;
	}
	.err {
		margin: 1rem 0 0;
		font-size: 0.875rem;
		font-weight: 650;
		color: hsl(var(--danger));
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-top: 1.5rem;
	}
</style>
