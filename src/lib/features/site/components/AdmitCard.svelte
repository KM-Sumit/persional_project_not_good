<script lang="ts">
	// Signature block: the next real live test, set like an exam hall ticket.
	import { ArrowRight } from '@lucide/svelte';
	import type { PublicTest } from '../server/browse';
	import { dayIST, timeIST } from './format';

	let { test }: { test: PublicTest & { examName: string | null } } = $props();
	const start = $derived(test.startsAt!);
	const serial = $derived(test.id.replace(/-/g, '').slice(0, 8).toUpperCase());
	const access = $derived(test.access === 'open' ? 'Free' : test.access === 'password' ? 'Free · password at start' : 'Paid');
</script>

<article class="admit" aria-labelledby="admit-title">
	<header class="admit-head">
		<img src="/brand/uci.png" alt="" width="40" height="40" />
		<div class="min-w-0">
			<p class="admit-kicker">Admit card</p>
			<p class="admit-org">Upendra Competition Institute · Live test</p>
		</div>
		<span class="badge badge-live ml-auto">Next live</span>
	</header>

	<div class="admit-body">
		<div class="min-w-0">
			<p class="admit-label">Test</p>
			<h3 id="admit-title" class="admit-title">{test.title}</h3>
			<dl class="admit-grid">
				{#if test.examName}<div><dt>Exam</dt><dd>{test.examName}</dd></div>{/if}
				<div><dt>Date</dt><dd class="font-mono tabular">{dayIST(start)}</dd></div>
				<div><dt>Starts</dt><dd class="font-mono tabular">{timeIST(start)}</dd></div>
				<div><dt>Duration</dt><dd class="font-mono tabular">{test.durationMin} min</dd></div>
				<div><dt>Questions</dt><dd class="font-mono tabular">{test.questions}</dd></div>
				<div><dt>Max marks</dt><dd class="font-mono tabular">{test.marks}</dd></div>
			</dl>
		</div>
		<div class="admit-stub">
			<p class="admit-label">Serial</p>
			<p class="font-mono tabular admit-serial">{serial}</p>
			<p class="small"><span class="admit-label">Entry</span> {access}</p>
			<a href="/login?next=/app/tests/{test.id}" class="btn btn-primary btn-block">Register free<ArrowRight /></a>
			<p class="tiny muted">One attempt. Rank published when the window closes.</p>
		</div>
	</div>
</article>

<style>
	.admit {
		position: relative;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.admit-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1.25rem;
		border-bottom: 2px solid hsl(var(--foreground));
	}
	.admit-head img {
		border-radius: 999px;
		background: #fff;
		flex-shrink: 0;
	}
	.admit-kicker {
		font-family: var(--font-display);
		font-stretch: 80%;
		font-weight: 800;
		font-size: 1.0625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		line-height: 1.1;
	}
	.admit-kicker span {
		letter-spacing: 0;
		margin-left: 0.375rem;
		color: hsl(var(--primary));
	}
	.admit-org {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.admit-body {
		display: grid;
		gap: 1.25rem;
		padding: 1.25rem;
	}
	@media (min-width: 768px) {
		.admit-body {
			grid-template-columns: minmax(0, 1fr) 15rem;
			gap: 0;
		}
		.admit-body > :first-child {
			padding-right: 1.5rem;
		}
		.admit-stub {
			padding-left: 1.5rem;
			border-left: 2px dashed hsl(var(--border));
		}
	}
	.admit-stub {
		display: grid;
		align-content: start;
		gap: 0.625rem;
	}
	@media (max-width: 767px) {
		.admit-stub {
			padding-top: 1.25rem;
			border-top: 2px dashed hsl(var(--border));
		}
	}
	.admit-label,
	dt {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}
	.admit-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: clamp(1.375rem, 1.1rem + 1vw, 1.875rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
		margin: 0.125rem 0 1rem;
		text-wrap: balance;
	}
	.admit-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-top: 1px solid hsl(var(--border));
		border-left: 1px solid hsl(var(--border));
	}
	@media (min-width: 640px) {
		.admit-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.admit-grid > div {
		padding: 0.5rem 0.75rem;
		border-right: 1px solid hsl(var(--border));
		border-bottom: 1px solid hsl(var(--border));
		min-width: 0;
	}
	dd {
		font-weight: 600;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}
	.admit-serial {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: 0.12em;
	}
</style>
