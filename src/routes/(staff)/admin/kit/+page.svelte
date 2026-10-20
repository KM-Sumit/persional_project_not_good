<script lang="ts">
	// Kit demo: every shared component in every state, for screenshot checks and as usage reference.
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { toast } from '#lib/components/ui';
	import {
		BarChart,
		CommandPalette,
		ConfirmSheet,
		Countdown,
		DataTable,
		DateTimePicker,
		FileUpload,
		FilterBar,
		Kpi,
		Markdown,
		MarkdownEditor,
		Picker,
		YouTubePlayer,
		type Column
	} from '#lib/components/kit';

	type Student = { id: string; name: string; phone: string; batch: string; tests: number; status: string };
	const students: Student[] = [
		{ id: 's1', name: 'Aarti Verma', phone: '98260 11223', batch: 'SSC CGL Morning', tests: 14, status: 'Active' },
		{ id: 's2', name: 'Rohit Kumar Yadav', phone: '99070 55331', batch: 'MP Police Evening', tests: 9, status: 'Active' },
		{ id: 's3', name: 'Neha Sharma', phone: '91310 77889', batch: 'Railway NTPC', tests: 21, status: 'Suspended' },
		{ id: 's4', name: 'Imran Khan', phone: '70000 12345', batch: 'MPPSC Prelims', tests: 3, status: 'Active' }
	];

	let selected = $state<string[]>([]);
	let course = $state<string | null>(null);
	let exam = $state<string | null>('ssc-cgl');
	let startAt = $state<string | null>(null);
	let endAt = $state<string | null>('2026-10-21T04:30:00.000Z');
	let image = $state<{ id: string; name: string; url: string } | null>(null);
	let pdf = $state<{ id: string; name: string; url: string } | null>({ id: 'demo', name: 'SSC CGL 2024 Tier 1 paper.pdf', url: '#' });
	let md = $state('## Percentages\n\nIf price rises by **20%**, consumption must fall by $\\frac{20}{120} \\times 100 = 16.67\\%$.\n\n- Write the base first\n- Then the change');
	let confirmOpen = $state(false);
	let typedOpen = $state(false);
	let paletteOpen = $state(false);

	const now = new Date().toISOString();
	const in45 = new Date(Date.now() + 45 * 60_000).toISOString();
	const in3 = new Date(Date.now() + 3 * 60_000).toISOString();
	const min = new Date().toISOString();

	const courses = [
		{ value: 'c1', label: 'SSC CGL Complete Course', hint: '42 lessons', group: 'SSC' },
		{ value: 'c2', label: 'SSC CHSL Crash Course', hint: '18 lessons', group: 'SSC' },
		{ value: 'c3', label: 'RRB NTPC Maths', hint: '30 lessons', group: 'Railway' },
		{ value: 'c4', label: 'RRB Group D Reasoning', hint: '22 lessons', group: 'Railway' },
		{ value: 'c5', label: 'MPPSC Prelims GS', hint: '64 lessons', group: 'MPPSC' },
		{ value: 'c6', label: 'MP Police Constable', hint: '36 lessons', group: 'MP Police' },
		{ value: 'c7', label: 'MP Police GK Capsule', hint: '12 lessons', group: 'MP Police' },
		{ value: 'c8', label: 'Current Affairs Monthly', hint: '10 lessons', group: 'General' },
		{ value: 'c9', label: 'English Grammar Basics', hint: '25 lessons', group: 'General' }
	];
	const exams = [
		{ value: 'ssc-cgl', label: 'SSC CGL' },
		{ value: 'ssc-chsl', label: 'SSC CHSL' },
		{ value: 'rrb-ntpc', label: 'RRB NTPC' }
	];
	const weekly = [
		{ label: 'Mon', value: 120 },
		{ label: 'Tue', value: 164 },
		{ label: 'Wed', value: 98 },
		{ label: 'Thu', value: 210 },
		{ label: 'Fri', value: 187 },
		{ label: 'Sat', value: 242 },
		{ label: 'Sun', value: 75 }
	];
	const sampleHtml =
		'<h2 id="ratio">Ratio and proportion</h2><p>Two numbers are in the ratio <strong>3 : 5</strong>. If 9 is added to each, the ratio becomes 3 : 4.</p><ul><li>Let the numbers be 3x and 5x</li><li>Solve (3x + 9) / (5x + 9) = 3 / 4</li></ul><blockquote><p>Answer: x = 9, so the numbers are 27 and 45.</p></blockquote><div class="table-wrap"><table><thead><tr><th>Exam</th><th>Questions</th></tr></thead><tbody><tr><td>SSC CGL</td><td>4</td></tr><tr><td>RRB NTPC</td><td>3</td></tr></tbody></table></div>';
	const nav = [
		{ label: 'Dashboard', href: '/admin', group: 'Go to' },
		{ label: 'Tests', href: '/admin/tests', group: 'Go to' },
		{ label: 'Question bank', href: '/admin/bank', group: 'Go to' },
		{ label: 'Students', href: '/admin/students', group: 'People' },
		{ label: 'Batches', href: '/admin/batches', group: 'People' },
		{ label: 'Kit', href: '/admin/kit', group: 'Developer' }
	];
	const columns: Column<Student>[] = $derived([
		{ key: 'name', label: 'Name', sortable: true },
		{ key: 'phone', label: 'Phone', hideOnPhone: true },
		{ key: 'batch', label: 'Batch', sortable: true },
		{ key: 'status', label: 'Status', cell: status },
		{ key: 'tests', label: 'Tests', align: 'right', sortable: true }
	]);
</script>

