<script lang="ts">
	import { formatMarks } from '$lib/features/attempts/score';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let query = $state('');
	let desk = $state<'code' | 'password' | 'module'>('code');

	function shelf(test: (typeof data.tests)[number]) {
		if (test.accessType === 'password') return 'password';
		if (test.chapterId || test.testType === 'pyq') return 'module';
		return 'code';
	}

	function matches(test: (typeof data.tests)[number]) {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		return (
			test.title.toLowerCase().includes(q) ||
			(test.joinCode ?? '').toLowerCase().includes(q) ||
			(test.courseTitle ?? '').toLowerCase().includes(q) ||
			(test.chapterTitle ?? '').toLowerCase().includes(q)
		);
	}

	const codeTests = $derived(data.tests.filter((test) => shelf(test) === 'code' && matches(test)));
	const passwordTests = $derived(data.tests.filter((test) => shelf(test) === 'password' && matches(test)));
	const moduleTests = $derived(data.tests.filter((test) => shelf(test) === 'module' && matches(test)));
	const moduleSessions = $derived.by(() => {
		const groups: { key: string; tests: typeof moduleTests }[] = [];
		for (const test of moduleTests) {
			const key = test.courseTitle ?? 'Previous-year papers';
			const found = groups.find((group) => group.key === key);
			if (found) found.tests.push(test);
			else groups.push({ key, tests: [test] });
		}
		return groups;
	});
</script>

<svelte:head>
	<title>Tests</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<header class="flex flex-col gap-1">
		<h1 class="page-title text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
			Tests
		</h1>
		<p class="meta text-[15px]">A short code, a password, or a paper from a module.</p>
	</header>

	<section class="card flex flex-col gap-3 !p-5">
		<h2 class="text-[1.05rem] font-bold tracking-tight">Simple code</h2>
		<p class="meta">Type the code on the paper. It opens that test.</p>
		<form class="flex flex-col gap-3 sm:flex-row sm:items-end" method="POST" action="?/join">
			<label class="flex min-w-0 flex-1 flex-col gap-1.5">
				<span class="meta font-semibold">Code</span>
				<input
					class="min-h-11 rounded-[var(--radius-md)] border border-border bg-surface px-3 font-mono text-[1.05rem] tracking-[0.14em] text-foreground uppercase"
					name="code"
					type="text"
					inputmode="text"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					maxlength="12"
					required
					placeholder="PCT80"
				/>
			</label>
			<button class="btn btn-primary" type="submit">Open paper</button>
		</form>
		{#if form?.message}
			<p class="text-destructive text-[14px]">{form.message}</p>
		{/if}
	</section>

	<label class="find">
		<span class="meta font-semibold">Find a paper</span>
		<input
			type="search"
			placeholder="Title, code, or course"
			bind:value={query}
		/>
	</label>

	<div class="chip-row desk-switch" role="tablist" aria-label="Paper sessions">
		<button class="chip" type="button" role="tab" aria-selected={desk === 'code'} onclick={() => (desk = 'code')}>Code</button>
		<button class="chip" type="button" role="tab" aria-selected={desk === 'password'} onclick={() => (desk = 'password')}>Password</button>
		<button class="chip" type="button" role="tab" aria-selected={desk === 'module'} onclick={() => (desk = 'module')}>Modules</button>
	</div>

	<div class="sessions">
	<section class={{ 'is-hidden': desk !== 'code' }}>
		<div class="section-head">
			<h2>Code papers</h2>
		</div>
		{#if codeTests.length === 0}
			<p class="meta py-4">No code papers yet.</p>
		{:else}
			<div class="list-plain">
				{#each codeTests as test (test.id)}
					<a class="row" href="/tests/{test.id}">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[15px] font-semibold">{test.title}</span>
							<span class="meta">
								{#if test.joinCode}
									<span class="font-mono tracking-wide">{test.joinCode}</span>
									·
								{/if}
								{test.questionCount} questions · {test.durationMinutes} min
								{#if test.negativeMilli > 0}
									· −{formatMarks(test.negativeMilli)}
								{/if}
							</span>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section class={{ 'is-hidden': desk !== 'password' }}>
		<div class="section-head">
			<h2>Password</h2>
		</div>
		<p class="meta mb-3">Locked until you enter the password on the paper.</p>
		{#if passwordTests.length === 0}
			<p class="meta py-2">No password papers yet.</p>
		{:else}
			<div class="list-plain">
				{#each passwordTests as test (test.id)}
					<a class="row" href="/tests/{test.id}">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[15px] font-semibold">{test.title}</span>
							<span class="meta">
								Password · {test.questionCount} questions · {test.durationMinutes} min
							</span>
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section class={{ 'is-hidden': desk !== 'module' }}>
		<div class="section-head">
			<h2>From a module</h2>
		</div>
		{#if moduleSessions.length === 0}
			<p class="meta py-2">No module papers yet.</p>
		{:else}
			{#each moduleSessions as session (session.key)}
				<p class="session">{session.key}</p>
				<div class="list-plain">
					{#each session.tests as test (test.id)}
						<a class="row" href="/tests/{test.id}">
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="truncate text-[15px] font-semibold">{test.title}</span>
								<span class="meta">
									{test.chapterTitle ?? 'Previous-year paper'}
									· {test.questionCount} questions · {test.durationMinutes} min
								</span>
							</span>
						</a>
					{/each}
				</div>
			{/each}
		{/if}
	</section>
	</div>
</div>

<style>
	.find {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.find input {
		min-height: 44px;
		padding: 0 0.85rem;
		border: 1px solid hsl(var(--border));
		border-radius: 10px;
		background: hsl(var(--surface));
		color: inherit;
		font: inherit;
	}
	.session {
		margin: 0.85rem 0 0.15rem;
		font-size: 0.8125rem;
		font-weight: 700;
	}
	@media (min-width: 1024px) {
		.desk-switch {
			display: none;
		}
		.sessions {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1.5rem;
			align-items: start;
		}
		.sessions section.is-hidden {
			display: block;
		}
	}
	@media (max-width: 1023px) {
		.sessions section.is-hidden {
			display: none;
		}
	}
</style>
