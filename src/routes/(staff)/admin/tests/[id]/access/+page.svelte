<script lang="ts">
	import { enhance } from '$app/forms';
	import { ClipboardCopy, KeyRound, Search, UserMinus, UserPlus, Users } from '@lucide/svelte';
	import { Button, EmptyState, Sheet, toast } from '#lib/components/ui';
	import { ConfirmSheet } from '#lib/components/kit';
	import { fmtDay } from '#lib/features/bank/components/format';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	const t = $derived(data.test);

	let shownPassword = $state<string | null>(null);
	let confirmRotate = $state(false);
	let rotateForm = $state<HTMLFormElement>();
	let access = $state(data.test.access);
	$effect(() => {
		access = data.test.access;
	});

	type Done = Parameters<Exclude<ReturnType<SubmitFunction>, void | Promise<unknown>>>[0];
	const after = async ({ result, update }: Done) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Failed.'), 'error');
		else if (result.type === 'success') {
			if (result.data?.password) shownPassword = String(result.data.password);
			if (result.data?.message) toast(String(result.data.message));
		}
		await update({ reset: true });
	};
	const done: SubmitFunction = () => after;

	async function copy() {
		if (shownPassword) await navigator.clipboard.writeText(shownPassword).catch(() => {});
		toast('Copied');
	}
</script>

<svelte:head><title>Access · {t.title}</title></svelte:head>

<div class="stack-lg">
	<section class="card card-pad stack">
		<h2 class="section-title">Who can take it</h2>
		<form method="POST" action="?/access" class="stack" use:enhance={done}>
			<div class="segmented" role="radiogroup" aria-label="Access">
				{#each [['open', 'Open'], ['password', 'Password'], ['paid', 'Paid']] as [v, label] (v)}
					<label class="seg-opt">
						<input type="radio" name="access" value={v} bind:group={access} class="sr-only" />
						<span>{label}</span>
					</label>
				{/each}
			</div>
			{#if access === 'paid'}
				<div class="field">
					<label class="label" for="a-price">Price (₹)</label>
					<input id="a-price" name="priceInr" type="number" min="0" class="input" value={t.priceInr ?? ''} />
				</div>
			{/if}
			<p class="small muted">
				{access === 'open' ? 'Every signed-in student can start it.' : access === 'password' ? 'Students type the password to start.' : 'Only students with a grant (or a purchase) can start it.'}
			</p>
			{#if access !== t.access || access === 'paid'}<div class="flex justify-end"><Button type="submit">Save access</Button></div>{/if}
		</form>
	</section>

	{#if t.access === 'password'}
		<section class="card card-pad stack">
			<div class="flex items-center gap-2">
				<KeyRound class="size-5 text-primary" />
				<h2 class="section-title flex-1">Password</h2>
				<span class="small muted">{t.hasPassword ? 'Set' : 'Not set'}</span>
			</div>
			<p class="small muted">For safety the password is stored scrambled and shown only once, right after you set it. Setting a new one also clears lockouts.</p>
			<form method="POST" action="?/password" class="pw-form" use:enhance={done} bind:this={rotateForm}>
				<input name="password" class="input font-mono" maxlength="64" minlength="4" autocomplete="off" placeholder="Custom password (or leave empty)" aria-label="Custom password" />
				<Button type="button" onclick={() => (t.hasPassword ? (confirmRotate = true) : rotateForm?.requestSubmit())}>
					{t.hasPassword ? 'Set new password' : 'Set password'}
				</Button>
			</form>
		</section>
	{/if}

	<section class="card card-pad stack">
		<div class="flex items-center gap-2">
			<Users class="size-5 text-primary" />
			<h2 class="section-title flex-1">Granted students</h2>
			<span class="small font-mono tabular">{data.grants.length}</span>
		</div>
		<p class="small muted">Grants let a student into a paid test without paying (cash, scholarship, staff).</p>

		<form method="GET" class="search-row" role="search">
			<label class="search flex-1">
				<Search class="size-4" aria-hidden="true" />
				<input class="input" name="q" value={data.q} placeholder="Find a student by name, email or phone" aria-label="Find a student" />
			</label>
			<Button variant="secondary" type="submit">Find</Button>
		</form>
		{#if data.q}
			<ul class="list">
				{#each data.found as p (p.id)}
					<li class="list-row">
						<span class="min-w-0 flex-1"><span class="block font-medium">{p.name}</span><span class="tiny muted">{p.email}</span></span>
						{#if data.grants.some((g) => g.userId === p.id)}
							<span class="small muted">Granted</span>
						{:else}
							<form method="POST" action="?/grant" use:enhance={done}>
								<input type="hidden" name="userId" value={p.id} />
								<Button size="sm" type="submit"><UserPlus class="size-4" />Grant</Button>
							</form>
						{/if}
					</li>
				{:else}
					<li class="small muted p-3">No student matches “{data.q}”.</li>
				{/each}
			</ul>
		{/if}

		{#if data.grants.length}
			<ul class="list">
				{#each data.grants as g (g.userId)}
					<li class="list-row">
						<span class="min-w-0 flex-1">
							<span class="block font-medium">{g.name}</span>
							<span class="tiny muted">{g.email} · since {fmtDay(g.createdAt)}{g.note ? ` · ${g.note}` : ''}</span>
						</span>
						<form method="POST" action="?/revoke" use:enhance={done}>
							<input type="hidden" name="userId" value={g.userId} />
							<Button size="sm" variant="ghost" type="submit"><UserMinus class="size-4" />Remove</Button>
						</form>
					</li>
				{/each}
			</ul>
		{:else if !data.q}
			<EmptyState compact icon={Users} title="No grants" body="Search for a student above to grant access." />
		{/if}
	</section>
</div>

<ConfirmSheet
	bind:open={confirmRotate}
	title="Set a new password?"
	body="The old password stops working at once. Students already writing the test are not affected."
	confirmLabel="Set new password"
	onconfirm={() => rotateForm?.requestSubmit()}
/>

<Sheet open={!!shownPassword} title="New test password" description="Copy it now. It is not shown again.">
	<div class="stack">
		<p class="pw font-mono">{shownPassword}</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="secondary" onclick={copy}><ClipboardCopy class="size-4" />Copy password</Button>
			<a class="btn btn-secondary" href="https://wa.me/?text={encodeURIComponent(`${t.title}: password ${shownPassword}`)}" target="_blank" rel="noopener">Send on WhatsApp</a>
			<span class="flex-1"></span>
			<Button onclick={() => (shownPassword = null)}>Done</Button>
		</div>
	</div>
</Sheet>

<style>
	.seg-opt {
		cursor: pointer;
	}
	.seg-opt span {
		display: block;
	}
	.pw-form,
	.search-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pw-form .input {
		flex: 1 1 14rem;
	}
	.search {
		position: relative;
		min-width: 12rem;
	}
	.search :global(svg) {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		translate: 0 -50%;
		color: hsl(var(--muted-foreground));
	}
	.search .input {
		padding-left: 2.25rem;
	}
	.pw {
		font-size: 2rem;
		letter-spacing: 0.15em;
		text-align: center;
		padding: 1rem;
		border: 1.5px dashed hsl(var(--border));
		border-radius: 12px;
		overflow-wrap: anywhere;
	}
</style>
