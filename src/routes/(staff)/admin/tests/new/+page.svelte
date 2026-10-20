<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		BookOpenCheck,
		CalendarClock,
		Check,
		CircleAlert,
		ClipboardCopy,
		FileUp,
		IndianRupee,
		Library,
		ListChecks,
		Lock,
		LockOpen,
		PenLine,
		Plus,
		Search,
		Sparkles,
		Timer,
		Trash2,
		Trophy
	} from '@lucide/svelte';
	import { Button, PageHeader, Sheet, Switch, Tabs, toast } from '#lib/components/ui';
	import { DateTimePicker, Picker } from '#lib/components/kit';
	import QuestionEditor from '#lib/features/bank/components/QuestionEditor.svelte';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import { accessLabel, fmtIST, kindLabel } from '#lib/features/bank/components/format';
	import type { QuestionDTO } from '#lib/features/bank/schema';
	import type { TestAccess, TestKind } from '#lib/features/tests/schema';

	let { data } = $props();

	const STEPS = ['Type', 'Details', 'Questions', 'Review'] as const;
	let step = $state(0);

	// ---------- step 1 + 2: the test ----------
	const currentSessionId = () => data.sessions.find((s) => s.isCurrent)?.id ?? null;
	let f = $state({
		kind: 'practice' as TestKind,
		access: 'open' as TestAccess,
		title: '',
		description: '',
		instructions: '',
		examId: null as string | null,
		subjectId: null as string | null,
		sessionId: currentSessionId() as string | null,
		batchId: null as string | null,
		difficulty: 'medium',
		durationMin: 60,
		marksPerQuestion: 1,
		negativeMarks: 0,
		priceInr: null as number | null,
		startsAt: null as string | null,
		endsAt: null as string | null,
		maxAttempts: null as number | null,
		shuffleQuestions: false,
		showSolutions: true,
		year: null as number | null,
		shift: '',
		language: 'English',
		sourceInfo: '',
		verifiedPyq: false,
		password: ''
	});

	const kinds: { value: TestKind; title: string; body: string; icon: typeof Timer }[] = [
		{ value: 'practice', title: 'Practice', body: 'Open any time, retakes allowed. Good for chapter drills.', icon: BookOpenCheck },
		{ value: 'mock', title: 'Mock', body: 'Full-length paper in exam conditions, ranked.', icon: Trophy },
		{ value: 'pyq', title: 'PYQ paper', body: 'A previous year paper with year, shift and source.', icon: Library },
		{ value: 'live', title: 'Live scheduled', body: 'Starts at a set IST time; one attempt each.', icon: CalendarClock }
	];
	const accesses: { value: TestAccess; title: string; body: string; icon: typeof Lock }[] = [
		{ value: 'open', title: 'Open', body: 'Every signed-in student can start it.', icon: LockOpen },
		{ value: 'password', title: 'Password', body: 'Students enter a password you share in class.', icon: Lock },
		{ value: 'paid', title: 'Paid', body: 'Only students you grant, or who buy it.', icon: IndianRupee }
	];

	function pickKind(k: TestKind) {
		f.kind = k;
		if (k === 'live' && f.access === 'open') f.access = 'password';
		if (k === 'pyq' && f.marksPerQuestion === 1) (f.marksPerQuestion = 2), (f.negativeMarks = 0.5);
	}

	const examOptions = $derived(data.taxonomy.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name }))));
	const subjectOptions = $derived(data.taxonomy.subjects.map((s) => ({ value: s.id, label: s.name })));
	const sessionOptions = $derived(data.sessions.map((s) => ({ value: s.id, label: s.name, hint: s.isCurrent ? 'Current' : undefined })));
	const batchOptions = $derived(
		data.batches.filter((b) => !f.sessionId || b.sessionId === f.sessionId).map((b) => ({ value: b.id, label: b.name, hint: `${b.memberCount} students` }))
	);
	const nowIso = new Date().toISOString();

	// ---------- step 3: questions ----------
	let source = $state('modules');
	type Row = { moduleId: string | null; count: number; difficulty: '' | 'easy' | 'medium' | 'hard' };
	let blueprint = $state<Row[]>([]);
	let picked = $state<QuestionDTO[]>([]);
	let drafts = $state<{ prompt: string; options: string[]; correctIndex: number; explanation: string; topic: string; difficulty: string }[]>([]);
	let importText = $state('');
	let writing = $state(false);

	const moduleById = $derived(new Map(data.modules.map((m) => [m.id, m])));
	const available = (r: Row) => {
		const m = r.moduleId ? moduleById.get(r.moduleId) : undefined;
		return m ? (r.difficulty ? m.counts[r.difficulty] : m.questionCount) : 0;
	};
	function addRow() {
		const used = new Set(blueprint.map((r) => r.moduleId));
		const m = data.modules.find((x) => !used.has(x.id) && x.questionCount) ?? data.modules[0];
		if (m) blueprint.push({ moduleId: m.id, count: Math.min(10, m.questionCount || 10), difficulty: '' });
	}
	const importRows = $derived.by(() => {
		const t = importText.trim();
		if (!t) return 0;
		if (/^[[{]/.test(t)) {
			try {
				const v = JSON.parse(t);
				return (Array.isArray(v) ? v : (v?.questions ?? [])).length;
			} catch {
				return -1;
			}
		}
		return Math.max(0, t.split(/\r?\n/).filter((l) => l.trim()).length - 1);
	});
	const fromModules = $derived(blueprint.reduce((s, r) => s + Math.min(r.count, available(r)), 0));
	const total = $derived(fromModules + picked.length + drafts.length + Math.max(0, importRows));

	// Bank search for "pick questions".
	let q = $state('');
	let qModule = $state<string | null>(null);
	let results = $state<QuestionDTO[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	async function search() {
		searching = true;
		const u = new URLSearchParams();
		if (q.trim()) u.set('q', q.trim());
		if (qModule) u.set('moduleId', qModule);
		const res = await fetch(`/admin/bank/search?${u}`);
		results = res.ok ? (await res.json()).items : [];
		searching = false;
	}
	$effect(() => {
		if (source !== 'pick') return;
		void q, qModule;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(search, 250);
	});
	const isPicked = (id: string) => picked.some((p) => p.id === id);
	const togglePick = (x: QuestionDTO) => (isPicked(x.id) ? (picked = picked.filter((p) => p.id !== x.id)) : picked.push(x));

	// ---------- step 4: review ----------
	type Issue = { step: number; text: string; blocksDraft?: boolean };
	const issues = $derived.by(() => {
		const out: Issue[] = [];
		if (!f.title.trim()) out.push({ step: 1, text: 'Give the test a title.', blocksDraft: true });
		if (f.kind === 'live' && !f.startsAt) out.push({ step: 1, text: 'A live test needs a start time.', blocksDraft: true });
		if (f.kind === 'live' && f.startsAt && new Date(f.startsAt) <= new Date()) out.push({ step: 1, text: 'The start time is in the past.' });
		if (f.startsAt && f.endsAt && f.endsAt <= f.startsAt) out.push({ step: 1, text: 'The end time must be after the start time.', blocksDraft: true });
		if (f.access === 'password' && f.password && f.password.length < 4) out.push({ step: 1, text: 'The password needs at least 4 characters.', blocksDraft: true });
		if (f.access === 'paid' && !f.priceInr) out.push({ step: 1, text: 'Set a price for a paid test.' });
		if (f.kind === 'pyq' && !f.year) out.push({ step: 1, text: 'Add the PYQ year.' });
		if (!f.durationMin || f.durationMin < 1) out.push({ step: 1, text: 'Set a duration.', blocksDraft: true });
		if (!total) out.push({ step: 2, text: 'Add at least one question.' });
		if (importRows < 0) out.push({ step: 2, text: 'The pasted import is not valid JSON.', blocksDraft: true });
		for (const r of blueprint)
			if (r.count > available(r)) out.push({ step: 2, text: `${(r.moduleId ? moduleById.get(r.moduleId) : undefined)?.name || 'A module'} has only ${available(r)} matching questions.` });
		return out;
	});
	const canDraft = $derived(!issues.some((i) => i.blocksDraft));
	const canPublish = $derived(issues.length === 0);

	const plan = $derived(
		JSON.stringify({
			fields: {
				...f,
				password: f.access === 'password' ? f.password || null : null,
				priceInr: f.access === 'paid' ? f.priceInr : null,
				startsAt: f.startsAt,
				endsAt: f.endsAt,
				year: f.kind === 'pyq' ? f.year : null,
				shift: f.kind === 'pyq' ? f.shift : null,
				sourceInfo: f.kind === 'pyq' ? f.sourceInfo : '',
				verifiedPyq: f.kind === 'pyq' && f.verifiedPyq
			},
			blueprint: blueprint.filter((r) => r.moduleId).map((r) => ({ moduleId: r.moduleId, count: r.count, difficulty: r.difficulty || undefined })),
			questionIds: picked.map((p) => p.id),
			newQuestions: drafts,
			importText,
			publish: false
		})
	);

	let busy = $state<'draft' | 'publish' | null>(null);
	let created = $state<{ id: string; password: string | null; published: boolean; warnings: string[] } | null>(null);
	let pwOpen = $state(false);

	async function copy(text: string) {
		await navigator.clipboard.writeText(text).catch(() => {});
		toast('Copied');
	}
	const next = () => (step = Math.min(3, step + 1));
</script>

<svelte:head><title>New test · UCI staff</title></svelte:head>

<div class="page wizard">
	<PageHeader title="New test" crumbs={[{ href: '/admin/tests', label: 'Tests' }]} />

	<ol class="stepper" aria-label="Steps">
		{#each STEPS as s, i (s)}
			<li>
				<button type="button" class="step" class:is-done={i < step} aria-current={i === step ? 'step' : undefined} onclick={() => (step = i)}>
					<span class="step-dot font-mono">{#if i < step}<Check class="size-3.5" />{:else}{i + 1}{/if}</span>
					<span class="step-label">{s}</span>
				</button>
			</li>
		{/each}
	</ol>

	{#if step === 0}
		<section class="stack rise">
			<h2 class="section-title">What kind of test?</h2>
			<div class="choices" role="radiogroup" aria-label="Test type">
				{#each kinds as k (k.value)}
					<button type="button" role="radio" aria-checked={f.kind === k.value} class="choice card" onclick={() => pickKind(k.value)}>
						<k.icon class="size-5" />
						<span class="font-semibold">{k.title}</span>
						<span class="small muted">{k.body}</span>
					</button>
				{/each}
			</div>
			<h2 class="section-title mt-4">Who can take it?</h2>
			<div class="choices choices-3" role="radiogroup" aria-label="Access">
				{#each accesses as a (a.value)}
					<button type="button" role="radio" aria-checked={f.access === a.value} class="choice card" onclick={() => (f.access = a.value)}>
						<a.icon class="size-5" />
						<span class="font-semibold">{a.title}</span>
						<span class="small muted">{a.body}</span>
					</button>
				{/each}
			</div>
		</section>
	{:else if step === 1}
		<section class="card card-pad stack rise">
			<div class="field">
				<label class="label" for="w-title">Title</label>
				<input id="w-title" class="input" bind:value={f.title} maxlength="200" placeholder={f.kind === 'pyq' ? 'e.g. SSC CGL 2024 Tier 1, Shift 2' : 'e.g. Polity mock 3'} />
			</div>
			<div class="form-row">
				<div class="field">
					<span class="label">Exam <span class="opt">(optional)</span></span>
					<Picker bind:value={f.examId} options={examOptions} placeholder="Choose exam" label="Exam" searchable />
				</div>
				<div class="field">
					<span class="label">Subject <span class="opt">(optional)</span></span>
					<Picker bind:value={f.subjectId} options={subjectOptions} placeholder="Choose subject" label="Subject" searchable />
				</div>
			</div>
			<div class="form-row">
				<div class="field">
					<span class="label">Session</span>
					<Picker bind:value={f.sessionId} options={sessionOptions} placeholder="No session" label="Session" />
				</div>
				<div class="field">
					<span class="label">Batch <span class="opt">(optional)</span></span>
					<Picker bind:value={f.batchId} options={batchOptions} placeholder="All batches" label="Batch" searchable />
				</div>
			</div>
			<div class="form-row form-row-3">
				<div class="field">
					<label class="label" for="w-dur">Duration (min)</label>
					<input id="w-dur" type="number" min="1" max="600" class="input" inputmode="numeric" bind:value={f.durationMin} />
				</div>
				<div class="field">
					<label class="label" for="w-marks">Marks per question</label>
					<input id="w-marks" type="number" min="0.25" step="0.25" class="input" inputmode="decimal" bind:value={f.marksPerQuestion} />
				</div>
				<div class="field">
					<label class="label" for="w-neg">Negative marks</label>
					<input id="w-neg" type="number" min="0" step="0.25" class="input" inputmode="decimal" bind:value={f.negativeMarks} />
				</div>
			</div>
			<div class="chips" aria-label="Quick durations">
				{#each [30, 45, 60, 90, 120, 180] as d (d)}
					<button type="button" class="chip" aria-current={f.durationMin === d} onclick={() => (f.durationMin = d)}>{d} min</button>
				{/each}
			</div>

			{#if f.kind === 'live'}
				<div class="form-row dt-row">
					<div class="field"><span class="label">Starts (IST)</span><DateTimePicker bind:value={f.startsAt} label="Starts (IST)" min={nowIso} /></div>
					<div class="field"><span class="label">Closes (IST, optional)</span><DateTimePicker bind:value={f.endsAt} label="Closes (IST)" min={f.startsAt ?? nowIso} /></div>
				</div>
				<p class="help">If you leave the close time empty, it closes {f.durationMin} minutes after the start. Late joiners get only the time left.</p>
			{:else}
				<details class="more">
					<summary>Availability window <span class="opt">(optional)</span></summary>
					<div class="form-row dt-row mt-3">
						<div class="field"><span class="label">Opens (IST)</span><DateTimePicker bind:value={f.startsAt} label="Opens (IST)" /></div>
						<div class="field"><span class="label">Closes (IST)</span><DateTimePicker bind:value={f.endsAt} label="Closes (IST)" min={f.startsAt ?? undefined} /></div>
					</div>
				</details>
			{/if}

			{#if f.kind === 'pyq'}
				<div class="form-row form-row-3">
					<div class="field">
						<label class="label" for="w-year">Year</label>
						<input id="w-year" type="number" min="1950" max="2100" class="input" inputmode="numeric" bind:value={f.year} />
					</div>
					<div class="field">
						<label class="label" for="w-shift">Shift <span class="opt">(optional)</span></label>
						<input id="w-shift" class="input" maxlength="50" bind:value={f.shift} placeholder="Shift 1" />
					</div>
					<div class="field">
						<label class="label" for="w-lang">Language</label>
						<select id="w-lang" class="select" bind:value={f.language}>
							<option>English</option><option>Hindi</option><option>Bilingual</option>
						</select>
					</div>
				</div>
				<div class="field">
					<label class="label" for="w-src">Source <span class="opt">(optional)</span></label>
					<input id="w-src" class="input" maxlength="500" bind:value={f.sourceInfo} placeholder="e.g. SSC official answer key" />
				</div>
				<Switch bind:checked={f.verifiedPyq} label="Verified authentic paper" description="Shows a Verified badge to students." />
			{/if}

			{#if f.access === 'password'}
				<div class="field">
					<label class="label" for="w-pw">Password <span class="opt">(leave empty to generate one)</span></label>
					<input id="w-pw" class="input font-mono" maxlength="64" autocomplete="off" bind:value={f.password} />
					<p class="help">You see it once after creating the test. You can set a new one any time.</p>
				</div>
			{:else if f.access === 'paid'}
				<div class="field">
					<label class="label" for="w-price">Price (₹)</label>
					<input id="w-price" type="number" min="0" class="input" inputmode="numeric" bind:value={f.priceInr} />
				</div>
			{/if}

			<details class="more">
				<summary>Rules and text</summary>
				<div class="stack mt-3">
					<div class="form-row">
						<div class="field">
							<label class="label" for="w-max">Attempts per student</label>
							<input
								id="w-max"
								type="number"
								min="1"
								max="100"
								class="input"
								inputmode="numeric"
								placeholder={f.kind === 'live' ? '1' : 'Unlimited'}
								disabled={f.kind === 'live'}
								bind:value={f.maxAttempts}
							/>
						</div>
						<div class="field">
							<label class="label" for="w-diff">Difficulty</label>
							<select id="w-diff" class="select" bind:value={f.difficulty}>
								<option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
							</select>
						</div>
					</div>
					<Switch bind:checked={f.shuffleQuestions} label="Shuffle question order" description="Each student sees a different order." />
					<Switch bind:checked={f.showSolutions} label="Show solutions after submit" description="Correct answers and explanations on the result page." />
					<div class="field">
						<label class="label" for="w-desc">Description <span class="opt">(optional)</span></label>
						<textarea id="w-desc" class="textarea" rows="2" maxlength="2000" bind:value={f.description}></textarea>
					</div>
					<div class="field">
						<label class="label" for="w-ins">Instructions for students <span class="opt">(optional)</span></label>
						<textarea id="w-ins" class="textarea" rows="3" maxlength="10000" bind:value={f.instructions}></textarea>
					</div>
				</div>
			</details>
		</section>
	{:else if step === 2}
		<section class="stack rise">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<Tabs
					label="Question source"
					bind:value={source}
					items={[
						{ value: 'modules', label: 'From modules', count: fromModules || undefined },
						{ value: 'pick', label: 'Pick', count: picked.length || undefined },
						{ value: 'write', label: 'Write', count: drafts.length || undefined },
						{ value: 'import', label: 'Import', count: importRows > 0 ? importRows : undefined },
						{ value: 'ai', label: 'AI' }
					]}
				/>
				<span class="small font-mono tabular">{total} questions planned</span>
			</div>

			{#if source === 'modules'}
				<div class="card card-pad stack">
					<p class="small muted">Pick modules and how many questions to draw from each. Questions are chosen at random, never twice.</p>
					{#each blueprint as r, i (i)}
						<div class="bp-row">
							<div class="bp-mod">
								<Picker
									bind:value={r.moduleId}
									options={data.modules.map((m) => ({ value: m.id, label: m.name, hint: `${m.questionCount}` }))}
									label="Module"
									searchable
								/>
							</div>
							<select class="select bp-diff" aria-label="Difficulty" bind:value={r.difficulty}>
								<option value="">Any difficulty</option>
								<option value="easy">Easy ({(r.moduleId ? moduleById.get(r.moduleId) : undefined)?.counts.easy ?? 0})</option>
								<option value="medium">Medium ({(r.moduleId ? moduleById.get(r.moduleId) : undefined)?.counts.medium ?? 0})</option>
								<option value="hard">Hard ({(r.moduleId ? moduleById.get(r.moduleId) : undefined)?.counts.hard ?? 0})</option>
							</select>
							<input type="number" min="1" max="500" class="input bp-count" aria-label="How many" inputmode="numeric" bind:value={r.count} />
							<span class="small font-mono tabular bp-avail" class:text-danger={r.count > available(r)}>of {available(r)}</span>
							<button type="button" class="icon-btn" aria-label="Remove row" onclick={() => blueprint.splice(i, 1)}><Trash2 /></button>
						</div>
					{/each}
					{#if data.modules.length}
						<Button variant="secondary" onclick={addRow}><Plus class="size-4" />Add module</Button>
					{:else}
						<p class="small">No modules yet. <a class="underline" href="/admin/bank">Create one in the question bank</a>.</p>
					{/if}
				</div>
			{:else if source === 'pick'}
				<div class="card card-pad stack">
					<div class="flex flex-wrap gap-2">
						<label class="search flex-1">
							<Search class="size-4" aria-hidden="true" />
							<input class="input" bind:value={q} placeholder="Search question text" aria-label="Search question text" />
						</label>
						<div class="min-w-48">
							<Picker bind:value={qModule} options={data.modules.map((m) => ({ value: m.id, label: m.name }))} placeholder="All modules" label="Module" searchable />
						</div>
					</div>
					<ul class="pick-list" aria-busy={searching}>
						{#each results as x (x.id)}
							<li>
								<label class="pick-row" class:is-on={isPicked(x.id)}>
									<input type="checkbox" checked={isPicked(x.id)} onchange={() => togglePick(x)} />
									<QuestionView prompt={x.prompt} options={x.options} correctIndex={x.correctIndex} compact />
								</label>
							</li>
						{:else}
							<li class="small muted">{searching ? 'Searching…' : 'No questions found.'}</li>
						{/each}
					</ul>
					{#if picked.length}<p class="small"><span class="font-mono tabular">{picked.length}</span> picked.</p>{/if}
				</div>
			{:else if source === 'write'}
				<div class="card card-pad stack">
					<p class="small muted">New questions are saved to the bank (unfiled) and added to this test.</p>
					{#each drafts as d, i (i)}
						<div class="draft">
							<QuestionView prompt={d.prompt} options={d.options} correctIndex={d.correctIndex} number={i + 1} compact />
							<button type="button" class="icon-btn" aria-label="Remove question" onclick={() => drafts.splice(i, 1)}><Trash2 /></button>
						</div>
					{/each}
					<Button variant="secondary" onclick={() => (writing = true)}><PenLine class="size-4" />Write a question</Button>
				</div>
			{:else if source === 'import'}
				<div class="card card-pad stack">
					<div class="field">
						<label class="label" for="w-imp">Paste JSON or CSV</label>
						<textarea id="w-imp" class="textarea font-mono" rows="8" spellcheck="false" bind:value={importText} placeholder={'[{ "prompt": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 }]'}></textarea>
						{#if importRows > 0}<p class="help">{importRows} rows. Questions already in the bank are skipped.</p>{:else if importRows < 0}<p class="error">Not valid JSON.</p>{/if}
					</div>
					<p class="small muted">Want to check rows first? Use <a class="underline" href="/admin/bank/import">Import questions</a>, then pick the module here.</p>
				</div>
			{:else}
				<div class="card card-pad stack">
					<p>Generate questions from a topic or a PDF, review them, and create the test in one go.</p>
					<div><Button href="/admin/bank/generate?then=test"><Sparkles class="size-4" />Generate with AI</Button></div>
					<p class="small muted">This leaves the wizard. The AI review screen makes a draft test you can finish from its page.</p>
				</div>
			{/if}
		</section>
	{:else}
		<section class="stack rise">
			<div class="card card-pad review">
				<div>
					<p class="eyebrow">{kindLabel[f.kind]} · {accessLabel[f.access]}</p>
					<h2 class="section-title">{f.title || 'Untitled test'}</h2>
				</div>
				<dl class="facts">
					<div><dt>Questions</dt><dd class="font-mono tabular">{total}</dd></div>
					<div><dt>Duration</dt><dd class="font-mono tabular">{f.durationMin} min</dd></div>
					<div><dt>Marking</dt><dd class="font-mono tabular">+{f.marksPerQuestion} / −{f.negativeMarks}</dd></div>
					<div><dt>Window</dt><dd>{f.startsAt ? fmtIST(f.startsAt) : 'Any time'}</dd></div>
				</dl>
			</div>
			{#if issues.length}
				<div class="card card-pad stack-sm" role="alert">
					<h3 class="font-semibold">Fix before publishing</h3>
					<ul class="stack-sm">
						{#each issues as it (it.text)}
							<li class="issue">
								<CircleAlert class="size-4 text-danger" />
								<span class="flex-1 small">{it.text}</span>
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => (step = it.step)}>Fix</button>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="alert alert-success flex items-center gap-2"><Check class="size-4" />Ready to publish.</p>
			{/if}
		</section>
	{/if}
</div>

<form
	method="POST"
	action="?/create"
	class="actionbar inline-desktop"
	use:enhance={({ submitter, formData }) => {
		const publish = submitter?.getAttribute('value') === 'publish';
		busy = publish ? 'publish' : 'draft';
		formData.set('plan', JSON.stringify({ ...JSON.parse(plan), publish }));
		return async ({ result }) => {
			busy = null;
			if (result.type === 'failure') return toast(String(result.data?.message ?? 'Could not create the test.'), 'error');
			if (result.type !== 'success' || !result.data) return;
			created = result.data as typeof created;
			for (const w of created!.warnings) toast(w, 'warning', 7000);
			toast(created!.published ? 'Test published' : 'Draft saved');
			if (created!.password) pwOpen = true;
			else goto(`/admin/tests/${created!.id}`);
		};
	}}
>
	<div class="actionbar-inner">
		{#if step > 0}<Button variant="ghost" class="btn-fixed" type="button" onclick={() => (step -= 1)}>Back</Button>{/if}
		{#if step < 3}
			<Button type="button" onclick={next}>Next: {STEPS[step + 1]}</Button>
		{:else}
			<Button variant="secondary" type="submit" name="intent" value="draft" loading={busy === 'draft'} disabled={!canDraft || !!busy}>Save draft</Button>
			<Button type="submit" name="intent" value="publish" loading={busy === 'publish'} disabled={!canPublish || !!busy}>Publish test</Button>
		{/if}
	</div>
</form>

<QuestionEditor bind:open={writing} action="" title="Write a question" submitLabel="Add to test" onlocal={(d) => drafts.push(d)} />

<Sheet bind:open={pwOpen} title="Test password" description="Copy it now. It is shown only once; you can set a new one from the test's Access page.">
	{#if created?.password}
		<div class="stack">
			<p class="pw font-mono">{created.password}</p>
			<div class="flex flex-wrap gap-2">
				<Button variant="secondary" onclick={() => copy(created!.password!)}><ClipboardCopy class="size-4" />Copy password</Button>
				<a class="btn btn-secondary" href="https://wa.me/?text={encodeURIComponent(`${f.title}: password ${created.password}`)}" target="_blank" rel="noopener">Send on WhatsApp</a>
				<span class="flex-1"></span>
				<Button onclick={() => goto(`/admin/tests/${created!.id}`)}>Open test</Button>
			</div>
		</div>
	{/if}
</Sheet>

<style>
	.wizard {
		padding-bottom: 6rem;
	}
	.stepper {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0 0 1.25rem;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 44px;
		padding: 0.25rem;
		border-radius: 10px;
		color: hsl(var(--muted-foreground));
	}
	.step[aria-current='step'] {
		color: hsl(var(--foreground));
		font-weight: 600;
	}
	.step-dot {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--foreground) / 0.35);
		font-size: 0.75rem;
	}
	.step[aria-current='step'] .step-dot {
		background: hsl(var(--primary));
		border-color: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
	.step.is-done .step-dot {
		background: hsl(var(--foreground));
		border-color: hsl(var(--foreground));
		color: hsl(var(--background));
	}
	@media (max-width: 639px) {
		.step-label {
			display: none;
		}
		.step[aria-current='step'] .step-label {
			display: inline;
		}
		.stepper {
			grid-template-columns: auto auto auto auto;
			justify-content: start;
		}
	}
	.choices {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
	}
	.choice {
		display: grid;
		gap: 0.375rem;
		justify-items: start;
		text-align: left;
		padding: 1rem;
		border-width: 1.5px;
	}
	.choice[aria-checked='true'] {
		border-color: hsl(var(--primary));
		background: hsl(var(--accent));
	}
	.choice :global(svg) {
		color: hsl(var(--primary));
	}
	@media (max-width: 639px) {
		.choices {
			gap: 0.5rem;
		}
		.choice {
			grid-template-columns: auto 1fr;
			column-gap: 0.75rem;
			row-gap: 0.125rem;
			padding: 0.75rem 1rem;
		}
		.choice :global(svg) {
			grid-row: span 2;
			align-self: center;
		}
		.dt-row {
			grid-template-columns: 1fr;
		}
	}
	.form-row-3 {
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
	}
	.more summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.bp-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
	}
	.bp-mod {
		grid-column: 1 / -1;
	}
	.bp-row {
		grid-template-columns: minmax(0, 1fr) 5rem auto auto;
	}
	@media (min-width: 768px) {
		.bp-row {
			grid-template-columns: minmax(0, 1fr) 11rem 5.5rem 4rem auto;
			border-bottom: 0;
			padding-bottom: 0;
		}
		.bp-mod {
			grid-column: auto;
		}
	}
	.search {
		position: relative;
		min-width: 12rem;
	}
	.search :global(svg) {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		translate: 0 -50%;
		color: hsl(var(--muted-foreground));
	}
	.search .input {
		padding-left: 2.25rem;
	}
	.pick-list {
		display: grid;
		gap: 0.375rem;
		list-style: none;
		padding: 0;
		max-height: 60vh;
		overflow-y: auto;
	}
	.pick-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 12px;
		cursor: pointer;
	}
	.pick-row.is-on {
		border-color: hsl(var(--primary) / 0.5);
		background: hsl(var(--accent));
	}
	.pick-row input {
		margin-top: 0.25rem;
		accent-color: hsl(var(--primary));
		width: 1.125rem;
		height: 1.125rem;
		flex-shrink: 0;
	}
	.draft {
		display: flex;
		gap: 0.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
	}
	.draft > :global(:first-child) {
		flex: 1;
	}
	.review {
		display: grid;
		gap: 1rem;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.75rem;
	}
	.facts dt {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.facts dd {
		font-weight: 600;
	}
	.issue {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.pw {
		font-size: 2rem;
		letter-spacing: 0.15em;
		text-align: center;
		padding: 1rem;
		border: 1.5px dashed hsl(var(--border));
		border-radius: 12px;
		overflow-wrap: anywhere;
	}
</style>
