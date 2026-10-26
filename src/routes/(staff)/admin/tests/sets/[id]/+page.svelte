<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Plus } from '@lucide/svelte';
	import { PageHeader, toast } from '#lib/components/ui';

	let { data } = $props();
	let name = $state(untrack(() => data.set.name));
</script>

<svelte:head><title>{data.set.name} · UCI staff</title></svelte:head>

<div class="page stack">
	<PageHeader title={data.set.name} crumbs={[{ href: '/admin/tests', label: 'Tests' }]} subtitle="Opening this set shows every test inside it." />
	<form
		method="POST"
		action="?/rename"
		class="card card-pad stack"
		use:enhance={() => async ({ result }) => {
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not rename the set.'), 'error');
			else if (result.type === 'success') toast('Set name saved');
		}}
	>
		<div class="field">
			<label class="label" for="set-name">Set name</label>
			<input id="set-name" class="input" name="name" maxlength="120" bind:value={name} required />
		</div>
		<button class="btn btn-primary">Save name</button>
	</form>
	<div class="section-head">
		<h2 class="section-title">{data.set.tests.length} {data.set.tests.length === 1 ? 'test' : 'tests'}</h2>
		<a class="btn btn-secondary btn-sm" href="/admin/tests/new?set={data.set.id}"><Plus class="size-4" />Add a test</a>
	</div>
	{#if data.set.tests.length}
		<ul class="stack-sm">
			{#each data.set.tests as t (t.id)}
				<li class="card card-pad flex items-center justify-between gap-3">
					<a class="font-semibold hover:underline" href="/admin/tests/{t.id}">{t.title}</a>
					<span class="small muted tabular">{t.questionCount} questions · {t.status}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="card card-pad muted">No tests in this set yet.</p>
	{/if}
</div>
