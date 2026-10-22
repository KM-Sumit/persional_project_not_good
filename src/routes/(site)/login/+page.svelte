<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';

	let { data } = $props();
	const errors: Record<string, string> = {
		google: 'Google sign-in did not finish. Try again.',
		suspended: 'This account is paused. Contact the institute office.',
		email_unverified: 'Your Google email is not verified. Verify it with Google, then try again.'
	};
	const href = $derived(`/auth/google${data.next ? `?next=${encodeURIComponent(data.next)}` : ''}`);
	let mockEmail = $state('');
</script>

<svelte:head><title>Sign in · UCI</title></svelte:head>

{#snippet googleMark()}
	<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"
		><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" /><path
			fill="#34A853"
			d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"
		/><path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" /><path
			fill="#EA4335"
			d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
		/></svg
	>
{/snippet}

<div class="login">
	<div class="login-card rise">
		<img src="/brand/uci.png" alt="" width="64" height="64" class="mx-auto rounded-full" />
		<h1 class="page-title mt-5 text-center">Sign in</h1>
		<p class="page-sub mt-3 text-center">Your courses, notes, tests and results stay in one account.</p>

		{#if data.error}
			<p class="alert alert-danger mt-5" role="alert"><CircleAlert class="size-4 shrink-0" />{errors[data.error] ?? errors.google}</p>
		{/if}

		{#if data.mock}
			<form method="GET" action="/auth/google" class="mt-6" data-sveltekit-reload>
				<label class="label" for="mock-email">Email</label>
				<input
					id="mock-email"
					name="mock"
					type="email"
					bind:value={mockEmail}
					class="input mt-2"
					placeholder="you@gmail.com"
					autocomplete="username"
					required
				/>
				{#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
				<button class="btn btn-secondary btn-lg btn-block mt-4 google" type="submit">
					{@render googleMark()}
					Continue
				</button>
				<p class="tiny muted mt-3 text-center">Local only: type any email. Use admin@uci.test for the admin panel.</p>
			</form>
		{:else if data.google}
			<a {href} class="btn btn-secondary btn-lg btn-block mt-6 google" data-sveltekit-reload>
				{@render googleMark()}
				Continue with Google
			</a>
		{:else}
			<p class="alert alert-warning mt-6">Google sign-in is not configured on this server yet.</p>
		{/if}

		<p class="tiny muted mt-6 text-center">
			By continuing you agree to the <a href="/legal/terms" class="underline">Terms</a> and
			<a href="/legal/privacy" class="underline">Privacy policy</a>.
		</p>
	</div>
</div>

<style>
	.login {
		min-height: calc(100svh - 64px);
		display: grid;
		place-items: center;
		padding: 2rem var(--gutter) 4rem;
	}
	.login-card {
		width: 100%;
		max-width: 26rem;
		padding: clamp(1.5rem, 1rem + 2vw, 2.5rem);
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 24px;
		box-shadow: var(--shadow-lg);
	}
	.google {
		gap: 0.75rem;
		font-weight: 600;
	}
	.alert {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
</style>
