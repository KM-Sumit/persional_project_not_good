<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let saving = $state(false);
	const v = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>About you · UCI</title></svelte:head>

<div class="page-narrow pb-28">
	<header class="page-head">
		<div>
			<p class="eyebrow">Step 1 of 1</p>
			<h1 class="page-title">About you</h1>
			<p class="page-sub">Your name and mobile stay on your account. You can change them later in your profile.</p>
		</div>
	</header>

	<form
		method="POST"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
		class="stack-lg"
	>
		{#if form?.message}<p class="alert alert-danger" role="alert">{form.message}</p>{/if}

		<section class="card card-pad stack">
			<div class="field">
				<label class="label" for="name">Full name</label>
				<input id="name" name="name" class="input" autocomplete="name" required minlength="2" value={v.name ?? data.profile.name} />
			</div>
			<div class="field">
				<label class="label" for="phone">Mobile number</label>
				<input
					id="phone"
					name="phone"
					class="input"
					type="tel"
					inputmode="numeric"
					autocomplete="tel-national"
					required
					placeholder="98765 43210"
					value={v.phone ?? data.profile.phone?.replace(/^\+91/, '') ?? ''}
				/>
				<p class="help">For test reminders and results. Never shared.</p>
			</div>
			<div class="field">
				<label class="label" for="city">City <span class="opt">optional</span></label>
				<input id="city" name="city" class="input" autocomplete="address-level2" placeholder="Rewa" value={v.city ?? data.profile.city ?? ''} />
			</div>
		</section>

		<div class="actionbar inline-desktop">
			<div class="actionbar-inner">
				<button class="btn btn-primary btn-lg" disabled={saving}>{saving ? 'Saving…' : 'Start preparing'}</button>
			</div>
		</div>
	</form>
</div>
