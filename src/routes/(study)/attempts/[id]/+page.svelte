<script lang="ts">
	import Trail from '$lib/components/Trail.svelte';
	import { saveAnswer } from '$lib/features/attempts/client';
	import { formatDuration } from '$lib/features/attempts/score';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let now = $state(0);
	let formEl = $state<HTMLFormElement | null>(null);
	let armedFor = '';
	let sheetOpen = $state(false);
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	let picks = $state<Record<string, number>>({});
	let cursor = $state<number | null>(null);

	function choice(question: { id: string; selected: number | null }) {
		return question.id in picks ? picks[question.id] : question.selected;
	}

	const remaining = $derived(Math.max(0, Math.ceil((data.deadline - (now || data.serverNow)) / 1000)));
	const index = $derived.by(() => {
		if (cursor !== null) return cursor;
		const open = data.questions.findIndex((question) => question.selected == null);
		return open >= 0 ? open : 0;
	});
	const current = $derived(data.questions[index]);
	const answered = $derived(data.questions.filter((question) => choice(question) != null).length);
	const blocks = $derived.by(() => {
		const size = 10;
		const groups: { start: number; questions: typeof data.questions }[] = [];
		for (let start = 0; start < data.questions.length; start += size) {
			groups.push({ start, questions: data.questions.slice(start, start + size) });
		}
		return groups;
	});

	$effect(() => {
		const offset = data.serverNow - Date.now();
		const id = setInterval(() => {
			now = Date.now() + offset;
		}, 1000);
		now = Date.now() + offset;
		return () => clearInterval(id);
	});

	$effect(() => {
		if (form?.message) return;
		if (remaining !== 0 || !formEl || armedFor === data.attemptId) return;
		armedFor = data.attemptId;
		formEl.requestSubmit();
	});

	function go(next: number) {
		cursor = Math.max(0, Math.min(data.questions.length - 1, next));
		sheetOpen = false;
		if (scrollY > 0) window.scrollTo({ top: 0 });
	}

	async function pick(questionId: string, option: number) {
		if (cursor === null) cursor = index;
		picks[questionId] = option;
		saveState = 'saving';
		try {
			await saveAnswer(data.attemptId, questionId, option);
			saveState = 'saved';
		} catch {
			saveState = 'error';
		}
	}
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="sheet">
	<Trail
		items={[
			{ label: 'Tests', href: '/tests' },
			{ label: data.title, href: `/tests/${data.testId}` },
			{ label: 'Attempt' }
		]}
	/>
	<header class="top">
		<p class="kicker">{data.title}</p>
		<div class="top-row">
			<p class="count">
				Question {index + 1} of {data.questions.length}
			</p>
			<p class="timer">{formatDuration(remaining)}</p>
		</div>
		<div class="meter" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={data.questions.length}>
			<span style="width: {(answered / Math.max(data.questions.length, 1)) * 100}%"></span>
		</div>
	</header>

	{#if current}
		{#key current.id}
			<section>
				<h1 class="prompt">{current.prompt}</h1>
				<div class="omr-list">
					{#each current.options as option, optionIndex (optionIndex)}
						<button
							class={['omr', { 'is-picked': choice(current) === optionIndex }]}
							type="button"
							onclick={() => pick(current.id, optionIndex)}
						>
							<span class="omr-bubble">{'ABCD'[optionIndex] ?? optionIndex + 1}</span>
							<span class="omr-text">{option}</span>
						</button>
					{/each}
				</div>
				<p class="save meta">
					{#if saveState === 'saving'}Saving…
					{:else if saveState === 'error'}Not saved yet. It still goes in when you submit.
					{:else if saveState === 'saved'}Saved
					{:else}
						{answered} answered
					{/if}
				</p>
			</section>
		{/key}
	{/if}

	{#if form?.message}
		<p class="meta">{form.message}</p>
	{/if}

	<aside class={['palette', { 'is-open': sheetOpen }]} aria-label="Questions">
		<label class="jump">
			<span class="meta">Go to</span>
			<input
				type="number"
				min="1"
				max={data.questions.length}
				value={index + 1}
				onchange={(event) => {
					const next = Number(event.currentTarget.value);
					if (Number.isInteger(next)) go(next - 1);
				}}
			/>
		</label>
		{#each blocks as block (block.start)}
			<p class="block-label">{block.start + 1}–{block.start + block.questions.length}</p>
			<div class="q-dots">
				{#each block.questions as question, offset (question.id)}
					{@const dotIndex = block.start + offset}
					<button
						class={['q-dot', { 'is-filled': choice(question) != null, 'is-here': dotIndex === index }]}
						type="button"
						onclick={() => go(dotIndex)}
					>
						{dotIndex + 1}
					</button>
				{/each}
			</div>
		{/each}
	</aside>

	<form method="POST" bind:this={formEl}>
		{#each data.questions as question (question.id)}
			{#if choice(question) != null}
				<input type="hidden" name={'q:' + question.id} value={choice(question)} />
			{/if}
		{/each}
		<div class="actionbar">
			<button class="btn btn-secondary" type="button" disabled={index === 0} onclick={() => go(index - 1)}>
				Previous
			</button>
			<button class="btn btn-ghost btn-sm sheet-toggle" type="button" onclick={() => (sheetOpen = !sheetOpen)}>
				{sheetOpen ? 'Hide' : 'Sheet'}
			</button>
			{#if index < data.questions.length - 1}
				<button class="btn btn-primary" type="button" onclick={() => go(index + 1)}>Next</button>
			{:else}
				<button class="btn btn-primary" type="submit">Submit</button>
			{/if}
		</div>
	</form>
</div>

<style>
	.sheet {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}
	.sheet > form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: auto;
	}
	.palette {
		display: none;
		flex-direction: column;
		gap: 0.65rem;
	}
	.palette.is-open {
		display: flex;
	}
	.block-label {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		font-weight: 700;
		color: hsl(var(--muted-foreground));
	}
	.jump {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.jump input {
		width: 4.5rem;
		min-height: 36px;
		padding: 0 0.4rem;
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		background: hsl(var(--surface));
		color: inherit;
		font-family: var(--font-mono);
	}
	@media (min-width: 1024px) {
		.sheet {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 13.5rem;
			column-gap: 1.75rem;
			align-items: start;
		}
		.sheet > :not(.palette):not(form) {
			grid-column: 1;
		}
		.palette {
			display: flex;
			grid-column: 2;
			grid-row: 1 / span 5;
			position: sticky;
			top: 1.25rem;
			max-height: calc(100svh - 7rem);
			overflow: auto;
			padding-top: 0.25rem;
		}
		.sheet > form {
			grid-column: 1 / -1;
		}
		.sheet-toggle {
			display: none;
		}
	}
	.top-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin: 0.35rem 0 0.6rem;
	}
	.count {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		color: hsl(var(--muted-foreground));
	}
	.timer {
		margin: 0;
		font-size: 1.05rem;
	}
	.prompt {
		margin: 0 0 1rem;
		font-size: clamp(1.2rem, 1rem + 0.8vw, 1.5rem);
		font-weight: 700;
		line-height: 1.3;
		letter-spacing: -0.02em;
	}
	.save {
		margin: 0.75rem 0 0;
	}
</style>
