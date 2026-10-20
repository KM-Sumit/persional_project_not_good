<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Copy, Gift, KeyRound, LoaderCircle, Receipt, Search, Undo2, UserRound } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Sheet, Tabs, toast } from '#lib/components/ui';
	import { ConfirmSheet, DataTable, FilterBar, Kpi, Picker } from '#lib/components/kit';
	import { fmtDate, inrPaise, kindLabel, type EntitlementDTO, type PaymentDTO, type PaymentStatus } from '#lib/features/billing/format';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	type Row = PaymentDTO;

	const tone: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'draft'> = { paid: 'success', created: 'warning', failed: 'danger', refunded: 'draft' };
	const label: Record<PaymentStatus, string> = { paid: 'Paid', created: 'Pending', failed: 'Failed', refunded: 'Refunded' };
	const tabHref = (s: string) => {
		const u = new URL(page.url.href);
		u.searchParams.delete('cursor');
		if (s) u.searchParams.set('status', s);
		else u.searchParams.delete('status');
		return u.pathname + u.search;
	};
	const tabs = $derived([
		{ value: '', label: 'All', count: data.counts.all, href: tabHref('') },
		...(['paid', 'created', 'failed', 'refunded'] as const).map((s) => ({ value: s, label: label[s], count: data.counts[s], href: tabHref(s) }))
	]);

	const toasting: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Something went wrong.'), 'error');
		else if (result.type === 'error') toast(result.error?.message ?? 'Something went wrong.', 'error');
		else if (result.type === 'success' && result.data?.message) toast(String(result.data.message));
		await update();
	};
	const copy = async (v: string) => {
		await navigator.clipboard?.writeText(v).catch(() => {});
		toast('Copied');
	};

	// ---------- row detail (?pay=<id>) ----------
	const payHref = (id: string) => {
		const u = new URL(page.url.href);
		u.searchParams.set('pay', id);
		return u.pathname + u.search;
	};
	const sel = $derived(data.rows.find((r) => r.id === page.url.searchParams.get('pay')) ?? null);
	let detailOpen = $state(false);
	$effect(() => {
		detailOpen = !!sel;
	});
	function closeDetail() {
		const u = new URL(page.url.href);
		u.searchParams.delete('pay');
		goto(u.pathname + u.search, { replace: true, reset: false });
	}
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !detailOpen && sel) closeDetail();
		wasOpen = detailOpen;
	});

	// ---------- refund confirm ----------
	let refundOpen = $state(false);
	let refundRow = $state<Row | null>(null);
	let refundForm = $state<HTMLFormElement>();

	// ---------- manual grant sheet ----------
	type Student = { id: string; name: string; email: string; holdings: EntitlementDTO[] };
	let grantOpen = $state(false);
	let q = $state('');
	let searching = $state(false);
	let students = $state<Student[]>([]);
	let picked = $state<Student | null>(null);
	let productId = $state<string | null>(null);
	let expiresAt = $state('');
	let granting = $state(false);
	let searchForm = $state<HTMLFormElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function openGrant() {
		q = '';
		students = [];
		picked = null;
		productId = null;
		expiresAt = '';
		grantOpen = true;
	}
	const onSearch: SubmitFunction = () => {
		searching = true;
		return async ({ result }) => {
			searching = false;
			if (result.type === 'success') students = (result.data?.students ?? []) as Student[];
		};
	};
	const onGrant: SubmitFunction = () => {
		granting = true;
		return async ({ result, update }) => {
			granting = false;
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not grant.'), 'error');
			else if (result.type === 'success') {
				toast(String(result.data?.message ?? 'Access granted'));
				grantOpen = false;
			}
			await update({ reset: false });
		};
	};
	const onRevoke: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'success' && picked) {
			const pid = (result.data?.revoked as { productId: string }).productId;
			picked = { ...picked, holdings: picked.holdings.filter((h) => h.productId !== pid) };
			toast('Access removed');
		} else if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not remove.'), 'error');
		await update({ reset: false, refreshAll: false });
	};
