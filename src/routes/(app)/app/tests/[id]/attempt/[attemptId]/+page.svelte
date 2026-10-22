<script lang="ts">
	// Full-screen CBT attempt. Local-first: every change lands in localStorage at once and syncs in the
	// background (retry + backoff); the submit carries anything unsynced. The clock is the server deadline.
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, CloudOff, Eraser, LayoutGrid, LoaderCircle, Send, Timer, WifiOff, X } from '@lucide/svelte';
	import { Sheet } from '#lib/components/ui';
	import Palette from '#lib/features/tests/components/Palette.svelte';
	import PaletteLegend from '#lib/features/tests/components/PaletteLegend.svelte';
	import { LETTERS, STATE_LABEL, STATE_ORDER, clock, countStates, fmtNum, qState } from '#lib/features/tests/components/exam';
	import { haptic } from '#lib/client/platform';

	type Ans = { selected: number | null; marked: boolean };
	type Saved = { answers: Record<string, Ans>; dirty: string[]; visited: string[]; index: number };

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const s = data.screen as Extract<typeof data.screen, { state: 'open' }>;
	const qs = s.questions;
	const total = qs.length;
	const storeKey = `uci-attempt-${s.attemptId}`;
	const answerUrl = `/api/attempts/${s.attemptId}/answer`;

	let answers = $state<Record<string, Ans>>(Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, { selected: v.selected, marked: v.marked }])));
	let visited = $state<Record<string, true>>(Object.fromEntries(Object.keys(s.answers).map((k) => [k, true as const])));
	let dirty = $state<Record<string, true>>({});
	const version: Record<string, number> = {};
	const timeDelta: Record<string, number> = {};
	let index = $state(Math.max(0, qs.findIndex((q) => s.answers[q.id]?.selected == null)));
	let dir = $state(0);
	let justPicked = $state('');

	let paletteOpen = $state(false);
	let submitOpen = $state(false);
	let submitting = $state(false);
	let locked = $state(false);
	let online = $state(true);
	let syncing = $state(false);
	let syncFailed = $state(false);
	let savedOnce = $state(false);
	let formEl = $state<HTMLFormElement>();

	const current = $derived(qs[index]);
	const cur = $derived(answers[current.id]);
	const states = $derived(qs.map((q) => qState(answers[q.id], !!visited[q.id] || q.id === current.id)));
	const counts = $derived(countStates(states));
	const answeredCount = $derived(counts.answered + counts['answered-marked']);
	const pendingCount = $derived(Object.keys(dirty).length);
	const pendingJson = $derived(
		JSON.stringify(Object.keys(dirty).map((id) => ({ questionId: id, selected: answers[id]?.selected ?? null, marked: answers[id]?.marked ?? false, timeSpentDelta: 0 })))
	);

	// ---------- local-first persistence ----------
	function persist() {
		try {
			const v: Saved = { answers, dirty: Object.keys(dirty), visited: Object.keys(visited), index };
			localStorage.setItem(storeKey, JSON.stringify(v));
		} catch {
			/* private mode / quota: the server copy still works */
		}
	}
	function restore() {
		try {
			const v = JSON.parse(localStorage.getItem(storeKey) ?? 'null') as Saved | null;
			if (!v || typeof v !== 'object') return;
			const ids = new Set(qs.map((q) => q.id));
			// Only unsynced local answers win over the server; everything else the server already has.
			for (const id of v.dirty ?? []) {
				if (!ids.has(id) || !v.answers?.[id]) continue;
				answers[id] = { selected: v.answers[id].selected ?? null, marked: !!v.answers[id].marked };
				dirty[id] = true;
			}
			for (const id of v.visited ?? []) if (ids.has(id)) visited[id] = true;
			if (Number.isInteger(v.index) && v.index >= 0 && v.index < total) index = v.index;
		} catch {
			/* corrupt entry: ignore */
		}
	}

	function changed(id: string) {
		version[id] = (version[id] ?? 0) + 1;
		dirty[id] = true;
		persist();
		void flush();
	}

	// ---------- background sync ----------
	const BACKOFF = [500, 1000, 2000, 4000];
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	/** HTTP status, or 0 when the network failed every retry. */
	async function post(payload: unknown): Promise<number> {
		for (let i = 0; ; i++) {
			try {
				const res = await fetch(answerUrl, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					signal: AbortSignal.timeout(20_000)
				});
				if (res.status < 500) return res.status;
			} catch {
				/* network: retry */
			}
			if (i >= BACKOFF.length || !navigator.onLine) return 0;
			await sleep(BACKOFF[i]);
		}
	}

	async function flush() {
		if (syncing || submitting) return;
		syncing = true;
		try {
			for (let id = Object.keys(dirty)[0]; id; id = Object.keys(dirty)[0]) {
				const v = version[id] ?? 0;
				const a = answers[id] ?? { selected: null, marked: false };
				const delta = Math.min(3600, Math.round(timeDelta[id] ?? 0));
				const status = await post({ questionId: id, selected: a.selected, marked: a.marked, timeSpentDelta: delta });
				if (status === 409) return closeNow();
				if (status === 200 || status === 400 || status === 404) {
					// 400/404: the server will never take this row; drop it instead of retrying forever.
					timeDelta[id] = Math.max(0, (timeDelta[id] ?? 0) - delta);
					if ((version[id] ?? 0) === v) delete dirty[id];
					if (status === 200) savedOnce = true;
					syncFailed = false;
					persist();
				} else {
					syncFailed = true;
					return;
				}
			}
		} finally {
			syncing = false;
		}
	}

	/** Tab hidden: fire-and-forget the unsynced answers (keepalive survives backgrounding). */
	function flushKeepalive() {
		for (const id of Object.keys(dirty)) {
			const a = answers[id];
			if (!a) continue;
			void fetch(answerUrl, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId: id, selected: a.selected, marked: a.marked, timeSpentDelta: 0 }),
				keepalive: true
			}).catch(() => undefined);
		}
	}

	// ---------- actions ----------
	let enteredAt = 0;
	function leaveCurrent() {
		const id = current.id;
		const sec = (performance.now() - enteredAt) / 1000;
		enteredAt = performance.now();
		visited[id] = true;
		timeDelta[id] = (timeDelta[id] ?? 0) + sec;
		// Record time (and the visit) once it is worth a request.
		if (timeDelta[id] >= 2 && !dirty[id]) changed(id);
		else persist();
	}

	function go(i: number) {
		const next = Math.max(0, Math.min(total - 1, i));
		paletteOpen = false;
		if (next === index) return;
		leaveCurrent();
		dir = next > index ? 1 : -1;
		index = next;
		persist();
		if (scrollY > 0) window.scrollTo({ top: 0 });
	}

	function pick(choice: number) {
		if (locked || submitting) return;
		answers[current.id] = { selected: choice, marked: cur?.marked ?? false };
		justPicked = `${current.id}:${choice}`;
		haptic();
		changed(current.id);
	}
	function clearPick() {
		if (locked || cur?.selected == null) return;
		answers[current.id] = { selected: null, marked: cur.marked };
		changed(current.id);
	}
	function toggleMark() {
		if (locked) return;
		answers[current.id] = { selected: cur?.selected ?? null, marked: !cur?.marked };
		changed(current.id);
	}
	function markAndNext() {
		if (locked) return;
		if (!cur?.marked) toggleMark();
		next();
	}
	function next() {
		if (index < total - 1) go(index + 1);
		else openSubmit();
	}
	function openSubmit() {
		leaveCurrent();
		paletteOpen = false;
		submitOpen = true;
	}

	function submit() {
		if (submitting) return;
		leaveCurrent();
		formEl?.requestSubmit();
	}
	/** The server closed the attempt (submitted elsewhere or graded at the deadline): go to the result. */
	function closeNow() {
		locked = true;
		submit();
	}

	// ---------- clock (server deadline, corrected by the server/device offset) ----------
	const offset = new Date(s.serverNow).getTime() - Date.now();
	const deadline = new Date(s.deadlineAt).getTime();
	const leftNow = () => Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000));
	let left = $state(leftNow());
	let announce = $state('');
	const warn = $derived(left <= 300);
	const danger = $derived(left <= 60);

	onMount(() => {
		restore();
		enteredAt = performance.now();
		online = navigator.onLine;
		persist();
		void flush();

		let warned5 = left <= 300;
		let warned1 = left <= 60;
		const tick = setInterval(async () => {
			left = leftNow();
			if (!warned5 && left <= 300) (warned5 = true), (announce = '5 minutes left.');
			if (!warned1 && left <= 60) (warned1 = true), (announce = '1 minute left.'), haptic(30);
			if (left === 0 && !locked) {
				locked = true;
				clearInterval(tick);
				submitOpen = false;
				await Promise.race([flush(), sleep(4000)]);
				submit();
			}
		}, 1000);
		if (left === 0) {
			locked = true;
			submit();
		}
		const retry = setInterval(() => pendingCount && void flush(), 15_000);
		const onOnline = () => ((online = true), void flush());
		const onOffline = () => (online = false);
		const onVis = () => {
			if (document.visibilityState === 'hidden') {
				persist();
				flushKeepalive();
			} else {
				left = leftNow();
				void flush();
			}
		};
		// bfcache restore after submit: reload so the server sends us to the result.
		const onShow = (e: PageTransitionEvent) => e.persisted && location.reload();
		addEventListener('online', onOnline);
		addEventListener('offline', onOffline);
		addEventListener('pageshow', onShow);
		document.addEventListener('visibilitychange', onVis);
		return () => {
			clearInterval(tick);
			clearInterval(retry);
			removeEventListener('online', onOnline);
			removeEventListener('offline', onOffline);
			removeEventListener('pageshow', onShow);
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	// ---------- keyboard + swipe ----------
	function onkeydown(e: KeyboardEvent) {
		if (paletteOpen || submitOpen || e.metaKey || e.ctrlKey || e.altKey) return;
		if ((e.target as HTMLElement).closest('input:not([type=radio]),textarea,select')) return;
		const k = e.key.toUpperCase();
		if (e.key === 'ArrowRight') go(index + 1);
		else if (e.key === 'ArrowLeft') go(index - 1);
		else if (k === 'M') toggleMark();
		else {
			const i = current.options.findIndex((_, i) => String(i + 1) === k || LETTERS[i] === k);
			if (i >= 0) pick(i);
			else return;
		}
		e.preventDefault();
	}
	let tx = 0;
	let ty = 0;
	const ontouchstart = (e: TouchEvent) => ([tx, ty] = [e.touches[0].clientX, e.touches[0].clientY]);
	function ontouchend(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - tx;
		const dy = e.changedTouches[0].clientY - ty;
		if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || (e.target as HTMLElement).closest('pre,table,.katex-display')) return;
		go(index + (dx < 0 ? 1 : -1));
	}
</script>

<svelte:head><title>{s.test.title} · Attempt · UCI</title></svelte:head>
<svelte:window {onkeydown} />

{#snippet saveState()}
	<span class="save-state" aria-live="polite">
		{#if !online && pendingCount}<CloudOff class="size-3.5 text-warning" /><span class="hidden sm:inline">{pendingCount} on device</span>
		{:else if syncing}<LoaderCircle class="size-3.5 animate-spin" /><span class="hidden sm:inline">Saving</span>
		{:else if syncFailed && pendingCount}<CloudOff class="size-3.5 text-warning" /><span class="hidden sm:inline">{pendingCount} waiting</span>
		{:else if savedOnce || (!pendingCount && answeredCount > 0)}<Check class="size-3.5 text-success" /><span class="hidden sm:inline">Saved</span>{/if}
	</span>
{/snippet}

{#snippet summary()}
	<ul class="summary">
		{#each STATE_ORDER as st (st)}
			<li><span class="pshape" data-state={st} aria-hidden="true"></span><span class="flex-1">{STATE_LABEL[st]}</span><b class="font-mono tabular">{counts[st]}</b></li>
		{/each}
	</ul>
{/snippet}

<div class="exam">
	<header class="exam-bar">
		<div class="exam-bar-inner">
			<a href="/app/tests/{s.test.id}" class="icon-btn" aria-label="Leave (answers are saved, the timer keeps running)"><X /></a>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-semibold leading-tight">{s.test.title}</p>
				<p class="tiny muted tabular truncate">{answeredCount}/{total} answered</p>
			</div>
			{@render saveState()}
			<div class="timer" class:is-warn={warn} class:is-danger={danger} role="timer" aria-label="Time left {clock(left)}">
				<Timer class="size-4" /><span class="font-mono tabular">{clock(left)}</span>
			</div>
			<button type="button" class="q-chip font-mono tabular" onclick={() => (paletteOpen = true)} aria-label="Question {index + 1} of {total}. Open question palette">
				<LayoutGrid class="size-4" /><span>{index + 1}<span class="muted">/{total}</span></span>
			</button>
		</div>
		<div class="progress rounded-none" aria-hidden="true"><span style="width: {(answeredCount / total) * 100}%"></span></div>
		<p class="sr-only" aria-live="assertive">{announce}</p>
	</header>

	{#if !online}
		<p class="offline" role="status">
			<WifiOff class="size-4 shrink-0" />
			<span>You are offline. Keep answering{#if pendingCount}: <b class="font-mono">{pendingCount}</b> answer{pendingCount === 1 ? ' is' : 's are'} safe on this device{/if}. They send when the net is back.</span>
		</p>
	{/if}

	<div class="exam-wrap">
		<section class="min-w-0" aria-label="Question {index + 1} of {total}" {ontouchstart} {ontouchend}>
			{#key current.id}
				<article class="qcard" data-dir={dir}>
					<div class="q-meta">
						<p class="eyebrow min-w-0 truncate" id="q-label">
							Question {index + 1} of {total}{#if current.topic}<span class="font-normal normal-case">{` · ${current.topic}`}</span>{/if}
						</p>
						<span class="marks font-mono tabular">+{fmtNum(current.marks)}{#if current.negativeMarks > 0}&nbsp;/ −{fmtNum(current.negativeMarks)}{/if}</span>
					</div>
					<p class="prompt">{current.prompt}</p>
					{#if current.imageFileId}
						<img class="q-img" src="/api/files/{current.imageFileId}" alt="Figure for question {index + 1}" loading="lazy" />
					{/if}
					<div class="omr-list mt-5" role="radiogroup" aria-labelledby="q-label">
						{#each current.options as text, i (i)}
							<label class="omr press" class:is-just={justPicked === `${current.id}:${i}`}>
								<input type="radio" name="pick-{current.id}" value={i} checked={cur?.selected === i} disabled={locked || submitting} onchange={() => pick(i)} />
								<span class="omr-bubble" aria-hidden="true">{LETTERS[i]}</span>
								<span class="omr-text">{text}</span>
							</label>
						{/each}
					</div>
					{#if cur?.marked}
						<p class="marked-note"><BookmarkCheck class="size-4" />Marked for review{cur.selected != null ? '. Your answer still counts.' : ''}</p>
					{/if}
					<p class="kbd-hint tiny muted mt-4">Keys: 1–{current.options.length} pick · ← → move · M mark for review</p>
				</article>
			{/key}
		</section>

		<aside class="side card card-pad" aria-label="Question palette">
			<div class="flex items-baseline justify-between gap-2">
				<h2 class="section-title">Questions</h2>
				<span class="small muted tabular">{answeredCount}/{total}</span>
			</div>
			<div class="mt-3"><Palette {states} current={index} onjump={go} /></div>
			<div class="mt-4"><PaletteLegend {counts} /></div>
			<button type="button" class="btn btn-secondary btn-block mt-5" disabled={submitting} onclick={openSubmit}><Send /> Submit test</button>
		</aside>
	</div>

	<div class="actionbar exam-actions">
		<div class="actionbar-inner">
			<button type="button" class="btn btn-secondary btn-fixed" disabled={index === 0} onclick={() => go(index - 1)} aria-label="Previous question">
				<ChevronLeft /><span class="hidden md:inline">Previous</span>
			</button>
			<button type="button" class="btn btn-secondary btn-fixed mark-btn" class:is-on={cur?.marked} disabled={locked} onclick={markAndNext} aria-label={cur?.marked ? 'Marked for review. Go to next question' : 'Mark for review and go to next question'}>
				{#if cur?.marked}<BookmarkCheck />{:else}<Bookmark />{/if}<span class="lbl">Mark<span class="hidden md:inline">&nbsp;for review</span><span class="hidden lg:inline">&nbsp;& next</span></span>
			</button>
			<button type="button" class="btn btn-ghost btn-fixed" disabled={locked || cur?.selected == null} onclick={clearPick} aria-label="Clear answer">
				<Eraser /><span class="hidden sm:inline">Clear</span>
			</button>
			<button type="button" class="btn btn-primary" disabled={submitting} onclick={next}>
				{#if index < total - 1}Save & next <ChevronRight />{:else}<Send /> Review & submit{/if}
			</button>
		</div>
	</div>
</div>

<form
	bind:this={formEl}
	method="POST"
	action="?/submit"
	hidden
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				try {
					localStorage.removeItem(storeKey);
				} catch {
					/* ignore */
				}
				await goto(result.location, { replaceState: true, invalidateAll: true });
			} else {
				submitting = false;
				locked = left === 0;
				await update();
			}
		};
	}}
>
	<input type="hidden" name="pending" value={pendingJson} />
</form>

<Sheet bind:open={paletteOpen} title="Questions" description="{answeredCount} of {total} answered">
	<Palette {states} current={index} onjump={go} />
	<div class="mt-5"><PaletteLegend {counts} /></div>
	{#snippet footer()}
		<button type="button" class="btn btn-primary btn-lg" disabled={submitting} onclick={openSubmit}><Send /> Submit test</button>
	{/snippet}
</Sheet>

<Sheet bind:open={submitOpen} title="Submit test?" description="You cannot change answers after this. Time left: {clock(left)}.">
	{@render summary()}
	{#if counts['not-answered'] + counts['not-visited'] + counts.marked > 0}
		<p class="alert alert-warning mt-4">
			{counts['not-answered'] + counts['not-visited'] + counts.marked} question{counts['not-answered'] + counts['not-visited'] + counts.marked === 1 ? '' : 's'} without an answer will score 0.
		</p>
	{/if}
	{#if pendingCount}
		<p class="small muted mt-3">{pendingCount} answer{pendingCount === 1 ? '' : 's'} not synced yet will be sent with the submit.</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-secondary btn-lg" onclick={() => (submitOpen = false)}>Go back</button>
		<button type="button" class="btn btn-primary btn-lg" disabled={submitting} onclick={submit}>
			{#if submitting}<LoaderCircle class="animate-spin" />{:else}<Send />{/if} Submit
		</button>
	{/snippet}
</Sheet>

<style>
	.exam-bar {
		position: sticky;
		top: 0;
		z-index: 30;
		background: hsl(var(--background) / 0.94);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid hsl(var(--border));
		padding-top: var(--safe-top);
	}
	.exam-bar-inner {
		max-width: 76rem;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 56px;
		padding: 0.25rem 0.5rem;
	}
	.exam-bar .progress > span { transition: width 0.3s var(--ease-snappy); }
	.save-state { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; min-width: 14px; }
	.timer {
		display: inline-flex; align-items: center; gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		border-radius: 999px;
		background: hsl(var(--muted));
		font-weight: 600;
		font-size: 0.9375rem;
		flex-shrink: 0;
	}
	.timer.is-warn { background: hsl(var(--warning) / 0.14); color: hsl(var(--warning)); }
	.timer.is-danger { background: hsl(var(--danger) / 0.12); color: hsl(var(--danger)); animation: cq-pulse 1s ease-in-out infinite; }
	.q-chip {
		display: inline-flex; align-items: center; gap: 0.25rem;
		min-height: 44px; padding: 0 0.625rem;
		border-radius: 12px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		font-size: 0.875rem; font-weight: 600;
		flex-shrink: 0;
	}
	@media (min-width: 1024px) { .q-chip { display: none; } }

	.offline {
		display: flex; gap: 0.5rem; align-items: flex-start;
		max-width: 76rem; margin: 0.75rem auto 0;
		padding: 0.625rem 0.875rem;
		border-radius: 12px;
		background: hsl(var(--warning) / 0.12);
		color: hsl(var(--warning));
		font-size: 0.8125rem;
		margin-inline: max(1rem, calc((100% - 76rem) / 2));
	}

	.exam-wrap { max-width: 76rem; margin: 0 auto; padding: 1rem 1rem 1.5rem; }
	@media (min-width: 768px) { .exam-wrap { padding: 1.75rem 1.5rem 2rem; } }
	@media (min-width: 1024px) {
		.exam-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 2rem; align-items: start; padding-top: 2.25rem; }
	}
	.side { display: none; }
	@media (min-width: 1024px) {
		.side { display: block; position: sticky; top: calc(64px + 1.5rem + var(--safe-top)); }
	}

	.qcard { animation: q-in 0.22s var(--ease-snappy) backwards; max-width: 46rem; }
	.qcard[data-dir='1'] { --from: 24px; }
	.qcard[data-dir='-1'] { --from: -24px; }
	@keyframes q-in { from { opacity: 0; transform: translateX(var(--from, 0)); } }
	@media (min-width: 1024px) { .qcard { animation-name: q-fade; } }
	@keyframes q-fade { from { opacity: 0; } }
	.q-meta { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
	.marks { font-size: 0.75rem; color: hsl(var(--muted-foreground)); white-space: nowrap; }
	.prompt { margin-top: 0.5rem; font-size: 1.125rem; line-height: 1.55; font-weight: 600; white-space: pre-line; overflow-wrap: anywhere; }
	@media (min-width: 768px) { .prompt { font-size: 1.25rem; } }
	.q-img { margin-top: 1rem; max-width: 100%; max-height: 22rem; border-radius: 12px; border: 1px solid hsl(var(--border)); background: hsl(var(--surface)); }
	.omr { align-items: center; touch-action: pan-x pan-y; }
	.omr .omr-text { padding-top: 0; white-space: pre-line; }
	.omr.is-just:has(input:checked) .omr-bubble { animation: ink 0.14s ease-out; }
	@keyframes ink { from { box-shadow: inset 0 0 0 14px hsl(var(--surface)); } }
	.marked-note { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.875rem; font-size: 0.8125rem; font-weight: 600; color: hsl(var(--review)); }

	.exam-actions .actionbar-inner { max-width: 76rem; gap: 0.5rem; }
	.exam-actions .btn { padding-inline: 0.875rem; }
	.mark-btn.is-on { border-color: hsl(var(--review)); color: hsl(var(--review)); }
	@media (max-width: 380px) { .mark-btn .lbl { display: none; } }
	@media (min-width: 768px) {
		.exam-actions .actionbar-inner > .btn-primary { flex: 0 0 auto; margin-left: auto; min-width: 11rem; }
	}

	.summary { display: grid; gap: 0.25rem; }
	.summary li { display: flex; align-items: center; gap: 0.75rem; min-height: 40px; font-size: 0.9375rem; }
	.summary .pshape { width: 24px; height: 24px; }
	.summary b { font-size: 1rem; }
</style>