{#snippet status(r: Student)}
	<span class="badge {r.status === 'Active' ? 'badge-success' : 'badge-danger'}">{r.status}</span>
{/snippet}

<div class="page stack-lg">
	<PageHeader title="Component kit" subtitle="Every shared staff component, in every state." crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<button type="button" class="btn btn-secondary" onclick={() => (paletteOpen = true)}>Open palette <kbd class="kit-hint">⌘K</kbd></button>
		{/snippet}
	</PageHeader>

	<section class="stack">
		<h2 class="section-title">FilterBar + DataTable</h2>
		<FilterBar
			placeholder="Search students"
			filters={[
				{ key: 'batch', label: 'Batch', options: [{ value: 'cgl', label: 'SSC CGL Morning', count: 42 }, { value: 'police', label: 'MP Police Evening', count: 31 }] },
				{ key: 'status', label: 'Status', options: [{ value: 'active', label: 'Active', count: 70 }, { value: 'suspended', label: 'Suspended', count: 3 }] }
			]}
		/>
		<DataTable rows={students} {columns} rowHref={(r) => `/admin/students/${r.id}`} selectable bind:selected nextCursor="demo-cursor">
			{#snippet bulk(ids)}
				<button type="button" class="btn btn-sm btn-secondary" onclick={() => toast(`${ids.length} moved to a batch`)}>Move to batch</button>
				<button type="button" class="btn btn-sm btn-danger" onclick={() => (typedOpen = true)}>Suspend</button>
			{/snippet}
		</DataTable>
		<p class="eyebrow">Loading</p>
		<DataTable rows={[]} {columns} loading />
		<p class="eyebrow">Empty</p>
		<DataTable rows={[]} {columns}>
			{#snippet empty()}
				<div class="empty empty-compact card">
					<p class="empty-title">No students match</p>
					<p>Try another search or clear the filters.</p>
				</div>
			{/snippet}
		</DataTable>
	</section>

	<section class="stack">
		<h2 class="section-title">Kpi + BarChart</h2>
		<div class="stats stats-4">
			<Kpi label="Students" value={1284} delta={6.2} spark={[40, 42, 41, 47, 52, 55, 61]} hint="this month" href="/admin/students" />
			<Kpi label="Tests taken" value={392} delta={-3.4} spark={[60, 58, 64, 51, 49, 47, 45]} />
			<Kpi label="Average score" value="61.4%" delta={0} hint="flat" />
			<Kpi label="Revenue" value="₹1,24,500" />
		</div>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="card card-pad"><h3 class="mb-3 font-semibold">Attempts this week</h3><BarChart data={weekly} /></div>
			<div class="card card-pad"><h3 class="mb-3 font-semibold">Empty chart</h3><BarChart data={weekly.map((d) => ({ ...d, value: 0 }))} height={160} /></div>
		</div>
	</section>

	<section class="stack">
		<h2 class="section-title">Pickers</h2>
		<div class="grid gap-4 md:grid-cols-3">
			<div class="field"><span class="label">Course (grouped, searchable)</span><Picker label="Course" bind:value={course} options={courses} placeholder="Choose a course" name="courseId" /></div>
			<div class="field"><span class="label">Exam (short list)</span><Picker label="Exam" bind:value={exam} options={exams} name="exam" /></div>
			<div class="field"><span class="label">Disabled</span><Picker label="Disabled" value={null} options={exams} disabled /></div>
		</div>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="field"><span class="label">Starts (not set, min now)</span><DateTimePicker label="Starts" bind:value={startAt} {min} name="startsAt" /></div>
			<div class="field"><span class="label">Ends</span><DateTimePicker label="Ends" bind:value={endAt} name="endsAt" /></div>
		</div>
	</section>

	<section class="stack">
		<h2 class="section-title">FileUpload</h2>
		<div class="grid gap-4 md:grid-cols-2">
			<FileUpload accept="image" bind:value={image} name="imageId" label="Banner image" />
			<FileUpload accept="pdf" bind:value={pdf} name="pdfId" label="Question paper" />
		</div>
	</section>

	<section class="stack">
		<h2 class="section-title">MarkdownEditor + Markdown</h2>
		<MarkdownEditor bind:value={md} name="body" rows={8} />
		<div class="card card-pad"><Markdown html={sampleHtml} /></div>
	</section>

	<section class="stack">
		<h2 class="section-title">YouTubePlayer</h2>
		<div class="max-w-2xl"><YouTubePlayer videoId="M7lc1UVf-VE" /></div>
	</section>

	<section class="stack">
		<h2 class="section-title">Countdown</h2>
		<div class="flex flex-wrap gap-6 text-2xl">
			<Countdown to={in45} serverNow={now} />
			<Countdown to={in3} serverNow={now} />
			<Countdown to={now} serverNow={now} />
		</div>
	</section>

	<section class="stack">
		<h2 class="section-title">ConfirmSheet</h2>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn btn-secondary" onclick={() => (confirmOpen = true)}>Publish test</button>
			<button type="button" class="btn btn-danger" onclick={() => (typedOpen = true)}>Delete test</button>
		</div>
	</section>
</div>

<ConfirmSheet
	bind:open={confirmOpen}
	title="Publish this test?"
	body="Students in the selected batches will see it at the start time."
	confirmLabel="Publish test"
	onconfirm={() => toast('Test published')}
/>
<ConfirmSheet
	bind:open={typedOpen}
	title="Delete this test?"
	body="All attempts and results for it are removed. This cannot be undone."
	confirmLabel="Delete test"
	danger
	typed="DELETE"
	onconfirm={async () => {
		await new Promise((r) => setTimeout(r, 600));
		toast('Test deleted');
	}}
/>
<CommandPalette items={nav} bind:open={paletteOpen} />