</script>

<svelte:head><title>Payments · UCI Staff</title></svelte:head>

<div class="page">
	<PageHeader title="Payments" subtitle="Orders and who has access" crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<button class="btn btn-primary" onclick={openGrant}><Gift /> Grant access</button>
		{/snippet}
	</PageHeader>

	{#if data.counts.all}
	<p class="kpi-line mb-4 small">
		<span>This month <b class="font-mono tabular">{inrPaise(data.revenue.monthPaise)}</b></span>
		<span>Today <b class="font-mono tabular">{inrPaise(data.revenue.todayPaise)}</b></span>
		{#if data.counts.failed}<a href={tabHref('failed')} class="text-danger">{data.counts.failed} failed</a>{/if}
	</p>
	<section class="kpis mb-5" aria-label="Revenue">
		<Kpi label="Today" value={inrPaise(data.revenue.todayPaise)} />
		<Kpi label="This month" value={inrPaise(data.revenue.monthPaise)} />
		<Kpi label="All time" value={inrPaise(data.revenue.allPaise)} hint="{data.counts.paid} paid {data.counts.paid === 1 ? 'order' : 'orders'}" />
		<Kpi label="Failed" value={data.counts.failed} hint="{data.counts.created} pending" href={tabHref('failed')} />
	</section>
	{/if}

	{#if data.counts.all || page.url.searchParams.get('q')}
		<div class="mb-3"><Tabs items={tabs} value={data.status} label="Payment status" /></div>
		<div class="mb-4"><FilterBar search placeholder="Receipt, email or name" filters={[]} /></div>
	{/if}

	{#snippet who(r: Row)}
		<span class="block font-semibold truncate">{r.userName || r.userEmail}</span>
		<span class="hidden md:block tiny muted truncate">{r.userEmail}</span>
	{/snippet}
	{#snippet item(r: Row)}<span class="truncate">{r.productTitle}</span>{/snippet}
	{#snippet receipt(r: Row)}<span class="font-mono small">{r.receipt}</span>{/snippet}
	{#snippet amount(r: Row)}<span class="font-mono tabular font-semibold">{inrPaise(r.amountPaise)}</span>{#if r.couponCode}<span class="hidden md:block tiny muted font-mono">{r.couponCode}</span>{/if}{/snippet}
	{#snippet status(r: Row)}<Badge tone={tone[r.status]}>{label[r.status]}</Badge>{/snippet}
	{#snippet date(r: Row)}<span class="small muted">{fmtDate(r.paidAt ?? r.createdAt)}</span>{/snippet}
	{#snippet empty()}
		<EmptyState
			icon={Receipt}
			title={page.url.searchParams.get('q') || data.status ? 'No payments match' : 'No payments yet'}
			body={page.url.searchParams.get('q') || data.status ? 'Try another search or status.' : 'Orders appear here the moment a student starts a checkout.'}
		/>
	{/snippet}

	<DataTable
		rows={data.rows}
		getId={(r) => r.id}
		rowHref={(r) => payHref(r.id)}
		nextCursor={data.nextCursor}
		{empty}
		columns={[
			{ key: 'who', label: 'Student', cell: who },
			{ key: 'item', label: 'Product', cell: item },
			{ key: 'amount', label: 'Amount', cell: amount, align: 'right' },
			{ key: 'status', label: 'Status', cell: status },
			{ key: 'receipt', label: 'Receipt', cell: receipt, hideOnPhone: true },
			{ key: 'date', label: 'Date', cell: date, hideOnPhone: true }
		]}
	/>
</div>

<Sheet bind:open={detailOpen} title={sel?.receipt ?? 'Payment'} description={sel ? `${sel.productTitle} · ${kindLabel[sel.productKind]}` : ''}>
	{#if sel}
		<dl class="detail">
			<div><dt>Student</dt><dd>{sel.userName || sel.userEmail}<span class="block small muted">{sel.userEmail}</span></dd></div>
			<div><dt>Amount</dt><dd class="font-mono tabular font-semibold">{inrPaise(sel.amountPaise)}</dd></div>
			{#if sel.couponCode}<div><dt>Coupon</dt><dd class="font-mono">{sel.couponCode}</dd></div>{/if}
			<div><dt>Status</dt><dd><Badge tone={tone[sel.status]}>{label[sel.status]}</Badge></dd></div>
			<div><dt>{sel.paidAt ? 'Paid' : 'Started'}</dt><dd>{fmtDate(sel.paidAt ?? sel.createdAt)}</dd></div>
			<div><dt>Razorpay order</dt><dd><button class="rzp font-mono small" onclick={() => copy(sel.razorpayOrderId)}>{sel.razorpayOrderId}<Copy /></button></dd></div>
			{#if sel.razorpayPaymentId}<div><dt>Razorpay payment</dt><dd><button class="rzp font-mono small" onclick={() => copy(sel.razorpayPaymentId!)}>{sel.razorpayPaymentId}<Copy /></button></dd></div>{/if}
			{#if sel.error}<div><dt>Reason</dt><dd class="text-danger small">{sel.error}</dd></div>{/if}
		</dl>
		{#if sel.status === 'paid'}
			<form method="POST" action="?/regrant" use:enhance={toasting} class="mt-5">
				<input type="hidden" name="id" value={sel.id} />
				<button class="btn btn-primary btn-block"><KeyRound /> Grant access again</button>
				<p class="help mt-1">Use when the student paid but cannot see the content.</p>
			</form>
		{:else if sel.status !== 'refunded'}
			<p class="small muted mt-5">Not paid. If the student shows a Razorpay payment for this order, use Grant access.</p>
		{/if}
	{/if}
	{#snippet footer()}
		{#if sel?.status === 'paid'}
			<button class="btn btn-ghost text-danger" type="button" onclick={() => ((refundRow = sel), (refundOpen = true))}><Undo2 /> Mark refunded</button>
			<a class="btn btn-secondary" href="/app/me/billing/{sel.id}"><Receipt /> Receipt</a>
		{:else}
			<button class="btn btn-secondary" type="button" onclick={() => (detailOpen = false)}>Close</button>
		{/if}
	{/snippet}
</Sheet>

<form method="POST" action="?/refund" bind:this={refundForm} hidden use:enhance={toasting}>
	<input type="hidden" name="id" value={refundRow?.id ?? ''} />
</form>
<ConfirmSheet
	bind:open={refundOpen}
	title="Mark {refundRow?.receipt ?? ''} refunded?"
	body="Refund {refundRow ? inrPaise(refundRow.amountPaise) : ''} in the Razorpay dashboard first. This records it and removes the student's access to {refundRow?.productTitle ?? 'the product'}."
	confirmLabel="Mark refunded"
	danger
	onconfirm={() => refundForm?.requestSubmit()}
/>

<Sheet bind:open={grantOpen} title="Grant access" description="For cash payments, scholarships or fixing a stuck order. No money is recorded.">
	{#if !picked}
		<form method="POST" action="?/search" bind:this={searchForm} use:enhance={onSearch} class="field">
			<label class="label" for="g-q">Student</label>
			<div class="search-row">
				<Search aria-hidden="true" />
				<input
					class="input"
					id="g-q"
					name="q"
					type="search"
					autocomplete="off"
					placeholder="Name, email or phone"
					bind:value={q}
					oninput={() => {
						clearTimeout(timer);
						timer = setTimeout(() => searchForm?.requestSubmit(), 250);
					}}
				/>
				{#if searching}<LoaderCircle class="animate-spin" aria-hidden="true" />{/if}
			</div>
		</form>
		{#if students.length}
			<div class="list mt-3">
				{#each students as s (s.id)}
					<button type="button" class="list-row" onclick={() => (picked = s)}>
						<span class="leading-icon" aria-hidden="true"><UserRound /></span>
						<span class="grow"><span class="title block">{s.name || s.email}</span><span class="meta block">{s.email}</span></span>
						{#if s.holdings.some((h) => h.active)}<Badge tone="success">{s.holdings.filter((h) => h.active).length} active</Badge>{/if}
					</button>
				{/each}
			</div>
		{:else if q.trim().length >= 2 && !searching}
			<p class="small muted mt-3">No student matches "{q}".</p>
		{/if}
	{:else}
		<div class="card card-pad picked">
			<div class="min-w-0">
				<p class="font-semibold truncate">{picked.name || picked.email}</p>
				<p class="small muted truncate">{picked.email}</p>
			</div>
			<button class="btn btn-ghost btn-sm" type="button" onclick={() => (picked = null)}>Change</button>
		</div>

		{#if picked.holdings.length}
			<h3 class="eyebrow mt-4 mb-2">Has access to</h3>
			<div class="list">
				{#each picked.holdings as h (h.productId)}
					<div class="list-row">
						<span class="grow">
							<span class="title block">{h.title}</span>
							<span class="meta block">{h.active ? (h.expiresAt ? `Until ${fmtDate(h.expiresAt)}` : 'Lifetime') : `Ended ${fmtDate(h.expiresAt!)}`}{h.granted ? ' · granted' : ''}</span>
						</span>
						<form method="POST" action="?/revoke" use:enhance={onRevoke}>
							<input type="hidden" name="userId" value={picked.id} />
							<input type="hidden" name="productId" value={h.productId} />
							<button class="btn btn-ghost btn-sm">Remove</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}

		<form id="grant-form" method="POST" action="?/grant" use:enhance={onGrant} class="grid gap-4 mt-5">
			<input type="hidden" name="userId" value={picked.id} />
			<div class="field">
				<span class="label">Product</span>
				<Picker bind:value={productId} name="productId" options={data.products} placeholder="Choose product" label="Product" searchable />
			</div>
			<div class="field">
				<label class="label" for="g-exp">Access ends <span class="muted">(optional)</span></label>
				<input class="input" id="g-exp" type="date" name="expiresAt" bind:value={expiresAt} />
				<p class="help">Leave blank to use the product's own validity.</p>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<button class="btn btn-secondary" type="button" onclick={() => (grantOpen = false)}>Cancel</button>
		<button class="btn btn-primary" form="grant-form" disabled={!picked || !productId || granting}>{granting ? 'Granting…' : 'Grant access'}</button>
	{/snippet}
</Sheet>

<style>
	.kpis { display: none; }
	.kpi-line { display: flex; flex-wrap: wrap; gap: .25rem 1rem; color: hsl(var(--muted-foreground)); }
	.kpi-line b { color: hsl(var(--foreground)); }
	@media (min-width: 768px) { .kpi-line { display: none; } .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; } }
	.detail { display: grid; gap: .75rem; }
	.detail > div { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
	.detail dt { font-size: .8125rem; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
	.detail dd { text-align: right; min-width: 0; overflow-wrap: anywhere; }
	.rzp { display: inline-flex; align-items: center; gap: .25rem; max-width: 100%; }
	.rzp :global(svg) { width: .75rem; height: .75rem; flex-shrink: 0; }
	.search-row { position: relative; display: flex; align-items: center; }
	.search-row > :global(svg) { position: absolute; width: 1rem; height: 1rem; color: hsl(var(--muted-foreground)); }
	.search-row > :global(svg:first-child) { left: .75rem; }
	.search-row > :global(svg:last-child:not(:first-child)) { right: .75rem; }
	.search-row .input { padding-left: 2.25rem; }
	.picked { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .75rem 1rem; }
</style>
