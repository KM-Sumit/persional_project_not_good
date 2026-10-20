<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { TicketPercent, TicketPlus, Trash2 } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Sheet, Switch, toast } from '#lib/components/ui';
	import { ConfirmSheet, DataTable, Picker } from '#lib/components/kit';
	import { couponOffText, fmtDate, type CouponDTO } from '#lib/features/billing/format';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	type Row = CouponDTO;

	type Draft = { id: string; code: string; type: 'percent' | 'amount'; value: string; productId: string | null; maxUses: string; validUntil: string; active: boolean };
	const blank = (): Draft => ({ id: '', code: '', type: 'percent', value: '', productId: null, maxUses: '', validUntil: '', active: true });
	let open = $state(false);
	let saving = $state(false);
	let formError = $state('');
	let d = $state<Draft>(blank());

	function edit(c?: Row) {
		formError = '';
		d = c
			? {
					id: c.id,
					code: c.code,
					type: c.percentOff ? 'percent' : 'amount',
					value: String(c.percentOff ?? c.amountOffInr ?? ''),
					productId: c.productId,
					maxUses: c.maxUses ? String(c.maxUses) : '',
					validUntil: c.validUntil ? new Date(c.validUntil).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
					active: c.active
				}
			: blank();
		open = true;
	}

	// Rows link to ?edit=<id>; the sheet follows the URL.
	const editId = $derived(page.url.searchParams.get('edit'));
	$effect(() => {
		const row = editId ? data.coupons.find((x) => x.id === editId) : undefined;
		if (row && d.id !== row.id) edit(row);
	});
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !open && editId) goto('/admin/coupons', { replace: true, reset: false });
		wasOpen = open;
	});

	const productOptions = $derived([{ value: '', label: 'Any product' }, ...data.products]);
	const statusOf = (c: Row) =>
		!c.active ? 'off' : c.validUntil && new Date(c.validUntil) <= new Date() ? 'expired' : c.maxUses != null && c.used >= c.maxUses ? 'used' : 'live';

	const submitSave: SubmitFunction = () => {
		saving = true;
		formError = '';
		return async ({ result, update }) => {
			saving = false;
			if (result.type === 'failure') formError = String(result.data?.message ?? 'Check the form.');
			else if (result.type === 'error') formError = result.error?.message ?? 'Something went wrong.';
			else if (result.type === 'success') {
				toast(String(result.data?.message ?? 'Saved'));
				open = false;
			}
			await update({ reset: false });
		};
	};
	const toasting: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Something went wrong.'), 'error');
		else if (result.type === 'success' && result.data?.message) toast(String(result.data.message));
		await update();
	};

	let delOpen = $state(false);
	let delForm = $state<HTMLFormElement>();
</script>

<svelte:head><title>Coupons · UCI Staff</title></svelte:head>

