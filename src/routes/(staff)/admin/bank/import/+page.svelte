<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { CircleAlert, CircleCheck, Copy, FileUp, Upload } from '@lucide/svelte';
	import { Badge, Button, PageHeader, toast } from '#lib/components/ui';
	import { LETTERS } from '#lib/features/bank/components/format';

	let { data, form } = $props();

	let text = $state('');
	let moduleId = $state(untrack(() => data.moduleId));
	let newModule = $state('');
	let busy = $state<'preview' | 'import' | null>(null);
	let showIssuesOnly = $state(false);

	const preview = $derived(form && 'preview' in form ? form.preview : null);
	const report = $derived(form && 'report' in form && form.report ? { report: form.report, moduleId: form.moduleId } : null);
	const rows = $derived(preview ? (showIssuesOnly ? preview.rows.filter((r) => r.error || r.dup) : preview.rows) : []);

	async function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		if (f.size > 5_000_000) return toast('File too large (5 MB max).', 'error');
		text = await f.text();
	}

	const sampleJson = `[
  {
    "prompt": "Who wrote the Indian national anthem?",
    "options": ["Rabindranath Tagore", "Bankim Chandra", "Sarojini Naidu", "Iqbal"],
    "correctIndex": 0,
    "explanation": "Jana Gana Mana, 1911.",
    "topic": "Culture",
    "difficulty": "easy"
  }
]`;
	const sampleCsv = `prompt,a,b,c,d,answer,explanation,topic,difficulty
"Capital of MP?",Indore,Bhopal,Gwalior,Jabalpur,B,,States,easy`;

	const submit = (kind: 'preview' | 'import') => () => {
		busy = kind;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: (o?: { reset: boolean }) => Promise<void> }) => {
			busy = null;
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not read that.'), 'error');
			else if (kind === 'import' && result.type === 'success') toast('Questions imported');
			await update({ reset: false });
		};
	};
</script>

<svelte:head><title>Import questions · Question bank</title></svelte:head>

