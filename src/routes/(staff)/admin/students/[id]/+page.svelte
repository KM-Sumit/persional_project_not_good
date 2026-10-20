<script lang="ts">
	import { enhance } from '$app/forms';
	import { BookOpen, ClipboardList, KeyRound, Layers, Mail, MessageCircle, Phone, X } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import { toasting } from '../_enhance';

	let { data } = $props();
	const p = $derived(data.profile);

	let batchId = $state<string | null>(null);
	let testId = $state<string | null>(null);
	let confirmSuspend = $state(false);
	let suspendForm = $state<HTMLFormElement>();

	const date = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
	const wa = $derived(p.phone ? `https://wa.me/${p.phone.replace(/\D/g, '')}` : null);
</script>

<div class="page">
	<PageHeader title={p.name} subtitle={p.email} crumbs={[{ href: '/admin/students', label: 'Students' }]}>
		{#snippet actions()}
			{#if data.canSuspend}
				<button class="btn {p.suspended ? 'btn-secondary' : 'btn-danger'}" onclick={() => (p.suspended ? suspendForm?.requestSubmit() : (confirmSuspend = true))}>
					{p.suspended ? 'Restore access' : 'Suspend'}
				</button>
			{/if}
		{/snippet}
	</PageHeader>
	<form bind:this={suspendForm} method="POST" action="?/suspend" hidden use:enhance={toasting()}>
		<input type="hidden" name="suspended" value={p.suspended ? 'false' : 'true'} />
	</form>
	<ConfirmSheet
		bind:open={confirmSuspend}
		title="Suspend {p.name}?"
		body="They are signed out everywhere and cannot sign in until you restore access."
		confirmLabel="Suspend"
		danger
		onconfirm={() => suspendForm?.requestSubmit()}
	/>

	<div class="grid-2">
		<div class="stack">
			<section class="card card-pad rise">
				<div class="flex flex-wrap items-center gap-2 mb-3">
					{#if p.suspended}<Badge tone="danger">Suspended</Badge>{:else if p.onboarded}<Badge tone="success">Active</Badge>{:else}<Badge tone="draft">Not onboarded</Badge>{/if}
					<Badge>{p.role}</Badge>
				</div>
				<dl class="facts">
					<dt>Phone</dt><dd class="font-mono tabular">{p.phone ?? '–'}</dd>
					<dt>City</dt><dd>{p.city ?? '–'}</dd>
					<dt>Exam</dt><dd>{data.examName ?? '–'}</dd>
					<dt>Joined</dt><dd>{date(p.createdAt)}</dd>
					<dt>Last active</dt><dd>{p.lastSeenAt ? date(p.lastSeenAt) : 'Never'}</dd>
				</dl>
				<div class="contact">
					{#if p.phone}<a class="btn btn-secondary btn-sm" href="tel:{p.phone}"><Phone /> Call</a>{/if}
					{#if wa}<a class="btn btn-secondary btn-sm" href={wa} target="_blank" rel="noopener"><MessageCircle /> WhatsApp</a>{/if}
					<a class="btn btn-secondary btn-sm" href="mailto:{p.email}"><Mail /> Email</a>
				</div>
			</section>

			<div class="stats rise" style="--i: 1">
				<div class="stat"><div class="stat-value">{p.stats.attempts}</div><div class="stat-label">Tests taken</div></div>
				<div class="stat"><div class="stat-value">{p.stats.avgPercent == null ? '–' : `${Math.round(p.stats.avgPercent)}%`}</div><div class="stat-label">Average score</div></div>
				<div class="stat"><div class="stat-value">{p.stats.lessonsCompleted}</div><div class="stat-label">Lessons done</div></div>
			</div>

			<section class="rise" style="--i: 2">
				<div class="section-head"><h2 class="section-title">Batches</h2></div>
				<div class="list">
					{#each p.batches as b (b.id)}
						<div class="list-row">
							<span class="leading-icon"><Layers /></span>
							<a class="grow" href="/admin/batches/{b.id}"><span class="title block">{b.name}</span><span class="meta block">{b.sessionName}</span></a>
							<form method="POST" action="?/removeBatch" use:enhance={toasting()}>
								<input type="hidden" name="batchId" value={b.id} />
								<button class="icon-btn" aria-label="Remove from {b.name}"><X /></button>
							</form>
						</div>
					{:else}
						<div class="list-row muted small">Not in any batch.</div>
					{/each}
					<form class="list-row" method="POST" action="?/addBatch" use:enhance={toasting(() => (batchId = null))}>
						<div class="grow"><Picker bind:value={batchId} name="batchId" options={data.batches} placeholder="Add to a batch" label="Batch" searchable /></div>
						<button class="btn btn-secondary btn-sm" disabled={!batchId}>Add</button>
					</form>
				</div>
			</section>

			<section class="rise" style="--i: 3">
				<div class="section-head"><h2 class="section-title">Test access</h2></div>
				<form class="card card-pad stack-sm" method="POST" action="?/grant" use:enhance={toasting(() => (testId = null))}>
					<p class="small muted">Let this student into a password or paid test without the password or payment.</p>
					<Picker bind:value={testId} name="testId" options={data.tests} placeholder="Choose a test" label="Test" searchable />
					<input class="input" name="note" placeholder="Note (optional), e.g. paid in cash" maxlength="200" />
					<button class="btn btn-primary btn-sm" disabled={!testId}><KeyRound /> Grant access</button>
				</form>
			</section>
		</div>

		<div class="stack">
			<section class="rise" style="--i: 2">
				<div class="section-head"><h2 class="section-title">Attempts</h2></div>
				{#if data.attempts.length}
					<div class="list">
						{#each data.attempts as a (a.attemptId)}
							<a class="list-row" href="/admin/tests/{a.testId}/results">
								<span class="grow"><span class="title block">{a.testTitle}</span><span class="meta block">{date(a.startedAt)} · attempt {a.number}</span></span>
								<span class="trail font-mono tabular">
									{#if a.status === 'in_progress'}<Badge tone="live">In progress</Badge>
									{:else}<span class="block font-semibold">{a.percentage == null ? '–' : `${Math.round(a.percentage)}%`}</span><span class="tiny muted">{a.score}/{a.maxScore}</span>{/if}
								</span>
							</a>
						{/each}
					</div>
				{:else}
					<div class="card"><EmptyState compact icon={ClipboardList} title="No attempts yet" /></div>
				{/if}
			</section>

			<section class="rise" style="--i: 3">
				<div class="section-head"><h2 class="section-title">Course progress</h2></div>
				{#if data.courses.length}
					<div class="list">
						{#each data.courses as c (c.id)}
							<div class="list-row">
								<span class="grow">
									<span class="title block">{c.title}</span>
									<span class="progress mt-2 block"><span style="width: {c.progress.percent}%"></span></span>
								</span>
								<span class="trail font-mono tabular small">{c.progress.completed}/{c.progress.total}</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="card"><EmptyState compact icon={BookOpen} title="No courses started" /></div>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.grid-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
	.facts { display: grid; grid-template-columns: auto 1fr; gap: .375rem 1rem; font-size: .875rem; }
	.facts dt { color: hsl(var(--muted-foreground)); }
	.contact { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
	.contact :global(svg) { width: 16px; height: 16px; }
</style>
