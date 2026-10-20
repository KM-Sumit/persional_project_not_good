<script lang="ts">
	// One test as a compact full-row tap target: icon tile, title + one inline badge, ONE meta line, chevron.
	// A locked paid test ends with an Unlock link to checkout (value first, upsell last).
	import { ChevronRight, ClipboardList, FileClock, KeyRound, Lock, Play, Timer } from '@lucide/svelte';
	import type { CatalogCard } from '../schema';
	import { fmtNum } from './exam';

	let { t, i = 0 }: { t: CatalogCard; i?: number } = $props();
	const href = $derived(t.inProgressAttemptId ? `/app/tests/${t.id}/attempt/${t.inProgressAttemptId}` : `/app/tests/${t.id}`);
	const Icon = $derived(t.inProgressAttemptId ? Play : t.kind === 'pyq' ? FileClock : t.kind === 'mock' ? Timer : ClipboardList);
	const meta = $derived(
		[
			`${t.questionCount} Q`,
			`${t.durationMin} min`,
			t.bestScore != null ? `Best ${fmtNum(t.bestScore)}/${fmtNum(t.totalMarks)}` : `${fmtNum(t.totalMarks)} marks`,
			t.maxAttempts && t.attemptsUsed ? `${t.attemptsUsed}/${t.maxAttempts} tries` : null
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<div class="list-row test-row rise" style="--i: {i}">
	<span class="leading-icon" class:is-live={!!t.inProgressAttemptId}><Icon /></span>
	<div class="grow">
		<div class="head">
			<a {href} class="row-link title">{t.title}</a>
			{#if t.inProgressAttemptId}<span class="badge badge-primary">Resume</span>
			{:else if t.lock === 'paid'}<span class="badge badge-warning"><Lock class="size-3" />Paid</span>
			{:else if t.lock === 'password'}<span class="badge"><KeyRound class="size-3" />Password</span>
			{:else if t.access === 'paid'}<span class="badge badge-success">Purchased</span>
			{:else if t.access === 'open'}<span class="badge badge-success">Free</span>{/if}
		</div>
		<p class="meta tabular">{meta}</p>
	</div>
	{#if t.lock === 'paid'}
		<a class="btn btn-sm btn-secondary unlock" href="/app/checkout?test={t.id}">Unlock{#if t.priceInr}&nbsp;<span class="tabular">₹{t.priceInr}</span>{/if}</a>
	{:else}
		<ChevronRight class="chev" aria-hidden="true" />
	{/if}
</div>

<style>
	.test-row { position: relative; }
	.test-row:hover { background: hsl(var(--muted) / 0.6); }
	.head { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
	.head .badge { flex-shrink: 0; }
	.row-link { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	/* The title link covers the whole row; the Unlock link sits above it. */
	.row-link::after { content: ''; position: absolute; inset: 0; }
	.row-link:focus-visible { outline: none; }
	.row-link:focus-visible::after { outline: 2px solid hsl(var(--ring)); outline-offset: -2px; }
	.unlock { position: relative; z-index: 1; flex-shrink: 0; }
	.leading-icon.is-live { background: hsl(var(--primary) / 0.12); color: hsl(var(--primary)); }
</style>
