<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Check, Clock, Lightbulb, LoaderCircle, Lock, RotateCcw, Share2, X } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import AskDoubtButton from '#lib/features/doubts/components/AskDoubtButton.svelte';
	import { toast } from '#lib/components/ui';
	import { LETTERS, fmtNum, minutes } from '#lib/features/tests/components/exam';

	let { data } = $props();
	const r = $derived(data.result);
	type Filter = 'all' | 'wrong' | 'skipped' | 'marked';
	let filter = $state<Filter>('all');
	let busy = $state(false);

	const tone = $derived(r.percentage >= 70 ? '--success' : r.percentage >= 40 ? '--warning' : '--danger');
	const attempted = $derived(r.correct + r.wrong);
	const counts = $derived({
		all: r.questions.length,
		wrong: r.questions.filter((q) => q.outcome === 'wrong').length,
		skipped: r.questions.filter((q) => q.outcome === 'skipped').length,
		marked: r.questions.filter((q) => q.marked).length
	});
	const shown = $derived(
		r.questions
			.map((q, i) => ({ q, n: i + 1 }))
			.filter(({ q }) => filter === 'all' || (filter === 'marked' ? q.marked : q.outcome === filter))
	);
	// One plain verdict line: the topic that cost the most.
	const weakest = $derived(
		[...r.topics].filter((t) => t.wrong + t.skipped > 0).sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)[0]
	);

	async function share() {
		const text = `I scored ${fmtNum(r.score)}/${fmtNum(r.maxScore)} (${r.percentage}%) in "${r.test.title}" on UCI${r.participants > 1 ? `, rank ${r.rank} of ${r.participants}` : ''}.`;
		const url = `${page.url.origin}/app/tests/${r.test.id}`;
		try {
			if (navigator.share) await navigator.share({ title: r.test.title, text, url });
			else {
				await navigator.clipboard.writeText(`${text} ${url}`);
				toast('Result copied. Paste it anywhere.');
			}
		} catch (e) {
			if ((e as Error)?.name !== 'AbortError') toast('Could not share. Try again.', 'error');
		}
	}
</script>

<svelte:head><title>Result · {r.test.title} · UCI</title></svelte:head>

