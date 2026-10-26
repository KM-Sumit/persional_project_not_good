<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { CalendarClock, ChevronRight, CircleAlert, KeyRound, Lock, LoaderCircle, Play, RotateCcw } from '@lucide/svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { Countdown, Markdown } from '#lib/components/kit';
	import PaletteLegend from '#lib/features/tests/components/PaletteLegend.svelte';
	import { KIND_LABEL, fmtDate, fmtNum, fmtWhen, minutes } from '#lib/features/tests/components/exam';
	import LangPick from '#lib/features/tests/components/LangPick.svelte';

	let { data, form } = $props();
	const t = $derived(data.test);
	let busy = $state(false);

	const resumeHref = $derived(t.inProgressAttemptId ? `/app/tests/${t.id}/attempt/${t.inProgressAttemptId}` : null);
	const attemptsLeft = $derived(t.maxAttempts == null ? null : Math.max(0, t.maxAttempts - t.attemptsUsed));
	/** Why Start is not available, in one sentence (null = can start). */
	const blocker = $derived.by(() => {
		if (resumeHref) return null;
		if (t.window === 'upcoming') return 'This test has not opened yet.';
		if (t.window === 'ended') return 'This test has ended.';
		if (t.lock === 'paid') return t.setId ? 'This set is paid. One payment opens every test in it.' : 'This is a paid test. Unlock it to start.';
		if (t.questionCount === 0) return 'This test has no questions yet.';
		if (attemptsLeft === 0) return t.maxAttempts === 1 ? 'You have already taken this test.' : `You have used all ${t.maxAttempts} attempts.`;
		return null;
	});
	const needsPassword = $derived(!resumeHref && t.lock === 'password' && !blocker);
</script>

<svelte:head><title>{t.title} · Tests · UCI</title></svelte:head>

