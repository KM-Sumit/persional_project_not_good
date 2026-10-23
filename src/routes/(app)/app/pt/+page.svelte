<script lang="ts">
	import { ChevronRight, KeyRound } from '@lucide/svelte';
	import { EmptyState } from '#lib/components/ui';

	let { data } = $props();
	const open = (t: (typeof data.tests)[number]) =>
		t.inProgressAttemptId ? `/app/tests/${t.id}/attempt/${t.inProgressAttemptId}` : `/app/tests/${t.id}`;
</script>

<svelte:head><title>PT Test · UCI</title></svelte:head>

<div class="page flow">
	<header class="page-head">
		<div>
			<h1 class="page-title">PT Test</h1>
			<p class="page-sub">Password tests from your teacher. Ask them for the password before you start.</p>
		</div>
	</header>

	{#if data.tests.length}
		<nav class="list" aria-label="PT tests">
			{#each data.tests as t (t.id)}
				<a class="list-row" href={open(t)}>
					<span class="leading-icon"><KeyRound /></span>
					<span class="grow">
						<span class="title block">{t.title}</span>
						<span class="meta block">{t.questionCount} questions · {t.durationMin} min</span>
					</span>
					<ChevronRight class="chev" />
				</a>
			{/each}
		</nav>
	{:else}
		<EmptyState icon={KeyRound} title="No PT tests yet" body="When your teacher publishes a password test, it shows up here." />
	{/if}
</div>
