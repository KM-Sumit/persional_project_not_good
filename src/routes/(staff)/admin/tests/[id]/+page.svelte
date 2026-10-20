<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Archive, Ban, Copy, EyeOff, Send, Trash2 } from '@lucide/svelte';
	import { Button, Switch, toast } from '#lib/components/ui';
	import { ConfirmSheet, DateTimePicker, Picker } from '#lib/components/kit';
	import { fmtIST } from '#lib/features/bank/components/format';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	const t = $derived(data.test);

	// Edit draft: re-seeded whenever the saved test changes.
	let e = $state({ ...data.test });
	$effect(() => {
		e = { ...data.test };
	});
	let saving = $state(false);
	let confirmDelete = $state(false);
	let confirmCancel = $state(false);

	const examOptions = $derived(data.taxonomy.categories.flatMap((c) => c.exams.map((x) => ({ value: x.id, label: x.name, group: c.name }))));
	const subjectOptions = $derived(data.taxonomy.subjects.map((s) => ({ value: s.id, label: s.name })));
	const sessionOptions = $derived(data.sessions.map((s) => ({ value: s.id, label: s.name, hint: s.isCurrent ? 'Current' : undefined })));
	const batchOptions = $derived(data.batches.filter((b) => !e.sessionId || b.sessionId === e.sessionId).map((b) => ({ value: b.id, label: b.name })));

	type Done = Parameters<Exclude<ReturnType<SubmitFunction>, void | Promise<unknown>>>[0];
	const after = async ({ result, update }: Done) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Failed.'), 'error', 6000);
		else if (result.type === 'success') {
			toast(String(result.data?.message ?? 'Done'));
			if (result.data?.password) toast(`New password: ${result.data.password}. Copy it now.`, 'warning', 15000);
		}
		await update({ reset: false });
	};
	const done: SubmitFunction = () => after;
	async function post(action: string) {
		const r = deserialize(await (await fetch(`?/${action}`, { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } })).text());
		if (r.type === 'redirect') goto(r.location);
		else if (r.type === 'failure') toast(String(r.data?.message ?? 'Failed.'), 'error', 6000);
	}
</script>

<svelte:head><title>{t.title} · Tests</title></svelte:head>