<div class="page">
	<PageHeader title="Coupons" subtitle="Discount codes students enter at checkout" crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<button class="btn btn-primary" onclick={() => edit()}><TicketPlus /> New coupon</button>
		{/snippet}
	</PageHeader>

	{#snippet code(r: Row)}
		<span class="block font-mono font-semibold truncate">{r.code}</span>
		<span class="block tiny muted truncate md:hidden">{couponOffText(r)} · {r.productTitle ?? 'Any product'}</span>
	{/snippet}
	{#snippet off(r: Row)}<span class="font-mono tabular">{couponOffText(r)}</span>{/snippet}
	{#snippet scope(r: Row)}<span class="small truncate block">{r.productTitle ?? 'Any product'}</span>{/snippet}
	{#snippet uses(r: Row)}<span class="font-mono tabular">{r.used}{r.maxUses != null ? ` / ${r.maxUses}` : ''}</span>{/snippet}
	{#snippet ends(r: Row)}<span class="small">{r.validUntil ? fmtDate(r.validUntil) : 'No end'}</span>{/snippet}
	{#snippet status(r: Row)}
		{@const s = statusOf(r)}
		{#if s === 'live'}<Badge tone="success">Active</Badge>{:else if s === 'off'}<Badge tone="draft">Off</Badge>{:else if s === 'expired'}<Badge tone="closed">Expired</Badge>{:else}<Badge tone="warning">Used up</Badge>{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={TicketPercent} title="No coupons yet" body="Make a code like MPPSC20 for 20% off one product or everything. Uses count only when a payment succeeds.">
			{#snippet action()}<button class="btn btn-primary" onclick={() => edit()}><TicketPlus /> New coupon</button>{/snippet}
		</EmptyState>
	{/snippet}

	<DataTable
		rows={data.coupons}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/coupons?edit=${r.id}`}
		{empty}
		columns={[
			{ key: 'code', label: 'Code', cell: code },
			{ key: 'off', label: 'Discount', cell: off, hideOnPhone: true },
			{ key: 'scope', label: 'Applies to', cell: scope, hideOnPhone: true },
			{ key: 'used', label: 'Used', cell: uses, align: 'right' },
			{ key: 'ends', label: 'Ends', cell: ends, hideOnPhone: true },
			{ key: 'status', label: 'Status', cell: status }
		]}
	/>
</div>

<Sheet bind:open title={d.id ? 'Edit coupon' : 'New coupon'} description="Checked again on the server when the order is created.">
	<form id="coupon-form" method="POST" action="?/save" use:enhance={submitSave} class="grid gap-4">
		<input type="hidden" name="id" value={d.id} />
		<div class="field">
			<label class="label" for="c-code">Code</label>
			<input class="input font-mono uppercase" id="c-code" name="code" bind:value={d.code} required maxlength="24" autocomplete="off" spellcheck="false" placeholder="MPPSC20" />
			<p class="help">Letters, numbers, - or _. Students can type it in any case.</p>
		</div>
		<fieldset class="field">
			<legend class="label">Discount</legend>
			<div class="segmented" role="radiogroup">
				<label><input type="radio" name="type" value="percent" bind:group={d.type} />Percent</label>
				<label><input type="radio" name="type" value="amount" bind:group={d.type} />Rupees</label>
			</div>
			<input class="input font-mono tabular mt-2" name="value" inputmode="numeric" required bind:value={d.value} aria-label={d.type === 'percent' ? 'Percent off' : 'Rupees off'} placeholder={d.type === 'percent' ? '20' : '100'} />
			<p class="help">{d.type === 'percent' ? 'Percent of the price, 1 to 100.' : 'Whole rupees off the price.'} Students always pay at least ₹1.</p>
		</fieldset>
		<div class="field">
			<span class="label">Applies to</span>
			<Picker bind:value={d.productId} name="productId" options={productOptions} placeholder="Any product" label="Applies to" searchable />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="field">
				<label class="label" for="c-max">Max uses <span class="muted">(optional)</span></label>
				<input class="input font-mono tabular" id="c-max" name="maxUses" inputmode="numeric" bind:value={d.maxUses} placeholder="No limit" />
			</div>
			<div class="field">
				<label class="label" for="c-until">Last day <span class="muted">(optional)</span></label>
				<input class="input" id="c-until" type="date" name="validUntil" bind:value={d.validUntil} />
			</div>
		</div>
		<Switch bind:checked={d.active} name="active" value="true" label="Active" description="Off stops new orders using it." />
		{#if formError}<p class="alert alert-danger" role="alert">{formError}</p>{/if}
	</form>
	{#if d.id}
		<div class="sheet-extra">
			<span class="small muted">Used <span class="font-mono tabular">{data.coupons.find((x) => x.id === d.id)?.used ?? 0}</span> times</span>
			<button class="btn btn-ghost btn-sm text-danger" type="button" onclick={() => (delOpen = true)}><Trash2 /> Delete</button>
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn btn-secondary" type="button" onclick={() => (open = false)}>Cancel</button>
		<button class="btn btn-primary" form="coupon-form" disabled={saving}>{saving ? 'Saving…' : d.id ? 'Save coupon' : 'Create coupon'}</button>
	{/snippet}
</Sheet>

<form method="POST" action="?/delete" bind:this={delForm} hidden use:enhance={toasting}>
	<input type="hidden" name="id" value={d.id} />
</form>
<ConfirmSheet
	bind:open={delOpen}
	title="Delete {d.code || 'coupon'}?"
	body="Only coupons no order has used can be deleted. To stop it, turn it off instead."
	confirmLabel="Delete coupon"
	danger
	onconfirm={() => {
		open = false;
		delForm?.requestSubmit();
	}}
/>

<style>
	.sheet-extra { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid hsl(var(--border)); }
</style>
