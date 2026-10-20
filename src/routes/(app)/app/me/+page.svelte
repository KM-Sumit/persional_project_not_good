<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronRight, History, LogOut, Receipt, UsersRound } from '@lucide/svelte';
	import { Stat, toast, ThemeToggle } from '#lib/components/ui';
	import PushToggle from '#lib/features/push/components/PushToggle.svelte';

	let { data } = $props();
	const p = $derived(data.profile);
	const initials = $derived(
		(p.name || p.email)
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);
	let saving = $state(false);
	let joining = $state(false);
	// Only real numbers: a grid of zeros says nothing.
	const stats = $derived(
		[
			{ label: 'Tests taken', value: p.stats.attempts },
			{ label: 'Average score', value: p.stats.avgPercent == null ? 0 : `${Math.round(p.stats.avgPercent)}%` },
			{ label: 'Lessons done', value: p.stats.lessonsCompleted },
			{ label: 'Courses going', value: p.stats.coursesInProgress }
		].filter((x) => x.value !== 0)
	);
	const phone10 = $derived(p.phone?.replace(/^\+91/, '') ?? '');
</script>

<svelte:head><title>Me · UCI</title></svelte:head>

<div class="page-narrow pb-10 stack-lg">
	<header class="me-head rise" style="--i: 0">
		{#if p.avatarUrl}
			<img class="avatar avatar-lg" src={p.avatarUrl} alt="" referrerpolicy="no-referrer" width="56" height="56" />
		{:else}
			<span class="avatar avatar-lg" aria-hidden="true">{initials}</span>
		{/if}
		<div class="min-w-0">
			<h1 class="page-title truncate">{p.name}</h1>
			<p class="page-sub truncate">{p.email}</p>
		</div>
	</header>

	{#if stats.length}
		<section class="stats {stats.length === 4 ? 'stats-4' : stats.length === 2 ? 'stats-2' : ''} rise" style="--i: 1" aria-label="Your progress">
			{#each stats as st (st.label)}<Stat label={st.label} value={st.value} />{/each}
		</section>
	{/if}

	<section class="list rise" style="--i: 2">
		<a class="list-row" href="/app/me/history">
			<span class="leading-icon"><History /></span>
			<span class="grow"><span class="title block">Test history</span><span class="meta block">Every attempt with score and result</span></span>
			<ChevronRight class="chev" />
		</a>
		<a class="list-row" href="/app/me/billing">
			<span class="leading-icon"><Receipt /></span>
			<span class="grow"><span class="title block">Purchases</span><span class="meta block">Passes, courses and receipts</span></span>
			<ChevronRight class="chev" />
		</a>
	</section>

	<form
		id="exam"
		method="POST"
		action="?/profile"
		class="card card-pad stack rise"
		style="--i: 3"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') toast('Profile saved');
				else if (result.type === 'failure') toast((result.data as { message?: string })?.message ?? 'Could not save.', 'error');
				await update({ reset: false });
			};
		}}
	>
		<h2 class="section-title">Profile</h2>
		<div class="field">
			<label class="label" for="name">Full name</label>
			<input id="name" name="name" class="input" autocomplete="name" required minlength="2" value={p.name} />
		</div>
		<div class="field">
			<label class="label" for="exam-select">Target exam</label>
			<select id="exam-select" name="targetExamId" class="select">
				<option value="" selected={!p.targetExamId}>Not chosen</option>
				{#each data.categories as c (c.id)}
					<optgroup label={c.name}>
						{#each c.exams as e (e.id)}<option value={e.id} selected={e.id === p.targetExamId}>{e.name}</option>{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		<div class="form-row">
			<div class="field">
				<label class="label" for="phone">Mobile <span class="opt">optional</span></label>
				<input id="phone" name="phone" class="input" type="tel" inputmode="numeric" autocomplete="tel-national" value={phone10} />
			</div>
			<div class="field">
				<label class="label" for="city">City <span class="opt">optional</span></label>
				<input id="city" name="city" class="input" autocomplete="address-level2" value={p.city ?? ''} />
			</div>
		</div>
		<div><button class="btn btn-ink" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
	</form>

	<section class="card card-pad stack rise" style="--i: 4">
		<h2 class="section-title">My batches</h2>
		{#if p.batches.length}
			<div class="list">
				{#each p.batches as b (b.id)}
					<div class="list-row">
						<span class="leading-icon"><UsersRound /></span>
						<span class="grow"><span class="title block">{b.name}</span><span class="meta block">Session {b.sessionName}</span></span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="muted small">You are not in a batch yet. Your teacher gives you a code in class.</p>
		{/if}
		<form
			method="POST"
			action="?/join"
			class="flex gap-2"
			use:enhance={() => {
				joining = true;
				return async ({ result, update, formElement }) => {
					joining = false;
					if (result.type === 'success') {
						toast(`Joined ${(result.data as { batch?: string })?.batch ?? 'batch'}`);
						formElement.reset();
					} else if (result.type === 'failure') toast((result.data as { message?: string })?.message ?? 'Could not join.', 'error');
					await update({ reset: false });
				};
			}}
		>
			<label class="sr-only" for="code">Batch code</label>
			<input id="code" name="code" class="input font-mono uppercase min-w-0 flex-1 tracking-widest" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="Code" required />
			<button class="btn btn-secondary" disabled={joining}>Join batch</button>
		</form>
	</section>

	<section class="list rise" style="--i: 5">
		<PushToggle />
		<div class="list-row">
			<span class="grow"><span class="title block">Appearance</span><span class="meta block">Light or dark</span></span>
			<span class="trail"><ThemeToggle class="btn btn-secondary btn-sm" /></span>
		</div>
		<form method="POST" action="/logout">
			<button class="list-row w-full text-left text-danger">
				<span class="leading-icon"><LogOut /></span>
				<span class="grow"><span class="title block">Sign out</span></span>
			</button>
		</form>
	</section>

	<p class="tiny muted text-center">
		<a href="/legal/terms" class="underline">Terms</a> · <a href="/legal/privacy" class="underline">Privacy</a> · <a href="/legal/refunds" class="underline">Refunds</a>
	</p>
</div>

<style>
	.me-head {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.me-head .page-title {
		font-size: clamp(1.5rem, 1.3rem + 1vw, 2rem);
	}
</style>
