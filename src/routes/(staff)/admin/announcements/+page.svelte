<script lang="ts">
	import { enhance } from '$app/forms';
	import { Eye, Megaphone, Send, Trash2 } from '@lucide/svelte';
	import { EmptyState, PageHeader } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import { toasting } from '../students/_enhance';

	let { data } = $props();

	let audience = $state<'everyone' | 'batch'>('everyone');
	let batchId = $state<string | null>(null);
	let title = $state('');
	let body = $state('');
	let delId = $state('');
	let delOpen = $state(false);
	let delForm = $state<HTMLFormElement>();

	const when = (iso: string) =>
		new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
	const reset = () => ((title = ''), (body = ''), (batchId = null), (audience = 'everyone'));
</script>

<div class="page">
	<PageHeader title="Announcements" subtitle="Lands in every student's inbox in the app" />

	<div class="cols">
		<section class="rise">
			<div class="section-head"><h2 class="section-title">New announcement</h2></div>
			<form class="card card-pad stack" method="POST" action="?/send" use:enhance={toasting(reset)}>
				<div class="field">
					<span class="label">Send to</span>
					<div class="segmented" role="radiogroup" aria-label="Audience">
						<label><input type="radio" name="audience" value="everyone" bind:group={audience} /> Everyone</label>
						<label><input type="radio" name="audience" value="batch" bind:group={audience} /> One batch</label>
					</div>
				</div>
				{#if audience === 'batch'}
					<div class="field"><span class="label">Batch</span><Picker bind:value={batchId} name="batchId" options={data.batches} placeholder="Choose batch" label="Batch" searchable /></div>
				{/if}
				<div class="field"><label class="label" for="n-title">Title</label><input id="n-title" class="input" name="title" bind:value={title} required maxlength="120" placeholder="New mock test is live" /></div>
				<div class="field"><label class="label" for="n-body">Message</label><textarea id="n-body" class="textarea" name="body" bind:value={body} maxlength="2000" rows="4" placeholder="SSC GD full mock opens at 6 PM today. 100 questions, 60 minutes."></textarea></div>
				<div class="field"><label class="label" for="n-href">Link (optional)</label><input id="n-href" class="input" name="href" maxlength="500" placeholder="/app/tests or https://…" /><p class="help">Students tap the announcement to open this.</p></div>
				<button class="btn btn-primary" disabled={!title.trim() || (audience === 'batch' && !batchId)}><Send /> Send announcement</button>
			</form>
		</section>

		<section class="rise" style="--i: 1">
			<div class="section-head"><h2 class="section-title">Sent</h2></div>
			{#if data.sent.length}
				<div class="list">
					{#each data.sent as n (n.id)}
						<div class="list-row">
							<span class="grow">
								<span class="title block">{n.title}</span>
								{#if n.body}<span class="meta block">{n.body}</span>{/if}
								<span class="meta block">{when(n.createdAt)} · {n.batchName ?? 'Everyone'}</span>
							</span>
							<span class="trail reads font-mono tabular small" title="Read by"><Eye /> {n.reads}</span>
							<button class="icon-btn icon-btn-sm" aria-label="Delete {n.title}" onclick={() => ((delId = n.id), (delOpen = true))}><Trash2 /></button>
						</div>
					{/each}
				</div>
				{#if data.next}<a class="btn btn-secondary btn-block mt-3" href="?cursor={encodeURIComponent(data.next)}">Older</a>{/if}
			{:else}
				<div class="card"><EmptyState compact icon={Megaphone} title="Nothing sent yet" body="Your first announcement will show here with how many students read it." /></div>
			{/if}
		</section>
	</div>
</div>

<form bind:this={delForm} method="POST" action="?/delete" hidden use:enhance={toasting()}><input type="hidden" name="id" value={delId} /></form>
<ConfirmSheet bind:open={delOpen} title="Delete this announcement?" body="It disappears from every student's inbox." confirmLabel="Delete" danger onconfirm={() => delForm?.requestSubmit()} />

<style>
	.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
	@media (min-width: 1024px) { .cols { grid-template-columns: 2fr 3fr; align-items: start; } }
	.reads { display: inline-flex; align-items: center; gap: .25rem; color: hsl(var(--muted-foreground)); }
	.reads :global(svg) { width: 14px; height: 14px; }
</style>
