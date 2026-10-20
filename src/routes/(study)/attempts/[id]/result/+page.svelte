<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import { formatDuration, formatMarks, formatPercent } from '$lib/features/attempts/score';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<Trail
		items={[
			{ label: 'Tests', href: '/tests' },
			{ label: data.title, href: `/tests/${data.testId}` },
			{ label: 'Result' }
		]}
	/>

	<header>
		<p class="kicker">Score</p>
		<h1 class="page-title">{data.title}</h1>
		<p class="stat-value score">{formatMarks(data.scoreMilli)} / {formatMarks(data.maxMilli)}</p>
		<p class="meta">{formatPercent(data.percentageTenths)} · accuracy {formatPercent(data.accuracyTenths)}</p>
		<p class="meta">Time {formatDuration(data.timeTakenSeconds)}</p>
	</header>

	<section class="stats" aria-label="Breakdown">
		<article class="card stat">
			<p class="kicker">Correct</p>
			<p class="stat-value">{data.correct}</p>
		</article>
		<article class="card stat">
			<p class="kicker">Wrong</p>
			<p class="stat-value">{data.wrong}</p>
		</article>
		<article class="card stat">
			<p class="kicker">Blank</p>
			<p class="stat-value">{data.unattempted}</p>
		</article>
	</section>

	{#each data.questions as question, qIndex (qIndex)}
		<article class="review">
			<h2>{qIndex + 1}. {question.prompt}</h2>
			<div class="omr-list">
				{#each question.options as option, index (index)}
					{@const picked = index === question.selected}
					{@const right = index === question.correctIndex}
					<div class="omr" class:is-correct={right} class:is-wrong={picked && !right}>
						<span class="omr-bubble">{'ABCD'[index] ?? index + 1}</span>
						<span class="omr-text">{option}</span>
					</div>
				{/each}
			</div>
			{#if question.selected == null}
				<p class="meta">Left blank</p>
			{/if}
			{#if question.explanation}
				<p class="explain">{question.explanation}</p>
			{/if}
		</article>
	{/each}
</div>

<style>
	.score {
		margin-top: 0.5rem;
		font-size: clamp(2rem, 1.4rem + 2vw, 2.75rem);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.stat {
		padding: 0.9rem 1rem;
	}
	.review {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.review h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.35;
	}
	.explain {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: hsl(var(--muted-foreground));
	}
</style>