<div class="page">
	<PageHeader
		title="Result"
		eyebrow="{r.test.title} · attempt {r.number}"
		crumbs={[
			{ href: '/app/tests', label: 'Tests' },
			{ href: `/app/tests/${r.test.id}`, label: r.test.title }
		]}
	/>

	<div class="top mt-4">
		<section class="card card-pad hero rise" aria-label="Score">
			<div class="score-ring" style="--pct: {Math.max(0, r.percentage)}; --tone: var({tone})">
				<div>
					<div class="value font-mono">{r.percentage}<span class="pc">%</span></div>
					<div class="of">score</div>
				</div>
			</div>
			<div class="min-w-0">
				<p class="marks font-mono tabular"><b>{fmtNum(r.score)}</b><span class="muted">&nbsp;/&nbsp;{fmtNum(r.maxScore)}</span></p>
				<p class="small muted">marks{#if r.status === 'expired'} · auto-submitted at time up{/if}</p>
				<dl class="facts">
					{#if r.participants > 1}
						<div><dt>Rank</dt><dd class="font-mono tabular">#{r.rank}<span class="muted"> / {r.participants}</span></dd></div>
						<div><dt>Percentile</dt><dd class="font-mono tabular">{fmtNum(r.percentile)}</dd></div>
					{/if}
					<div><dt>Time</dt><dd class="font-mono tabular">{minutes(r.timeTakenSec)}</dd></div>
				</dl>
				{#if weakest}
					<p class="verdict">Most marks lost in <b>{weakest.topic}</b>: {weakest.wrong} wrong, {weakest.skipped} skipped.</p>
				{:else if r.correct === r.questions.length}
					<p class="verdict">Full marks. Every answer correct.</p>
				{/if}
			</div>
		</section>

		<div class="stats stats-4 rise" style="--i: 1">
			<div class="stat"><div class="stat-value font-mono score-good">{r.correct}</div><div class="stat-label">Correct</div></div>
			<div class="stat"><div class="stat-value font-mono score-low">{r.wrong}</div><div class="stat-label">Wrong</div></div>
			<div class="stat"><div class="stat-value font-mono">{r.skipped}</div><div class="stat-label">Skipped</div></div>
			<div class="stat"><div class="stat-value font-mono">{r.accuracy}<span class="text-base">%</span></div><div class="stat-label">Accuracy ({attempted} tried)</div></div>
		</div>
	</div>

	<div class="result-actions rise" style="--i: 2">
		{#if r.solutionsVisible}
			<a class="btn btn-primary" href="#solutions">View solutions</a>
		{/if}
		{#if data.retake?.canStart}
			<form
				method="POST"
				action="/app/tests/{r.test.id}?/start"
				use:enhance={() => {
					busy = true;
					return async ({ result, update }) => {
						busy = false;
						if (result.type === 'redirect') await goto(result.location);
						else if (result.type === 'failure') toast(String(result.data?.error ?? 'Could not start.'), 'error');
						else await update();
					};
				}}
			>
				<button class="btn btn-secondary" disabled={busy}>{#if busy}<LoaderCircle class="animate-spin" />{:else}<RotateCcw />{/if} Retake</button>
			</form>
		{:else if data.retake?.password}
			<a class="btn btn-secondary" href="/app/tests/{r.test.id}"><RotateCcw /> Retake</a>
		{/if}
		<button type="button" class="btn btn-ghost" onclick={share}><Share2 /> Share</button>
	</div>

	{#if r.topics.length > 1}
		<section class="mt-8" aria-labelledby="topics-h">
			<div class="section-head"><h2 id="topics-h" class="section-title">By topic</h2></div>
			<div class="list">
				{#each r.topics as t (t.topic)}
					<div class="list-row topic">
						<div class="grow">
							<p class="title">{t.topic}</p>
							<p class="meta tabular">{t.correct} correct · {t.wrong} wrong · {t.skipped} skipped of {t.total}</p>
							<div class="progress mt-2" class:is-success={t.accuracy >= 70} class:is-warning={t.accuracy >= 40 && t.accuracy < 70} class:is-danger={t.accuracy < 40}>
								<span style="width: {(t.correct / t.total) * 100}%"></span>
							</div>
						</div>
						<span class="trail font-mono tabular small">{t.accuracy}%</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section id="solutions" class="mt-8 solutions" aria-labelledby="sol-h">
		<div class="section-head"><h2 id="sol-h" class="section-title">Solutions</h2></div>
		{#if !r.solutionsVisible}
			<div class="empty card">
				<div class="empty-icon"><Lock /></div>
				<h3>Solutions open after the test ends</h3>
				<p>Your score is final. Answers and explanations appear here once the test window closes.</p>
			</div>
		{:else}
			<div class="segmented filter" role="tablist" aria-label="Filter questions">
				{#each [['all', 'All'], ['wrong', 'Wrong'], ['skipped', 'Skipped'], ['marked', 'Marked']] as [k, label] (k)}
					<button type="button" role="tab" aria-selected={filter === k} onclick={() => (filter = k as Filter)}>
						{label}{#if counts[k as Filter]}<span class="seg-count tabular">{counts[k as Filter]}</span>{/if}
					</button>
				{/each}
			</div>
			{#if !shown.length}
				<p class="empty empty-compact muted">No {filter} questions in this attempt.</p>
			{/if}
			<div class="qlist mt-4">
				{#each shown as { q, n } (q.id)}
					<article class="review card">
						<header class="r-head">
							<span class="r-num font-mono tabular">Q{n}</span>
							{#if q.topic}<span class="r-topic">{q.topic}</span>{/if}
							<span class="r-right">
								{#if q.marked}<span class="badge marked">Marked</span>{/if}
								{#if q.outcome === 'correct'}<span class="badge badge-success">+{fmtNum(q.marks)}</span>
								{:else if q.outcome === 'wrong'}<span class="badge badge-danger">{q.negativeMarks > 0 ? `−${fmtNum(q.negativeMarks)}` : 'Wrong'}</span>
								{:else}<span class="badge">Skipped</span>{/if}
								<span class="r-time font-mono tabular"><Clock class="size-3.5" />{minutes(q.timeSpentSec)}</span>
							</span>
						</header>
						<p class="prompt">{q.prompt}</p>
						{#if q.imageFileId}<img class="q-img" src="/api/files/{q.imageFileId}" alt="Figure for question {n}" loading="lazy" />{/if}
						<ol class="opts" aria-label="Options">
							{#each q.options as text, i (i)}
								{@const isCorrect = q.correctIndex === i}
								{@const isMine = q.selected === i}
								{@const pct = q.optionPickPct?.[i] ?? null}
								<li class="opt" class:is-correct={isCorrect} class:is-wrong={isMine && !isCorrect} style:--pct="{pct ?? 0}%">
									<span class="bub" aria-hidden="true">
										{#if isCorrect}<Check class="size-3.5" strokeWidth={3} />{:else if isMine}<X class="size-3.5" strokeWidth={3} />{:else}{LETTERS[i]}{/if}
									</span>
									<span class="o-text">
										{text}
										{#if isCorrect || isMine}
											<span class="o-tag">{isCorrect && isMine ? 'Your answer, correct' : isCorrect ? 'Correct answer' : 'Your answer'}</span>
										{/if}
									</span>
									{#if pct !== null}<span class="o-pct font-mono tabular" title="{pct}% of students chose this">{pct}%</span>{/if}
								</li>
							{/each}
						</ol>
						{#if q.explanation}
							<div class="explain">
								<p class="explain-h"><Lightbulb class="size-4" />Explanation</p>
								<p class="explain-b">{q.explanation}</p>
							</div>
						{/if}
						<div class="mt-3 flex justify-end"><AskDoubtButton questionId={q.id} label="Ask about this question" variant="ghost" /></div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.top { display: grid; gap: 0.75rem; }
	@media (min-width: 1024px) { .top { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: stretch; } .top .stats { align-content: stretch; } }
	.hero { display: flex; gap: 1.25rem; align-items: center; }
	.hero .score-ring { flex-shrink: 0; }
	.score-ring .pc { font-size: 1rem; }
	.marks { font-size: 1.75rem; line-height: 1.1; }
	.marks b { font-weight: 600; }
	.facts { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin-top: 0.75rem; }
	.facts dt { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; color: hsl(var(--muted-foreground)); }
	.facts dd { font-weight: 600; }
	.verdict { margin-top: 0.75rem; font-size: 0.875rem; }
	@media (max-width: 480px) { .hero { gap: 1rem; } .hero .score-ring { width: 104px; height: 104px; } .score-ring .value { font-size: 1.625rem; } .marks { font-size: 1.375rem; } }
	.result-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
	.result-actions > form { display: contents; }
	@media (max-width: 767px) { .result-actions > :is(a, button):first-child { flex: 1 1 100%; } }

	.solutions { scroll-margin-top: 1rem; min-width: 0; max-width: 52rem; }
	.filter { max-width: 32rem; }
	.qlist { display: grid; gap: 0.875rem; min-width: 0; }
	.review { min-width: 0; padding: clamp(1rem, 0.8rem + 0.8vw, 1.5rem); }
	.r-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem 0.625rem; min-width: 0; }
	.r-num { font-size: 0.8125rem; font-weight: 600; }
	.r-topic { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.r-right { margin-left: auto; display: inline-flex; align-items: center; gap: 0.5rem; }
	.r-time { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
	.prompt { margin-top: 0.75rem; font-size: 1.0625rem; font-weight: 600; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
	.q-img { margin-top: 0.75rem; max-width: 100%; max-height: 18rem; border-radius: 12px; border: 1px solid hsl(var(--border)); }

	/* Options: plain rows; the share of students who chose each one fills the row like a poll result. */
	.opts { margin-top: 1rem; display: grid; gap: 0.375rem; min-width: 0; }
	.opt {
		--fill: hsl(var(--foreground) / 0.05);
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		min-width: 0;
		padding: 0.75rem 0.875rem;
		border-radius: 12px;
		background: linear-gradient(90deg, var(--fill) var(--pct), transparent var(--pct)), hsl(var(--muted) / 0.45);
	}
	.opt.is-correct { --fill: hsl(var(--success) / 0.16); background: linear-gradient(90deg, var(--fill) var(--pct), transparent var(--pct)), hsl(var(--success) / 0.06); box-shadow: inset 0 0 0 1px hsl(var(--success) / 0.45); }
	.opt.is-wrong { --fill: hsl(var(--danger) / 0.14); background: linear-gradient(90deg, var(--fill) var(--pct), transparent var(--pct)), hsl(var(--danger) / 0.05); box-shadow: inset 0 0 0 1px hsl(var(--danger) / 0.4); }
	.bub {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--foreground) / 0.35);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.is-correct .bub { background: hsl(var(--success)); border-color: hsl(var(--success)); color: hsl(var(--surface)); }
	.is-wrong .bub { background: hsl(var(--danger)); border-color: hsl(var(--danger)); color: hsl(var(--surface)); }
	.o-text { flex: 1; min-width: 0; padding-top: 2px; font-size: 0.9375rem; line-height: 1.5; white-space: pre-line; overflow-wrap: anywhere; }
	.o-tag { display: block; margin-top: 0.125rem; font-size: 0.75rem; font-weight: 600; color: hsl(var(--muted-foreground)); }
	.is-correct .o-tag { color: hsl(var(--success)); }
	.is-wrong .o-tag { color: hsl(var(--danger)); }
	.o-pct { flex-shrink: 0; padding-top: 4px; font-size: 0.75rem; color: hsl(var(--muted-foreground)); }

	.explain { margin-top: 1rem; padding: 0.875rem 1rem; border-radius: 12px; background: hsl(var(--accent) / 0.6); border-left: 3px solid hsl(var(--sun)); }
	.explain-h { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: hsl(var(--accent-foreground)); }
	.explain-b { margin-top: 0.375rem; font-size: 0.9375rem; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
	.badge.marked { background: hsl(var(--review) / 0.12); color: hsl(var(--review)); }
</style>
