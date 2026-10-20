<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import { formatMarks, formatPaise } from '$lib/features/attempts/score';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<Trail items={[{ label: 'Tests', href: '/tests' }, { label: data.title }]} />
	<header class="flex flex-col gap-1">
		<p class="kicker">{data.subject}</p>
		{#if data.joinCode}
			<p class="meta font-mono tracking-wide">Code {data.joinCode}</p>
		{:else if data.place}
			<p class="meta">From {data.place}</p>
		{/if}
		<h1 class="page-title text-[1.65rem] leading-tight font-bold tracking-tight sm:text-[1.9rem]">
			{data.title}
		</h1>
	</header>

	<div class="card flex flex-col gap-3 !p-5">
		<p class="meta">
			<span class="timer font-semibold text-foreground">{data.durationMinutes} min</span>
			· {data.questionCount} questions
		</p>
		<p class="meta">
			+{formatMarks(data.marksPerQuestionMilli)} / wrong −{formatMarks(data.negativeMilli)}
		</p>
	</div>

	{#each data.instructions.split(/\n\s*\n/) as paragraph, index (index)}
		{#if paragraph.trim()}
			<p class="whitespace-pre-wrap text-[15px] leading-relaxed">{paragraph.trim()}</p>
		{/if}
	{/each}

	{#if form?.message}
		<p class="text-destructive text-[14px]">{form.message}</p>
	{/if}

	{#if data.needsPassword}
		<form class="flex max-w-sm flex-col gap-3" method="POST" action="?/unlock">
			<label class="flex flex-col gap-1.5">
				<span class="meta font-semibold">Password</span>
				<input
					class="min-h-11 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-foreground"
					name="password"
					type="password"
					autocomplete="off"
					required
				/>
			</label>
			<button class="btn btn-primary" type="submit">Unlock</button>
		</form>
	{:else if data.needsPurchase}
		<p class="meta">
			This test is {formatPaise(data.pricePaise)}. An admin must grant access.
		</p>
	{:else if data.activeAttemptId}
		<a class="btn btn-primary no-underline" href="/attempts/{data.activeAttemptId}">Resume attempt</a>
	{:else}
		<form method="POST" action="?/start">
			<button class="btn btn-primary" type="submit">Start test</button>
		</form>
	{/if}
</div>
