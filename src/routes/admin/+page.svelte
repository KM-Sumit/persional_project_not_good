<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import { formatPercent } from '$lib/features/attempts/score';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Admin studio</title>
</svelte:head>

<div class="page flex flex-col gap-6">
	<Trail items={[{ label: 'You', href: '/profile' }, { label: 'Admin' }]} />
	<h1 class="font-display">Admin studio</h1>

	<section class="grid grid-cols-2 gap-3">
		<article class="card">
			<p class="kicker">Students</p>
			<p class="font-display">{data.stats.students}</p>
		</article>
		<article class="card">
			<p class="kicker">Courses</p>
			<p class="font-display">{data.stats.courses}</p>
		</article>
		<article class="card">
			<p class="kicker">Notes</p>
			<p class="font-display">{data.stats.notes}</p>
		</article>
		<article class="card">
			<p class="kicker">Tests</p>
			<p class="font-display">{data.stats.tests}</p>
		</article>
		<article class="card">
			<p class="kicker">Attempts</p>
			<p class="font-display">{data.stats.attempts}</p>
		</article>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-display">Recent results</h2>
		{#if data.results.length === 0}
			<p class="font-display text-muted">No results yet</p>
			<p class="text-muted">Submitted tests will show up here.</p>
		{:else}
			<div class="row">
				<span class="text-muted">Name</span>
				<span class="text-muted">Test</span>
				<span class="text-muted">Percent</span>
			</div>
			{#each data.results as result, index (`${result.email}-${result.submittedAt}-${index}`)}
				<div class="row">
					<span>{result.name}</span>
					<span>{result.title}</span>
					<span>{formatPercent(result.percentageTenths)}</span>
				</div>
			{/each}
		{/if}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-display">Send a notice</h2>
		<p class="text-muted">Students read this in the in-app inbox.</p>
		<form class="flex flex-col gap-3" method="POST" action="?/send">
			<label class="flex flex-col gap-1">
				<span class="text-muted">Title</span>
				<input
					class="min-h-11 border border-line bg-surface px-3 text-foreground"
					name="title"
					maxlength="120"
					required
					value={form && 'title' in form ? form.title : ''}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-muted">Message</span>
				<textarea
					class="min-h-24 border border-line bg-surface px-3 py-2 text-foreground"
					name="body"
					maxlength="2000"
					rows="4"
					required
					value={form && 'body' in form ? form.body : ''}
				></textarea>
			</label>
			<button class="btn" type="submit">Send notice</button>
		</form>
		{#if form && 'sent' in form && form.sent}
			<p>Notice sent to the in-app inbox.</p>
		{/if}
		{#if form?.message}
			<p>{form.message}</p>
		{/if}
	</section>
</div>
