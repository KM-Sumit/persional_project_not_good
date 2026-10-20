<script lang="ts">
	import { enhance } from '$app/forms';
	import { MessageCircle, MessagesSquare, Phone } from '@lucide/svelte';
	import { EmptyState, PageHeader, Tabs } from '#lib/components/ui';
	import DataTable from '#lib/components/kit/DataTable.svelte';
	import { toasting } from '../students/_enhance';

	let { data } = $props();
	type Lead = (typeof data.leads)[number];

	const LABEL = { new: 'New', contacted: 'Called', enrolled: 'Enrolled', closed: 'Closed' } as const;
	const tabs = $derived([
		{ value: '', label: 'All', href: '/admin/leads' },
		...(['new', 'contacted', 'enrolled', 'closed'] as const).map((s) => ({ value: s, label: LABEL[s], href: `/admin/leads?status=${s}`, count: data.counts[s] }))
	]);

	const age = (iso: string) => {
		const h = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
		return h < 1 ? 'Just now' : h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
	};
	const late = (l: Lead) => l.status === 'new' && Date.now() - Date.parse(l.createdAt) > 86_400_000;
	const wa = (l: Lead) =>
		`https://wa.me/${l.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${l.name}, this is UCI (Upendra Competition Institute) about your enquiry${l.examInterest ? ` for ${l.examInterest}` : ''}.`)}`;
	const submit = (e: Event) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit();
</script>

<div class="page">
	<PageHeader title="Enquiries" subtitle="From the website contact form. Call back within a day." />

	<div class="mb-4"><Tabs items={tabs} value={data.status ?? ''} label="Enquiry status" /></div>

	{#snippet who(l: Lead)}
		<span class="block font-semibold truncate">{l.name}</span>
		<span class="block tiny muted font-mono tabular">{l.phone}</span>
	{/snippet}
	{#snippet interest(l: Lead)}
		<span class="block small truncate">{l.examInterest || '–'}</span>
		{#if l.message}<span class="block tiny muted line-clamp-2">{l.message}</span>{/if}
	{/snippet}
	{#snippet when(l: Lead)}<span class="small {late(l) ? 'late' : 'muted'}">{age(l.createdAt)}</span>{/snippet}
	{#snippet contact(l: Lead)}
		<span class="contact">
			<a class="icon-btn" href="tel:{l.phone}" aria-label="Call {l.name}"><Phone /></a>
			<a class="icon-btn" href={wa(l)} target="_blank" rel="noopener" aria-label="WhatsApp {l.name}"><MessageCircle /></a>
		</span>
	{/snippet}
	{#snippet status(l: Lead)}
		<form method="POST" action="?/status" use:enhance={toasting()}>
			<input type="hidden" name="id" value={l.id} />
			<select class="input status" name="status" value={l.status} onchange={submit} aria-label="Status for {l.name}">
				{#each Object.entries(LABEL) as [v, label] (v)}<option value={v}>{label}</option>{/each}
			</select>
		</form>
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={MessagesSquare} title={data.status ? `No ${LABEL[data.status].toLowerCase()} enquiries` : 'No enquiries yet'} body="New enquiries from the website contact form land here." />
	{/snippet}

	<DataTable
		rows={data.leads}
		getId={(l) => l.id}
		nextCursor={data.next}
		{empty}
		columns={[
			{ key: 'name', label: 'Name', cell: who },
			{ key: 'examInterest', label: 'Interested in', cell: interest, hideOnPhone: true },
			{ key: 'createdAt', label: 'Received', cell: when },
			{ key: 'contact', label: 'Contact', cell: contact },
			{ key: 'status', label: 'Status', cell: status, align: 'right' }
		]}
	/>
</div>

<style>
	.late { color: hsl(var(--warning)); font-weight: 600; }
	.contact { display: inline-flex; gap: .25rem; }
	.status { width: auto; min-height: 40px; padding-block: 0; }
</style>
