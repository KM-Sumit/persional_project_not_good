<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import {
		BookOpenCheck,
		CalendarClock,
		Check,
		CircleAlert,
		ClipboardCopy,
		ClipboardList,
		FileUp,
		IndianRupee,
		Layers,
		Library,
		Lock,
		LockOpen,
		PenLine,
		Plus,
		Sparkles,
		Timer,
		Trash2,
		Trophy
	} from '@lucide/svelte';
	import { Button, PageHeader, Sheet, Switch, toast } from '#lib/components/ui';
	import { DateTimePicker, FileUpload, Picker } from '#lib/components/kit';
	import type { FileDto } from '#lib/features/files/schema';
	import QuestionEditor from '#lib/features/bank/components/QuestionEditor.svelte';
	import QuestionView from '#lib/features/bank/components/QuestionView.svelte';
	import { accessLabel, fmtIST, kindLabel } from '#lib/features/bank/components/format';
	import type { QuestionDTO } from '#lib/features/bank/schema';
	import type { TestAccess, TestKind } from '#lib/features/tests/schema';

	let { data } = $props();

	const STEPS = ['Section', 'Format', 'Details', 'Questions', 'Review'] as const;
	const preset = untrack(() => data.existingSet);
	const presetCategory = untrack(() =>
		preset?.examId ? (data.taxonomy.categories.find((c) => c.exams.some((e) => e.id === preset?.examId))?.id ?? null) : null
	);
	let step = $state(preset ? 2 : 0);
	let categoryId = $state<string | null>(presetCategory);
	let mode = $state<'single' | 'set'>(preset ? 'set' : 'single');
	let setName = $state(preset?.name ?? '');
	let setAccess = $state<TestAccess>('open');
	let setPrice = $state<number | null>(null);
	let setPassword = $state('');

	// ---------- step 1 + 2: the test ----------
	const currentSessionId = () => data.sessions.find((s) => s.isCurrent)?.id ?? null;
	let f = $state({
		kind: 'practice' as TestKind,
		access: 'open' as TestAccess,
		title: '',
		description: '',
		instructions: '',
		examId: (preset?.examId ?? null) as string | null,
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
		if (mode !== 'set' && k === 'live' && f.access === 'open') f.access = 'password';
		if (k === 'pyq' && f.marksPerQuestion === 1) (f.marksPerQuestion = 2), (f.negativeMarks = 0.5);
	}

	const category = $derived(data.taxonomy.categories.find((c) => c.id === categoryId) ?? null);
	const chosenExam = $derived(data.taxonomy.categories.flatMap((c) => c.exams).find((e) => e.id === f.examId) ?? null);
	function pickCategory(id: string) {
		categoryId = id;
		const cat = data.taxonomy.categories.find((c) => c.id === id);
		if (!cat?.exams.some((e) => e.id === f.examId)) f.examId = null;
	}
	const subjectOptions = $derived(data.taxonomy.subjects.map((s) => ({ value: s.id, label: s.name })));
	const sessionOptions = $derived(data.sessions.map((s) => ({ value: s.id, label: s.name, hint: s.isCurrent ? 'Current' : undefined })));
	const batchOptions = $derived(
		data.batches.filter((b) => !f.sessionId || b.sessionId === f.sessionId).map((b) => ({ value: b.id, label: b.name, hint: `${b.memberCount} students` }))
	);
	const nowIso = new Date().toISOString();

	// ---------- step 3: questions ----------
	let source = $state<'manual' | 'json' | 'pdf' | 'bank'>('manual');
	let pdfFile = $state<FileDto | null>(null);
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

	type Paper = {
		key: string;
		f: typeof f;
		source: typeof source;
		blueprint: Row[];
		picked: QuestionDTO[];
		drafts: typeof drafts;
		importText: string;
	};
	let papers = $state<Paper[]>([]);
	let active = $state(0);
	function livePaper(key = papers[active]?.key ?? 'live'): Paper {
		return { key, f: $state.snapshot(f), source, blueprint: $state.snapshot(blueprint), picked: $state.snapshot(picked), drafts: $state.snapshot(drafts), importText };
	}
	function countOf(p: Paper) {
		const t = p.importText.trim();
		let rows = 0;
		if (t) {
			if (/^[[{]/.test(t)) {
				try {
					const v = JSON.parse(t);
					rows = (Array.isArray(v) ? v : (v?.questions ?? [])).length;
				} catch {
					rows = -1;
				}
			} else rows = Math.max(0, t.split(/\r?\n/).filter((l) => l.trim()).length - 1);
		}
		const fromBank = p.blueprint.reduce((s, r) => {
			const m = r.moduleId ? moduleById.get(r.moduleId) : undefined;
			const avail = m ? (r.difficulty ? m.counts[r.difficulty] : m.questionCount) : 0;
			return s + Math.min(r.count, avail);
		}, 0);
		return { questions: fromBank + p.picked.length + p.drafts.length + Math.max(0, rows), badImport: rows < 0 };
	}
	const allPapers = $derived.by(() => {
		const live = livePaper();
		if (mode !== 'set') return [live];
		if (!papers.length) return [live];
		return papers.map((p, i) => (i === active ? live : p));
	});
	function applyPaper(p: Paper) {
		f = $state.snapshot(p.f);
		source = p.source;
		blueprint = $state.snapshot(p.blueprint);
		picked = $state.snapshot(p.picked);
		drafts = $state.snapshot(p.drafts);
		importText = p.importText;
	}
	function stash() {
		if (mode !== 'set') return;
		const snap = livePaper(papers[active]?.key ?? crypto.randomUUID());
		if (!papers[active]) papers = [snap];
		else papers[active] = snap;
	}
	function pickMode(nextMode: 'single' | 'set') {
		mode = nextMode;
		if (nextMode === 'set') {
			if (!setName.trim()) setName = `${chosenExam?.name ?? 'Exam'} set`;
			if (!papers.length) papers = [livePaper(crypto.randomUUID())];
		}
	}
	function openPaper(i: number) {
		if (i === active) return;
		stash();
		active = i;
		applyPaper(papers[i]!);
	}
	function addPaper() {
		stash();
		const base = $state.snapshot(f);
		const p: Paper = {
			key: crypto.randomUUID(),
			f: { ...base, title: '', description: '', instructions: '', password: '' },
			source: 'manual',
			blueprint: [],
			picked: [],
			drafts: [],
			importText: ''
		};
		papers.push(p);
		active = papers.length - 1;
		applyPaper(p);
	}

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
	async function readJsonFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 5_000_000) return toast('That JSON file is over 5 MB.', 'error');
		importText = await file.text();
	}
	$effect(() => {
		if (source !== 'bank') return;
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
		if (!f.examId) out.push({ step: 0, text: 'Choose a section and an exam.', blocksDraft: true });
		if (mode === 'set' && !setName.trim()) out.push({ step: 1, text: 'Give the set a name.', blocksDraft: true });
		if (mode === 'set' && setAccess === 'paid' && !(Number(setPrice) > 0)) out.push({ step: 1, text: 'Enter one price for this set.', blocksDraft: true });
		if (mode === 'set' && setAccess === 'password' && setPassword && setPassword.length < 4)
			out.push({ step: 1, text: 'The set password needs at least 4 characters.', blocksDraft: true });
		allPapers.forEach((p, i) => {
			const who = mode === 'set' ? `Test ${i + 1}${p.f.title.trim() ? ` (${p.f.title.trim()})` : ''}` : 'This test';
			if (!p.f.title.trim()) out.push({ step: 2, text: mode === 'set' ? `Test ${i + 1} needs a title.` : 'Give the test a title.', blocksDraft: true });
			if (p.f.kind === 'live' && !p.f.startsAt) out.push({ step: 2, text: `${who} needs a start time.`, blocksDraft: true });
			if (p.f.kind === 'live' && p.f.startsAt && new Date(p.f.startsAt) <= new Date()) out.push({ step: 2, text: `${who}: the start time is in the past.` });
			if (p.f.startsAt && p.f.endsAt && p.f.endsAt <= p.f.startsAt) out.push({ step: 2, text: `${who}: the end time must be after the start time.`, blocksDraft: true });
			if (mode !== 'set' && p.f.access === 'password' && p.f.password && p.f.password.length < 4)
				out.push({ step: 2, text: `${who}: the password needs at least 4 characters.`, blocksDraft: true });
			if (mode !== 'set' && p.f.access === 'paid' && !p.f.priceInr) out.push({ step: 2, text: `${who}: set a price for a paid test.` });
			if (p.f.kind === 'pyq' && !p.f.year) out.push({ step: 2, text: `${who}: add the PYQ year.` });
			if (!p.f.durationMin || p.f.durationMin < 1) out.push({ step: 2, text: `${who}: set a duration.`, blocksDraft: true });
			const n = countOf(p);
			if (!n.questions) out.push({ step: 3, text: `${who} needs at least one question.` });
			if (n.badImport) out.push({ step: 3, text: `${who}: the pasted import is not valid JSON.`, blocksDraft: true });
			for (const r of p.blueprint)
				if (r.count > (r.moduleId ? (moduleById.get(r.moduleId) ? (r.difficulty ? moduleById.get(r.moduleId)!.counts[r.difficulty] : moduleById.get(r.moduleId)!.questionCount) : 0) : 0))
					out.push({ step: 3, text: `${who}: a module does not have enough matching questions.` });
		});
		return out;
	});
	const canDraft = $derived(!issues.some((i) => i.blocksDraft));
	const canPublish = $derived(issues.length === 0);

	const plan = $derived(
		JSON.stringify({
			mode,
			setName: setName.trim(),
			setId: data.existingSet?.id ?? null,
			setAccess: mode === 'set' ? setAccess : 'open',
			setPrice: mode === 'set' && setAccess === 'paid' ? Number(setPrice) || null : null,
			setPassword: mode === 'set' && setAccess === 'password' ? setPassword.trim() || null : null,
			publish: false,
			tests: allPapers.map((p) => ({
				fields: {
					...p.f,
					access: mode === 'set' ? 'open' : p.f.access,
					password: mode === 'set' ? null : p.f.access === 'password' ? p.f.password || null : null,
					priceInr: mode === 'set' ? null : p.f.access === 'paid' ? p.f.priceInr : null,
					year: p.f.kind === 'pyq' ? p.f.year : null,
					shift: p.f.kind === 'pyq' ? p.f.shift : null,
					sourceInfo: p.f.kind === 'pyq' ? p.f.sourceInfo : '',
					verifiedPyq: p.f.kind === 'pyq' && p.f.verifiedPyq
				},
				blueprint: p.blueprint.filter((r) => r.moduleId).map((r) => ({ moduleId: r.moduleId, count: r.count, difficulty: r.difficulty || undefined })),
				questionIds: p.picked.map((q) => q.id),
				newQuestions: p.drafts,
				importText: p.importText
			}))
		})
	);

	let busy = $state<'draft' | 'publish' | null>(null);
	let created = $state<{ id: string; setId: string | null; password: string | null; passwords: { title: string; password: string }[]; published: boolean; warnings: string[] } | null>(null);
	let pwOpen = $state(false);

	async function copy(text: string) {
		await navigator.clipboard.writeText(text).catch(() => {});
		toast('Copied');
	}
	const next = () => {
		if (step === 1 && mode === 'set' && (!setName.trim() || (setAccess === 'paid' && !(Number(setPrice) > 0)))) return;
		if (step === 1 && mode === 'set') {
			if (!papers.length) papers = [livePaper(crypto.randomUUID())];
			else stash();
		}
		step = Math.min(4, step + 1);
	};
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
			<h2 class="section-title">Which section?</h2>
			<p class="small muted">SSC, Railway, MPPSC, MP Police — the sections you added under Exams & subjects.</p>
			{#if data.taxonomy.categories.length}
				<div class="choices" role="radiogroup" aria-label="Section">
					{#each data.taxonomy.categories as c (c.id)}
						<button type="button" role="radio" aria-checked={categoryId === c.id} class="choice card" onclick={() => pickCategory(c.id)}>
							<span class="font-semibold">{c.name}</span>
							<span class="small muted">{c.exams.length} {c.exams.length === 1 ? 'exam' : 'exams'}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="card card-pad">No sections yet. <a class="underline" href="/admin/taxonomy">Add SSC, Railway and the others</a> first.</p>
			{/if}
			{#if category}
				<h2 class="section-title mt-4">Which exam in {category.name}?</h2>
				{#if category.exams.length}
					<div class="choices" role="radiogroup" aria-label="Exam">
						{#each category.exams as e (e.id)}
							<button type="button" role="radio" aria-checked={f.examId === e.id} class="choice card" onclick={() => (f.examId = e.id)}>
								<span class="font-semibold">{e.name}</span>
								{#if e.description}<span class="small muted">{e.description}</span>{/if}
							</button>
						{/each}
					</div>
				{:else}
					<p class="card card-pad">No exams in {category.name} yet. <a class="underline" href="/admin/taxonomy">Add exams</a> such as CHSL or CGL.</p>
				{/if}
			{/if}
		</section>
	{:else if step === 1}
		<section class="stack rise">
			<p class="small">For <strong>{category?.name}</strong> · <strong>{chosenExam?.name}</strong>. <button type="button" class="underline" onclick={() => (step = 0)}>Change</button></p>
			<h2 class="section-title">Single test or a set of tests?</h2>
			<div class="choices" role="radiogroup" aria-label="How many tests">
				<button type="button" role="radio" aria-checked={mode === 'single'} class="choice card" onclick={() => pickMode('single')}>
					<ClipboardList class="size-5" />
					<span class="font-semibold">Single test</span>
					<span class="small muted">One test, then its details and questions.</span>
				</button>
				<button type="button" role="radio" aria-checked={mode === 'set'} class="choice card" onclick={() => pickMode('set')}>
					<Layers class="size-5" />
					<span class="font-semibold">Set of tests</span>
					<span class="small muted">A named set. Opening it shows every test inside.</span>
				</button>
			</div>
			{#if mode === 'set'}
				<div class="field">
					<label class="label" for="set-name">Set name</label>
					<input id="set-name" class="input" maxlength="120" bind:value={setName} placeholder={chosenExam ? `${chosenExam.name} set` : 'Set name'} />
					<p class="help">You can change this name now, and again after the set is saved.</p>
				</div>
				<h2 class="section-title">Who can open this set?</h2>
				<p class="small muted">This applies once to the folder. Tests inside are not paid separately.</p>
				<div class="choices choices-3" role="radiogroup" aria-label="Set access">
					{#each accesses as a (a.value)}
						<button type="button" role="radio" aria-checked={setAccess === a.value} class="choice card" onclick={() => (setAccess = a.value)}>
							<a.icon class="size-5" />
							<span class="font-semibold">{a.title === 'Open' ? 'Free' : a.title}</span>
							<span class="small muted">{a.value === 'open' ? 'Anyone signed in can start every test.' : a.value === 'password' ? 'One password opens the whole set.' : 'One payment opens every test in the set.'}</span>
						</button>
					{/each}
				</div>
				{#if setAccess === 'password'}
					<div class="field">
						<label class="label" for="set-pw">Set password <span class="opt">(leave empty to generate one)</span></label>
						<input id="set-pw" class="input font-mono" maxlength="64" autocomplete="off" bind:value={setPassword} />
					</div>
				{:else if setAccess === 'paid'}
					<div class="field">
						<label class="label" for="set-price">Price (₹)</label>
						<input id="set-price" type="number" min="1" class="input" inputmode="numeric" bind:value={setPrice} />
						<p class="help">Students pay this once. Every test in the set unlocks together.</p>
					</div>
				{/if}
			{/if}
		</section>
	{:else if step === 2}
		{@render setBar()}
		<section class="stack rise">
			<p class="small">For <strong>{category?.name}</strong> · <strong>{chosenExam?.name}</strong>. <button type="button" class="underline" onclick={() => (step = 0)}>Change</button></p>
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
			{#if mode !== 'set'}
				<h2 class="section-title mt-2">Who can take it?</h2>
				<div class="choices choices-3" role="radiogroup" aria-label="Access">
					{#each accesses as a (a.value)}
						<button type="button" role="radio" aria-checked={f.access === a.value} class="choice card" onclick={() => (f.access = a.value)}>
							<a.icon class="size-5" />
							<span class="font-semibold">{a.title}</span>
							<span class="small muted">{a.body}</span>
						</button>
					{/each}
				</div>
			{/if}
		</section>
		<section class="card card-pad stack rise">
			<div class="field">
				<label class="label" for="w-title">Title</label>
				<input id="w-title" class="input" bind:value={f.title} maxlength="200" placeholder={f.kind === 'pyq' ? 'e.g. SSC CHSL 2024 Tier 1' : 'e.g. Polity mock 3'} />
			</div>
			<div class="field">
				<span class="label">Subject <span class="opt">(optional)</span></span>
				<Picker bind:value={f.subjectId} options={subjectOptions} placeholder="Choose subject" label="Subject" searchable />
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

			{#if mode !== 'set' && f.access === 'password'}
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
	{:else if step === 3}
		{@render setBar()}
		<section class="stack rise">
			<p class="small muted">How should the questions for {chosenExam?.name ?? 'this exam'} be added?</p>
			<div class="choices choices-3" role="radiogroup" aria-label="How to add questions">
				<button type="button" role="radio" aria-checked={source === 'manual'} class="choice card" onclick={() => (source = 'manual')}>
					<PenLine class="size-5" />
					<span class="font-semibold">Manual</span>
					<span class="small muted">Write each question yourself.</span>
				</button>
				<button type="button" role="radio" aria-checked={source === 'json'} class="choice card" onclick={() => (source = 'json')}>
					<FileUp class="size-5" />
					<span class="font-semibold">JSON file</span>
					<span class="small muted">Upload a .json file of questions.</span>
				</button>
				<button type="button" role="radio" aria-checked={source === 'pdf'} class="choice card" onclick={() => (source = 'pdf')}>
					<Sparkles class="size-5" />
					<span class="font-semibold">PDF upload</span>
					<span class="small muted">Upload a PDF and generate questions.</span>
				</button>
			</div>
			<p class="small font-mono tabular">{total} questions planned</p>

			{#if source === 'manual'}
				<div class="card card-pad stack">
					<p class="small muted">New questions are saved to the bank and added to this test.</p>
					{#each drafts as d, i (i)}
						<div class="draft">
							<QuestionView prompt={d.prompt} options={d.options} correctIndex={d.correctIndex} number={i + 1} compact />
							<button type="button" class="icon-btn" aria-label="Remove question" onclick={() => drafts.splice(i, 1)}><Trash2 /></button>
						</div>
					{/each}
					<Button variant="secondary" onclick={() => (writing = true)}><PenLine class="size-4" />Write a question</Button>
				</div>
			{:else if source === 'json'}
				<div class="card card-pad stack">
					<label class="btn btn-secondary">
						<FileUp class="size-4" />Choose JSON file
						<input type="file" accept=".json,application/json" class="sr-only" onchange={readJsonFile} />
					</label>
					<div class="field">
						<label class="label" for="w-imp">Or paste JSON</label>
						<textarea id="w-imp" class="textarea font-mono" rows="8" spellcheck="false" bind:value={importText} placeholder={'[{ "prompt": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 }]'}></textarea>
						{#if importRows > 0}<p class="help">{importRows} questions ready.</p>{:else if importRows < 0}<p class="error">Not valid JSON.</p>{/if}
					</div>
				</div>
			{:else if source === 'pdf'}
				<form method="POST" action="/admin/bank/generate" class="card card-pad stack">
					<input type="hidden" name="mode" value="pdf" />
					<input type="hidden" name="then" value="test" />
					<input type="hidden" name="examName" value={chosenExam?.name ?? ''} />
					<input type="hidden" name="examId" value={f.examId ?? ''} />
					<input type="hidden" name="count" value="10" />
					<input type="hidden" name="difficulty" value="mixed" />
					<input type="hidden" name="language" value={f.language} />
					<FileUpload accept="pdf" bind:value={pdfFile} name="fileId" label="PDF (up to 40 MB)" />
					<Button type="submit" disabled={!pdfFile}><Sparkles class="size-4" />Generate questions from PDF</Button>
					<p class="small muted">You review the questions, then a draft test is created for {chosenExam?.name ?? 'this exam'}.</p>
				</form>
			{:else if source === 'bank'}
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
			{/if}
			<details class="more">
				<summary>Use questions already in the bank</summary>
				<div class="mt-3"><Button variant="secondary" type="button" onclick={() => (source = 'bank')}>Open the question bank picker</Button></div>
			</details>
		</section>
	{:else}
		<section class="stack rise">
			{#if mode === 'set'}
				<div class="field">
					<label class="label" for="set-name-review">Set name</label>
					<input id="set-name-review" class="input" maxlength="120" bind:value={setName} />
				</div>
				<ul class="stack-sm">
					{#each allPapers as p, i (p.key)}
						<li class="card card-pad flex items-center justify-between gap-3">
							<span class="font-semibold">{p.f.title || `Test ${i + 1}`}</span>
							<span class="small font-mono tabular">{countOf(p).questions} questions</span>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="card card-pad review">
				<div>
					<p class="eyebrow">{mode === 'set' ? `${setName || 'Test set'} · ${setAccess === 'open' ? 'Free' : setAccess === 'paid' ? `Paid ₹${setPrice || '—'}` : 'Password'}` : `${kindLabel[f.kind]} · ${accessLabel[f.access]}`}</p>
					<h2 class="section-title">{mode === 'set' ? `${allPapers.length} tests` : f.title || 'Untitled test'}</h2>
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
						{#each issues as it, i (i)}
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
			else goto(created!.setId ? `/admin/tests/sets/${created!.setId}` : `/admin/tests/${created!.id}`);
		};
	}}
>
	<div class="actionbar-inner">
		{#if step > 0}<Button variant="ghost" class="btn-fixed" type="button" onclick={() => (step -= 1)}>Back</Button>{/if}
		{#if step < 4}
			<Button type="button" onclick={next} disabled={(step === 0 && !f.examId) || (step === 1 && mode === 'set' && (!setName.trim() || (setAccess === 'paid' && !(Number(setPrice) > 0))))}>Next: {STEPS[step + 1]}</Button>
		{:else}
			<Button variant="secondary" type="submit" name="intent" value="draft" loading={busy === 'draft'} disabled={!canDraft || !!busy}>Save draft</Button>
			<Button type="submit" name="intent" value="publish" loading={busy === 'publish'} disabled={!canPublish || !!busy}>Publish test</Button>
		{/if}
	</div>
</form>

<QuestionEditor bind:open={writing} action="" title="Write a question" submitLabel="Add to test" onlocal={(d) => drafts.push(d)} />

<Sheet bind:open={pwOpen} title={mode === 'set' ? 'Set password' : 'Test password'} description="Copy it now. It is shown only once. One password opens every test in the set.">
	{#if created?.password}
		<div class="stack">
			<p class="pw font-mono">{created.password}</p>
			<div class="flex flex-wrap gap-2">
				<Button variant="secondary" onclick={() => copy(created!.password!)}><ClipboardCopy class="size-4" />Copy password</Button>
				<a class="btn btn-secondary" href="https://wa.me/?text={encodeURIComponent(`${f.title}: password ${created.password}`)}" target="_blank" rel="noopener">Send on WhatsApp</a>
				<span class="flex-1"></span>
				<Button onclick={() => goto(created!.setId ? `/admin/tests/sets/${created!.setId}` : `/admin/tests/${created!.id}`)}>{created!.setId ? 'Open set' : 'Open test'}</Button>
			</div>
		</div>
	{/if}
</Sheet>

{#snippet setBar()}
	{#if mode === 'set'}
		<div class="set-bar card card-pad stack">
			<p class="small">Set: <strong>{setName}</strong>. Add each test, then open one to edit its details and questions.</p>
			<div class="set-tests">
				{#each allPapers as p, i (p.key)}
					<button type="button" class="chip" aria-current={i === active} onclick={() => openPaper(i)}>{p.f.title.trim() || `Test ${i + 1}`}</button>
				{/each}
				<button type="button" class="btn btn-secondary btn-sm" onclick={addPaper}><Plus class="size-4" />Add test</button>
			</div>
		</div>
	{/if}
{/snippet}

<style>
	.wizard {
		padding-bottom: 6rem;
	}
	.stepper {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
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
			grid-template-columns: auto auto auto auto auto;
			justify-content: start;
		}
	}
	.set-tests { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
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
