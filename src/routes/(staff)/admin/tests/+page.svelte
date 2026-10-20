<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Archive, ClipboardList, EyeOff, Lock, Plus, Send, IndianRupee } from '@lucide/svelte';
	import { Badge, Button, EmptyState, PageHeader, Select, Tabs, toast } from '#lib/components/ui';
	import { DataTable, FilterBar, type Column } from '#lib/components/kit';
	import { accessLabel, fmtIST, kindLabel, statusTone } from '#lib/features/bank/components/format';
	import type { TestDTO } from '#lib/features/tests/schema';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	let selected = $state<string[]>([]);

	const examName = $derived(new Map(data.taxonomy.categories.flatMap((c) => c.exams.map((e) => [e.id, e.name]))));
	const c = $derived(data.list.counts);

	function href(changes: Record<string, string | null>) {
		const u = new URL(page.url.href);
		u.searchParams.delete('cursor');
		for (const [k, v] of Object.entries(changes)) v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
		return u.pathname + u.search;
	}
	const tabs = $derived([
		{ value: 'all', label: 'All', count: c.all, href: href({ tab: null }) },
		{ value: 'live', label: 'Live & upcoming', count: data.liveCount, href: href({ tab: 'live' }) },
		{ value: 'published', label: 'Published', count: c.published, href: href({ tab: 'published' }) },
		{ value: 'draft', label: 'Drafts', count: c.draft, href: href({ tab: 'draft' }) },
		{ value: 'archived', label: 'Archived', count: c.archived, href: href({ tab: 'archived' }) }
	]);
	const filters = $derived([
		{ key: 'kind', label: 'Type', options: Object.entries(kindLabel).map(([value, label]) => ({ value, label })) },
		{ key: 'access', label: 'Access', options: Object.entries(accessLabel).map(([value, label]) => ({ value, label })) },
		{ key: 'exam', label: 'Exam', options: data.taxonomy.categories.flatMap((cat) => cat.exams.map((e) => ({ value: e.id, label: e.name }))) }
	]);
	const sessionOptions = $derived([
		...data.sessions.map((s) => ({ value: s.id, label: s.name, hint: s.isCurrent ? 'Current' : undefined })),
		{ value: 'all', label: 'All sessions' }
	]);

	const columns: Column<TestDTO>[] = [
		{ key: 'title', label: 'Test', cell: titleCell },
		{ key: 'status', label: 'Status', cell: statusCell, align: 'right' },
		{ key: 'exam', label: 'Exam', cell: examCell, hideOnPhone: true },
		{ key: 'window', label: 'Window', cell: windowCell, hideOnPhone: true },
		{ key: 'questionCount', label: 'Questions', align: 'right', hideOnPhone: true, cell: qCell },
		{ key: 'attemptCount', label: 'Attempts', align: 'right', hideOnPhone: true, cell: aCell }
	];

	const done: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Failed.'), 'warning', 6000);
		else if (result.type === 'success') toast(String(result.data?.message ?? 'Done'));
		selected = [];
		await update();
	};
</script>

{#snippet titleCell(t: TestDTO)}
	<span class="flex min-w-0 flex-col">
		<a class="font-medium hover:underline" href="/admin/tests/{t.id}">{t.title}</a>
		<span class="tiny muted inline-flex flex-wrap items-center gap-1 tabular">
			{kindLabel[t.kind]}
			{#if t.access === 'password'}· <Lock class="size-3" />Password{:else if t.access === 'paid'}· <IndianRupee class="size-3" />{t.priceInr ?? 'Paid'}{/if}
			{#if t.kind === 'pyq' && t.year}· {t.year}{/if}
			<span class="phone-meta">
				{#if t.examId && examName.get(t.examId)}· {examName.get(t.examId)}{/if}
				· {t.startsAt ? fmtIST(t.startsAt) : `${t.durationMin} min`} · {t.questionCount} Q
			</span>
		</span>
	</span>
{/snippet}
{#snippet statusCell(t: TestDTO)}
	{#if t.status === 'published' && t.kind === 'live' && t.window === 'live'}
		<Badge tone="live">Live</Badge>
	{:else if t.status === 'published' && t.window === 'ended'}
		<Badge tone="closed">Ended</Badge>
	{:else}
		<Badge tone={statusTone[t.status]}>{t.status === 'published' ? 'Published' : t.status[0].toUpperCase() + t.status.slice(1)}</Badge>
	{/if}
{/snippet}
{#snippet examCell(t: TestDTO)}{(t.examId && examName.get(t.examId)) || '—'}{/snippet}
{#snippet windowCell(t: TestDTO)}
	{#if t.startsAt}<span class="tabular small">{fmtIST(t.startsAt)}</span>{:else}<span class="muted small">Anytime · {t.durationMin} min</span>{/if}
{/snippet}
{#snippet qCell(t: TestDTO)}<span class="tabular">{t.questionCount}</span>{/snippet}
{#snippet aCell(t: TestDTO)}<span class="tabular">{t.attemptCount}</span>{/snippet}

{#snippet bulkBar(ids: string[])}
	{#each [{ a: 'publish', label: 'Publish', icon: Send }, { a: 'unpublish', label: 'Unpublish', icon: EyeOff }, { a: 'archive', label: 'Archive', icon: Archive }] as b (b.a)}
		<form method="POST" action="?/{b.a}" use:enhance={done}>
			<input type="hidden" name="ids" value={ids.join(',')} />
			<Button size="sm" variant={b.a === 'publish' ? 'primary' : 'secondary'} type="submit"><b.icon class="size-4" />{b.label}</Button>
		</form>
	{/each}
{/snippet}

<svelte:head><title>Tests · UCI staff</title></svelte:head>

<div class="page">
	<PageHeader title="Tests" subtitle="Practice, mock, PYQ and live tests for every batch.">
		{#snippet actions()}
			<div class="head-row">
			<div class="session">
				<Select
					label="Session"
					value={data.sessionId}
					options={sessionOptions}
					onchange={(v) => goto(href({ session: v }))}
				/>
			</div>
			<Button href="/admin/tests/new"><Plus class="size-4" />New test</Button>
			</div>
		{/snippet}
	</PageHeader>

	<div class="stack">
		<Tabs label="Status" value={data.tab} items={tabs} />
		<FilterBar placeholder="Search by title" {filters} />
		<DataTable
			rows={data.list.items}
			{columns}
			rowHref={(t) => `/admin/tests/${t.id}`}
			selectable
			bind:selected
			nextCursor={data.list.nextCursor}
			bulk={bulkBar}
		>
			{#snippet empty()}
				<EmptyState icon={ClipboardList} title="No tests here" body="Change the filters, pick another session, or create a test.">
					{#snippet action()}<Button href="/admin/tests/new"><Plus class="size-4" />New test</Button>{/snippet}
				</EmptyState>
			{/snippet}
		</DataTable>
	</div>
</div>

<style>
	.phone-meta {
		display: contents;
	}
	@media (min-width: 768px) {
		.phone-meta {
			display: none;
		}
	}
	.head-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}
	.session {
		flex: 1 1 9rem;
		min-width: 0;
	}
</style>