<div class="page-narrow">
	<PageHeader title={t.title} eyebrow="{KIND_LABEL[t.kind]}{data.examName ? ` · ${data.examName}` : ''}" crumbs={[{ href: '/app/tests', label: 'Tests' }]} />
	{#if t.description}<p class="muted mt-2">{t.description}</p>{/if}

	<div class="stats stats-4 mt-5 rise">
		<div class="stat"><div class="stat-value font-mono">{t.questionCount}</div><div class="stat-label">Questions</div></div>
		<div class="stat"><div class="stat-value font-mono">{fmtNum(t.totalMarks)}</div><div class="stat-label">Total marks</div></div>
		<div class="stat"><div class="stat-value font-mono">{t.durationMin}</div><div class="stat-label">Minutes</div></div>
		<div class="stat">
			<div class="stat-value font-mono">{t.negativeMarks > 0 ? `−${fmtNum(t.negativeMarks)}` : 'None'}</div>
			<div class="stat-label">Negative marking</div>
		</div>
	</div>

	{#if t.startsAt || t.endsAt}
		<div class="card card-pad window mt-4 rise" style="--i: 1">
			<CalendarClock class="size-5 shrink-0" aria-hidden="true" />
			<div class="min-w-0 flex-1">
				{#if t.window === 'upcoming' && t.startsAt}
					<p class="font-semibold">Opens {fmtWhen(t.startsAt)} IST</p>
					<p class="small muted">Starts in <b class="text-foreground"><Countdown to={t.startsAt} serverNow={data.serverNow} warnAt={0} onend={() => invalidateAll()} /></b>, by the institute's clock.</p>
				{:else if t.window === 'live'}
					<p class="font-semibold"><span class="badge badge-live mr-1">Live</span> Open now</p>
					{#if t.endsAt}<p class="small muted">Closes {fmtWhen(t.endsAt)} IST, in <b class="text-foreground"><Countdown to={t.endsAt} serverNow={data.serverNow} warnAt={900} onend={() => invalidateAll()} /></b></p>{/if}
				{:else}
					<p class="font-semibold">Closed</p>
					{#if t.endsAt}<p class="small muted">Ended {fmtWhen(t.endsAt)} IST.</p>{/if}
				{/if}
			</div>
		</div>
	{/if}

	<section class="card mt-4 rise" style="--i: 2" aria-labelledby="ins-h">
		<div class="card-head"><h2 id="ins-h">Instructions</h2></div>
		<div class="card-pad">
			<ul class="rules">
				<li>Each question carries <b class="font-mono">{fmtNum(t.marksPerQuestion)}</b> mark{t.marksPerQuestion === 1 ? '' : 's'}{#if t.negativeMarks > 0}; a wrong answer costs <b class="font-mono">{fmtNum(t.negativeMarks)}</b>{:else}; no marks are cut for wrong answers{/if}. Skipped questions score 0.</li>
				<li>The timer runs on the institute's clock and keeps running if you leave. The test submits itself when time is up.</li>
				<li>Answers save on your phone first, then to the server. If the net drops, keep going; they send when it is back.</li>
				{#if t.maxAttempts}<li>You get <b class="font-mono">{t.maxAttempts}</b> attempt{t.maxAttempts === 1 ? '' : 's'}{#if t.attemptsUsed}; you have used <b class="font-mono">{t.attemptsUsed}</b>{/if}.</li>{/if}
				{#if t.lock === 'password'}<li>Ask your teacher for the password. After 5 wrong tries, wait 15 minutes.</li>{/if}
			</ul>
			{#if data.instructionsHtml}
				<!-- Server-rendered, sanitised markdown. -->
				<div class="mt-4"><Markdown html={data.instructionsHtml} /></div>
			{/if}
			<p class="eyebrow mt-5 mb-3">Question palette</p>
			<PaletteLegend />
			<div class="mt-5"><LangPick /></div>
		</div>
	</section>

	{#if t.attempts.length}
		<section class="mt-6" aria-labelledby="prev-h">
			<div class="section-head"><h2 id="prev-h" class="section-title">Your attempts</h2></div>
			<div class="list">
				{#each t.attempts as a (a.attemptId)}
					<a class="list-row" href={a.status === 'in_progress' ? `/app/tests/${t.id}/attempt/${a.attemptId}` : `/app/results/${a.attemptId}`}>
						<span class="leading-icon font-mono text-sm">#{a.number}</span>
						<div class="grow">
							<p class="title">{a.status === 'in_progress' ? 'In progress' : a.score != null ? `${fmtNum(a.score)} / ${fmtNum(a.maxScore ?? 0)}` : 'Submitted'}</p>
							<p class="meta tabular">
								{fmtDate(a.startedAt)}{#if a.timeTakenSec != null} · {minutes(a.timeTakenSec)}{/if}{#if a.status === 'expired'} · auto-submitted{/if}
							</p>
						</div>
						{#if a.percentage != null}<span class="trail font-mono small" class:score-good={a.percentage >= 70} class:score-mid={a.percentage >= 40 && a.percentage < 70} class:score-low={a.percentage < 40}>{a.percentage}%</span>{/if}
						<ChevronRight class="chev" />
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>

<div class="actionbar inline-desktop">
	<div class="actionbar-inner start-bar">
		{#if resumeHref}
			<a class="btn btn-primary btn-lg" href={resumeHref}><RotateCcw /> Resume test</a>
		{:else if t.lock === 'paid' && !blocker?.includes('ended')}
			<a class="btn btn-primary btn-lg" href={t.setProductId ? `/app/checkout?product=${t.setProductId}` : `/app/checkout?test=${t.id}`}><Lock /> Unlock{#if (t.setId ? t.setPriceInr : t.priceInr)}&nbsp;for <span class="font-mono">₹{t.setId ? t.setPriceInr : t.priceInr}</span>{/if}</a>
		{:else}
			<form
				method="POST"
				action="?/start"
				class="start-form"
				use:enhance={() => {
					busy = true;
					return async ({ result, update }) => {
						if (result.type === 'redirect') await goto(result.location);
						else await update({ reset: false });
						busy = false;
					};
				}}
			>
				{#if form?.error}
					<p class="alert {form.locked ? 'alert-warning' : 'alert-danger'} flex gap-2" role="alert"><CircleAlert class="size-4 shrink-0 mt-0.5" />{form.error}</p>
				{:else if blocker}
					<p class="small muted text-center md:text-right">{blocker}</p>
				{/if}
				<div class="start-row">
					{#if needsPassword}
						<label class="pw">
							<span class="sr-only">Test password</span>
							<KeyRound aria-hidden="true" />
							<input class="input" name="password" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Test password" required disabled={!!form?.locked} />
						</label>
					{/if}
					<button class="btn btn-primary btn-lg" disabled={busy || !!blocker || !!form?.locked}>
						{#if busy}<LoaderCircle class="animate-spin" />{:else}<Play />{/if}
						{t.attemptsUsed ? 'Start again' : 'Start test'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.window { display: flex; gap: 0.75rem; align-items: flex-start; }
	.rules { display: grid; gap: 0.5rem; padding-left: 1.125rem; list-style: disc; font-size: 0.9375rem; line-height: 1.5; }
	.rules li::marker { color: hsl(var(--muted-foreground)); }
	.start-bar { display: block; }
	.start-bar > .btn { width: 100%; }
	.start-form { display: grid; gap: 0.625rem; }
	.start-row { display: flex; gap: 0.5rem; }
	.start-row > .btn { flex: 1; }
	.pw { position: relative; flex: 1.3; min-width: 0; }
	.pw > :global(svg) { position: absolute; left: 0.875rem; top: 50%; translate: 0 -50%; width: 18px; height: 18px; color: hsl(var(--muted-foreground)); }
	.pw .input { padding-left: 2.5rem; min-height: 52px; font-family: var(--font-mono); font-size: 16px; }
	@media (min-width: 768px) {
		/* Desktop: the one action stays in reach while the instructions scroll. */
		.actionbar.inline-desktop { position: sticky; bottom: 0; max-width: calc(40rem + 2 * var(--gutter)); margin-inline: auto; padding: 1rem var(--gutter); background: linear-gradient(transparent, hsl(var(--background)) 35%); }
		.start-bar > .btn { width: auto; margin-left: auto; display: flex; }
		.start-row { justify-content: flex-end; }
		.start-row > .btn { flex: 0 0 auto; }
		.pw { flex: 0 1 16rem; }
	}
</style>
