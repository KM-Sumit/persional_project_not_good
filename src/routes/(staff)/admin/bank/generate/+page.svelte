<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { FileText, Sparkles, TriangleAlert } from '@lucide/svelte';
	import { Badge, Button, PageHeader, Tabs, toast } from '#lib/components/ui';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import { fmtIST } from '#lib/features/bank/components/format';

	// Mirrors #lib/features/ai/schema (not imported: it pulls zod into the page bundle).
	const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];
	const LANGUAGES = ['English', 'Hindi', 'Bilingual'];
	const MAX_COUNT = 50;

	let { data } = $props();

	let mode = $state<'topic' | 'pdf'>('topic');
	let file = $state<{ id: string; name: string; url: string } | null>(null);
	let busy = $state(false);
	const then = page.url.searchParams.get('then') ?? '';

	const statusTone = { queued: 'draft', running: 'live', ready: 'primary', failed: 'danger', applied: 'success' } as const;
	const counts = [5, 10, 15, 20, 30, 50].filter((n) => n <= MAX_COUNT);
	const jobTitle = (j: (typeof data.jobs)[number]) =>
		String(j.input.topic ?? '') || (j.source === 'ai_pdf' ? 'PDF questions' : 'Generated questions');
</script>

<svelte:head><title>Generate with AI · Question bank</title></svelte:head>

<div class="page">
	<PageHeader
		title="Generate with AI"
		subtitle="Draft questions from a topic or a PDF. You review every question before it reaches the bank."
		crumbs={[{ href: '/admin/bank', label: 'Question bank' }]}
	/>

	{#if !data.enabled}
		<p class="alert alert-warning mb-4"><TriangleAlert class="inline size-4" /> AI is not configured on this server. Add a Gemini or OpenRouter key.</p>
	{/if}

	<div class="layout">
		<form
			method="POST"
			class="card card-pad stack"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						busy = false;
						toast(String(result.data?.message ?? 'Could not start.'), 'error');
					}
					await update({ reset: false });
				};
			}}
		>
			<input type="hidden" name="mode" value={mode} />
			<input type="hidden" name="then" value={then} />
			<Tabs
				label="Source"
				bind:value={mode}
				items={[
					{ value: 'topic', label: 'From a topic' },
					{ value: 'pdf', label: 'From a PDF' }
				]}
			/>

			{#if mode === 'topic'}
				<div class="field">
					<label class="label" for="g-topic">Topic</label>
					<input id="g-topic" name="topic" class="input" required minlength="2" maxlength="200" placeholder="e.g. Fundamental Rights, Article 12 to 35" />
				</div>
			{:else}
				<FileUpload accept="pdf" bind:value={file} name="fileId" label="PDF (up to 40 MB)" />
				<div class="form-row">
					<div class="field">
						<label class="label" for="g-from">From page <span class="opt">(optional)</span></label>
						<input id="g-from" name="pageFrom" type="number" min="1" class="input" inputmode="numeric" />
					</div>
					<div class="field">
						<label class="label" for="g-to">To page <span class="opt">(optional)</span></label>
						<input id="g-to" name="pageTo" type="number" min="1" class="input" inputmode="numeric" />
					</div>
				</div>
			{/if}

			<div class="form-row">
				<div class="field">
					<label class="label" for="g-count">Questions</label>
					<select id="g-count" name="count" class="select">
						{#each counts as n (n)}<option value={n} selected={n === 10}>{n}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label class="label" for="g-diff">Difficulty</label>
					<select id="g-diff" name="difficulty" class="select">
						{#each DIFFICULTIES as d (d)}<option value={d} selected={d === 'mixed'}>{d[0].toUpperCase() + d.slice(1)}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label class="label" for="g-lang">Language</label>
					<select id="g-lang" name="language" class="select">
						{#each LANGUAGES as l (l)}<option value={l}>{l}</option>{/each}
					</select>
				</div>
			</div>
			<div class="form-row">
				<div class="field">
					<label class="label" for="g-exam">Exam <span class="opt">(optional)</span></label>
					<select id="g-exam" name="examName" class="select">
						<option value="">Any</option>
						{#each data.taxonomy.categories as c (c.id)}
							<optgroup label={c.name}>{#each c.exams as e (e.id)}<option value={e.name}>{e.name}</option>{/each}</optgroup>
						{/each}
					</select>
				</div>
				<div class="field">
					<label class="label" for="g-subject">Subject <span class="opt">(optional)</span></label>
					<select id="g-subject" name="subject" class="select">
						<option value="">Any</option>
						{#each data.taxonomy.subjects as s (s.id)}<option value={s.name}>{s.name}</option>{/each}
					</select>
				</div>
			</div>
			<div class="field">
				<label class="label" for="g-ins">Extra instructions <span class="opt">(optional)</span></label>
				<textarea id="g-ins" name="instructions" class="textarea" rows="2" maxlength="1000" placeholder="e.g. Focus on dates and amendments"></textarea>
			</div>
			<div class="flex justify-end">
				<Button type="submit" loading={busy} disabled={!data.enabled || (mode === 'pdf' && !file)}><Sparkles class="size-4" />Generate questions</Button>
			</div>
		</form>

		<aside class="stack-sm">
			<h2 class="section-title">Recent runs</h2>
			{#if data.jobs.length}
				<ul class="list card">
					{#each data.jobs as j (j.id)}
						<li>
							<a class="list-row" href="/admin/bank/generate/{j.id}">
								<span class="leading-icon">{#if j.source === 'ai_pdf'}<FileText />{:else}<Sparkles />{/if}</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-medium">{jobTitle(j)}</span>
									<span class="tiny muted">{fmtIST(j.createdAt)} · {j.questions.length || j.requested} questions</span>
								</span>
								<Badge tone={statusTone[j.status]}>{j.status}</Badge>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="small muted">Your generation runs show up here.</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
	}
	.form-row {
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
	}
</style>