<div class="stack-lg">
	<dl class="card facts">
		<a href="/admin/tests/{t.id}/questions"><dt>Questions</dt><dd class="tabular">{t.questionCount} <span class="muted">· {t.totalMarks} marks</span></dd></a>
		<a href="/admin/tests/{t.id}/results"><dt>Attempts</dt><dd class="tabular">{t.attemptCount || 'None yet'}</dd></a>
		<div><dt>Duration</dt><dd class="tabular">{t.durationMin} min <span class="muted">· +{t.marksPerQuestion} / −{t.negativeMarks}</span></dd></div>
		<div><dt>{t.startsAt ? 'Opens' : 'Window'}</dt><dd>{t.startsAt ? fmtIST(t.startsAt) : 'Any time'}</dd></div>
	</dl>

	<section class="card card-pad stack">
		<h2 class="section-title">Status</h2>
		<div class="flex flex-wrap gap-2">
			{#if t.status === 'draft'}
				<form method="POST" action="?/publish" use:enhance={done}><Button type="submit"><Send class="size-4" />Publish test</Button></form>
			{:else if t.status === 'published'}
				<form method="POST" action="?/unpublish" use:enhance={done}><Button variant="secondary" type="submit"><EyeOff class="size-4" />Unpublish</Button></form>
			{/if}
			<form method="POST" action="?/duplicate" use:enhance={done}><Button variant="secondary" type="submit"><Copy class="size-4" />Duplicate</Button></form>
			{#if t.status !== 'archived'}
				<form method="POST" action="?/archive" use:enhance={done}><Button variant="secondary" type="submit"><Archive class="size-4" />Archive</Button></form>
			{/if}
			{#if t.kind === 'live' && t.status !== 'cancelled'}
				<Button variant="secondary" onclick={() => (confirmCancel = true)}><Ban class="size-4" />Cancel live test</Button>
			{/if}
			<Button variant="danger" onclick={() => (confirmDelete = true)}><Trash2 class="size-4" />Delete</Button>
		</div>
		{#if t.status === 'draft' && !t.questionCount}<p class="small muted">Add questions before publishing.</p>{/if}
	</section>

	<form method="POST" action="?/update" class="card card-pad stack" use:enhance={() => ((saving = true), async (r) => ((saving = false), await after(r)))}>
		<h2 class="section-title">Details</h2>
		<div class="field">
			<label class="label" for="e-title">Title</label>
			<input id="e-title" name="title" class="input" required maxlength="200" bind:value={e.title} />
		</div>
		<div class="form-row">
			<div class="field"><span class="label">Exam</span><Picker bind:value={e.examId} name="examId" options={examOptions} placeholder="None" label="Exam" searchable /></div>
			<div class="field"><span class="label">Subject</span><Picker bind:value={e.subjectId} name="subjectId" options={subjectOptions} placeholder="None" label="Subject" searchable /></div>
		</div>
		<div class="form-row">
			<div class="field"><span class="label">Session</span><Picker bind:value={e.sessionId} name="sessionId" options={sessionOptions} placeholder="None" label="Session" /></div>
			<div class="field"><span class="label">Batch</span><Picker bind:value={e.batchId} name="batchId" options={batchOptions} placeholder="All batches" label="Batch" /></div>
		</div>
		<div class="form-row form-row-3">
			<div class="field">
				<label class="label" for="e-dur">Duration (min)</label>
				<input id="e-dur" name="durationMin" type="number" min="1" max="600" class="input" bind:value={e.durationMin} />
			</div>
			<div class="field">
				<label class="label" for="e-marks">Marks per question</label>
				<input id="e-marks" name="marksPerQuestion" type="number" min="0.25" step="0.25" class="input" bind:value={e.marksPerQuestion} />
			</div>
			<div class="field">
				<label class="label" for="e-neg">Negative marks</label>
				<input id="e-neg" name="negativeMarks" type="number" min="0" step="0.25" class="input" bind:value={e.negativeMarks} />
			</div>
		</div>
		<div class="form-row dt-row">
			<div class="field"><span class="label">Opens (IST)</span><DateTimePicker bind:value={e.startsAt} name="startsAt" label="Opens (IST)" /></div>
			<div class="field"><span class="label">Closes (IST)</span><DateTimePicker bind:value={e.endsAt} name="endsAt" label="Closes (IST)" min={e.startsAt ?? undefined} /></div>
		</div>
		{#if t.kind === 'pyq'}
			<div class="form-row form-row-3">
				<div class="field"><label class="label" for="e-year">Year</label><input id="e-year" name="year" type="number" class="input" bind:value={e.year} /></div>
				<div class="field"><label class="label" for="e-shift">Shift</label><input id="e-shift" name="shift" class="input" bind:value={e.shift} /></div>
				<div class="field"><label class="label" for="e-lang">Language</label><input id="e-lang" name="language" class="input" bind:value={e.language} /></div>
			</div>
			<div class="field"><label class="label" for="e-src">Source</label><input id="e-src" name="sourceInfo" class="input" bind:value={e.sourceInfo} /></div>
			<input type="hidden" name="verifiedPyq" value="false" />
			<Switch bind:checked={e.verifiedPyq} name="verifiedPyq" value="true" label="Verified authentic paper" />
		{/if}
		{#if t.access === 'paid'}
			<div class="field"><label class="label" for="e-price">Price (₹)</label><input id="e-price" name="priceInr" type="number" min="0" class="input" bind:value={e.priceInr} /></div>
		{/if}
		<div class="form-row">
			<div class="field">
				<label class="label" for="e-max">Attempts per student</label>
				<input id="e-max" name="maxAttempts" type="number" min="1" max="100" class="input" placeholder={t.kind === 'live' ? '1' : 'Unlimited'} bind:value={e.maxAttempts} />
			</div>
			<div class="field">
				<label class="label" for="e-diff">Difficulty</label>
				<select id="e-diff" name="difficulty" class="select" bind:value={e.difficulty}>
					<option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
				</select>
			</div>
		</div>
		<input type="hidden" name="shuffleQuestions" value="false" />
		<Switch bind:checked={e.shuffleQuestions} name="shuffleQuestions" value="true" label="Shuffle question order" />
		<input type="hidden" name="showSolutions" value="false" />
		<Switch bind:checked={e.showSolutions} name="showSolutions" value="true" label="Show solutions after submit" />
		<div class="field">
			<label class="label" for="e-desc">Description</label>
			<textarea id="e-desc" name="description" class="textarea" rows="2" maxlength="2000" bind:value={e.description}></textarea>
		</div>
		<div class="field">
			<label class="label" for="e-ins">Instructions for students</label>
			<textarea id="e-ins" name="instructions" class="textarea" rows="3" maxlength="10000" bind:value={e.instructions}></textarea>
		</div>
		<div class="flex justify-end"><Button type="submit" loading={saving}>Save changes</Button></div>
	</form>
</div>

<ConfirmSheet
	bind:open={confirmDelete}
	title="Delete this test?"
	body={t.attemptCount ? 'Students have attempted it, so it cannot be deleted. Archive it instead.' : 'The test goes away for good. Its questions stay in the bank.'}
	confirmLabel="Delete test"
	danger
	onconfirm={() => post('delete')}
/>
<ConfirmSheet
	bind:open={confirmCancel}
	title="Cancel this live test?"
	body="Students can no longer start it. This cannot be undone; duplicate it to schedule again."
	confirmLabel="Cancel test"
	danger
	onconfirm={async () => {
		await post('cancel');
		goto(location.pathname, { invalidateAll: true });
	}}
/>

<style>
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		margin: 0;
	}
	.facts > * {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		min-height: 48px;
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid hsl(var(--border));
	}
	@media (min-width: 768px) {
		.facts > * {
			flex-direction: column;
			justify-content: flex-start;
			gap: 0.125rem;
			border-bottom: 0;
		}
	}
	.facts dt {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	.facts dd {
		font-weight: 600;
		text-align: right;
	}
	@media (min-width: 768px) {
		.facts dd {
			text-align: left;
		}
	}
	a:hover dt {
		text-decoration: underline;
	}
	@media (max-width: 639px) {
		.dt-row {
			grid-template-columns: 1fr;
		}
	}
	.form-row-3 {
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
	}
</style>