<div class="page">
	<PageHeader
		title="Import questions"
		subtitle="Paste or upload JSON or CSV. Check the preview, then import into a module."
		crumbs={[{ href: '/admin/bank', label: 'Question bank' }]}
	/>

	{#if report}
		<div class="card card-pad stack rise">
			<div class="flex items-center gap-3">
				<CircleCheck class="size-6 text-success" />
				<div>
					<p class="font-semibold">
						<span class="font-mono tabular">{report.report.inserted}</span> questions imported
					</p>
					{#if report.report.duplicates}<p class="small muted">{report.report.duplicates} skipped as already in the bank.</p>{/if}
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if report.moduleId}<Button href="/admin/bank/{report.moduleId}">Open module</Button>{/if}
				<Button variant="secondary" href="/admin/bank/import" data-sveltekit-reload>Import more</Button>
			</div>
		</div>
	{:else}
		<div class="layout">
			<form method="POST" action="?/preview" class="card card-pad stack" use:enhance={submit('preview')}>
				<div class="field">
					<label class="label" for="imp-text">Questions</label>
					<textarea
						id="imp-text"
						name="text"
						class="textarea font-mono"
						rows="12"
						bind:value={text}
						placeholder="Paste a JSON array, or a CSV with a header row"
						spellcheck="false"
					></textarea>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<label class="btn btn-secondary">
						<Upload class="size-4" />Choose file
						<input type="file" accept=".json,.csv,application/json,text/csv" class="sr-only" onchange={pick} />
					</label>
					<span class="flex-1"></span>
					<Button type="submit" variant="ink" loading={busy === 'preview'} disabled={!text.trim()}>Check rows</Button>
				</div>
			</form>

			<aside class="card card-pad stack-sm help-card">
				<h2 class="font-semibold">Formats</h2>
				<p class="small muted">
					JSON: an array of objects with <code>prompt</code>, <code>options</code> (2 to 6), <code>correctIndex</code> (0 = first), and optional
					<code>explanation</code>, <code>topic</code>, <code>difficulty</code>.
				</p>
				<pre class="sample">{sampleJson}</pre>
				<p class="small muted">CSV: a header row, options in columns a to f, <code>answer</code> as a letter.</p>
				<pre class="sample">{sampleCsv}</pre>
				<div class="flex gap-2">
					<Button size="sm" variant="ghost" onclick={() => (text = sampleJson)}><Copy class="size-4" />Use JSON sample</Button>
				</div>
			</aside>
		</div>

		{#if preview}
			<section class="mt-6 stack">
				<div class="flex flex-wrap items-center gap-3">
					<h2 class="section-title">Preview</h2>
					<Badge>{preview.format.toUpperCase()}</Badge>
					<span class="small font-mono tabular">{preview.total} rows</span>
					{#if preview.errors}<Badge tone="danger">{preview.errors} with errors</Badge>{/if}
					{#if preview.dups}<Badge tone="warning">{preview.dups} repeated</Badge>{/if}
					<span class="flex-1"></span>
					{#if preview.errors || preview.dups}
						<label class="small inline-flex items-center gap-2"><input type="checkbox" bind:checked={showIssuesOnly} />Only rows with issues</label>
					{/if}
				</div>

				<ol class="rows">
					{#each rows as r (r.row)}
						<li class="card prow" class:is-error={!!r.error} class:is-dup={r.dup}>
							<span class="rownum font-mono tabular">{r.row}</span>
							<div class="min-w-0 flex-1">
								<p class="prompt">{r.prompt || '(no question text)'}</p>
								{#if r.error}
									<p class="small text-danger"><CircleAlert class="inline size-4" /> {r.error}</p>
								{:else}
									<p class="small muted opts">
										{#each r.options as o, i (i)}<span class:correct={i === r.correctIndex}>{LETTERS[i]}. {o}</span>{/each}
									</p>
									{#if r.dup}<p class="small text-warning">Repeats an earlier row; it will be skipped.</p>{/if}
								{/if}
							</div>
						</li>
					{/each}
				</ol>
				{#if preview.total > preview.rows.length}<p class="small muted">Showing the first {preview.rows.length} rows.</p>{/if}

				{#if preview.errors}
					<p class="alert alert-danger">Fix the rows with errors and check again. Nothing is imported while any row is invalid.</p>
				{:else}
					<form method="POST" action="?/import" class="card card-pad stack" use:enhance={submit('import')}>
						<input type="hidden" name="text" value={text} />
						<div class="form-row">
							<div class="field">
								<label class="label" for="imp-module">Into module</label>
								<select id="imp-module" name="moduleId" class="select" bind:value={moduleId} disabled={!!newModule.trim()}>
									<option value="">Unfiled (no module)</option>
									{#each data.modules as m (m.id)}<option value={m.id}>{m.name} ({m.questionCount})</option>{/each}
								</select>
							</div>
							<div class="field">
								<label class="label" for="imp-new">Or a new module <span class="opt">(optional)</span></label>
								<input id="imp-new" name="newModule" class="input" bind:value={newModule} maxlength="200" placeholder="New module name" />
							</div>
						</div>
						<p class="small muted">Questions already in the bank are skipped automatically.</p>
						<div class="flex justify-end">
							<Button type="submit" loading={busy === 'import'}><FileUp class="size-4" />Import {preview.total - preview.dups} questions</Button>
						</div>
					</form>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.layout {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
	}
	.textarea.font-mono {
		font-size: 0.8125rem;
	}
	.sample {
		font: 0.75rem/1.5 var(--font-mono);
		background: hsl(var(--muted));
		border-radius: 8px;
		padding: 0.625rem;
		overflow-x: auto;
		max-width: 100%;
		white-space: pre;
	}
	code {
		font-family: var(--font-mono);
		font-size: 0.8em;
	}
	.rows {
		display: grid;
		gap: 0.375rem;
		list-style: none;
		padding: 0;
	}
	.prow {
		display: flex;
		gap: 0.75rem;
		padding: 0.625rem 0.875rem;
	}
	.prow.is-error {
		border-color: hsl(var(--danger) / 0.5);
		background: hsl(var(--danger) / 0.04);
	}
	.prow.is-dup {
		border-color: hsl(var(--warning) / 0.5);
	}
	.rownum {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		min-width: 2rem;
		padding-top: 0.125rem;
	}
	.prompt {
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.125rem 1rem;
		overflow-wrap: anywhere;
	}
	.opts .correct {
		color: hsl(var(--success));
		font-weight: 600;
	}
</style>
