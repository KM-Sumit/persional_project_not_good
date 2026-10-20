<script lang="ts">
	import { enhance } from '$app/forms';
	import { Download, UsersRound } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader } from '#lib/components/ui';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import FilterBar from '#lib/components/kit/FilterBar.svelte';
	import Picker from '#lib/components/kit/Picker.svelte';
	import { toasting } from './_enhance';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	let selected = $state<string[]>([]);
	let batchId = $state<string | null>(null);

	const ago = (iso: string | null) => {
		if (!iso) return 'Never';
		const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
		return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
	};
	const filters = $derived([
		{ key: 'session', label: 'Session', options: data.sessions.map((s) => ({ value: s.id, label: s.isCurrent ? `${s.name} (current)` : s.name })) },
		{ key: 'batch', label: 'Batch', options: data.batches.map((b) => ({ value: b.id, label: `${b.name} · ${b.sessionName}` })) },
		{ key: 'exam', label: 'Exam', options: data.exams },
		{ key: 'onboarded', label: 'Profile', options: [{ value: 'yes', label: 'Onboarded' }, { value: 'no', label: 'Not onboarded' }] },
		{ key: 'status', label: 'Status', options: [{ value: 'suspended', label: 'Suspended' }] }
	]);
	const batchOptions = $derived(data.batches.map((b) => ({ value: b.id, label: b.name, group: b.sessionName })));
</script>

<div class="page">
	<PageHeader title="Students" subtitle="Everyone who signed in as a student">
		{#snippet actions()}
			<a class="btn btn-secondary" href={data.exportHref} download><Download /> Export CSV</a>
		{/snippet}
	</PageHeader>

	<div class="mb-4"><FilterBar search placeholder="Search name, email or phone" {filters} /></div>

	{#snippet name(r: Row)}
		<span class="block font-semibold truncate">{r.name}</span>
		<span class="block tiny muted truncate">{r.phone ?? r.email}</span>
	{/snippet}
	{#snippet status(r: Row)}
		{#if r.suspended}<Badge tone="danger">Suspended</Badge>
		{:else if r.onboarded}<Badge tone="success">Active</Badge>
		{:else}<Badge tone="draft">New</Badge>{/if}
	{/snippet}
	{#snippet seen(r: Row)}<span class="small muted">{ago(r.lastSeenAt)}</span>{/snippet}
	{#snippet joined(r: Row)}<span class="small muted font-mono tabular">{r.createdAt.slice(0, 10)}</span>{/snippet}
	{#snippet exam(r: Row)}<span class="small">{r.examName || '–'}</span>{/snippet}
	{#snippet empty()}
		<EmptyState icon={UsersRound} title="No students match" body="Try a different search or clear the filters." />
	{/snippet}
	{#snippet bulk(ids: string[])}
		<form method="POST" action="?/addToBatch" class="bulk" use:enhance={toasting(() => (selected = []))}>
			<input type="hidden" name="ids" value={ids.join(',')} />
			<div class="bulk-pick"><Picker bind:value={batchId} name="batchId" options={batchOptions} placeholder="Choose batch" label="Batch" searchable /></div>
			<button class="btn btn-primary btn-sm" disabled={!batchId}>Add {ids.length} to batch</button>
		</form>
	{/snippet}

	<DataTable
		rows={data.rows}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/students/${r.id}`}
		selectable
		bind:selected
		nextCursor={data.nextCursor}
		{empty}
		{bulk}
		columns={[
			{ key: 'name', label: 'Student', cell: name },
			{ key: 'exam', label: 'Exam', cell: exam, hideOnPhone: true },
			{ key: 'status', label: 'Status', cell: status },
			{ key: 'lastSeenAt', label: 'Last active', cell: seen, hideOnPhone: true },
			{ key: 'createdAt', label: 'Joined', cell: joined, align: 'right', hideOnPhone: true }
		]}
	/>
</div>

<style>
	.bulk { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
	.bulk-pick { min-width: 12rem; flex: 1; }
</style>
