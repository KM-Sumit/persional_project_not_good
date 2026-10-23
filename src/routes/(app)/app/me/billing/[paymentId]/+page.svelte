<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import { Badge, PageHeader } from '#lib/components/ui';
	import { fmtDate, inrPaise, kindLabel } from '#lib/features/billing/format';

	let { data } = $props();
	const p = $derived(data.payment);
</script>

<svelte:head><title>Receipt {p.receipt} · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<div class="no-print">
		<PageHeader title="Receipt" crumbs={[{ href: '/app/me', label: 'Profile' }, { href: '/app/me/billing', label: 'Billing' }]}>
			{#snippet actions()}<button class="btn btn-secondary" onclick={() => print()}><Printer /> Print or save PDF</button>{/snippet}
		</PageHeader>
	</div>

	<article class="card card-pad receipt rise">
		<header class="r-head">
			<div>
				<p class="r-org">Upendra Competition Institute</p>
				{#if data.org.address}<p class="small muted">{data.org.address}</p>{/if}
				{#if data.org.email || data.org.phone}<p class="small muted">{[data.org.email, data.org.phone].filter(Boolean).join(' · ')}</p>{/if}
			</div>
			<div class="text-right">
				<p class="eyebrow">Payment receipt</p>
				<p class="font-mono tabular font-semibold">{p.receipt}</p>
				<Badge tone={p.status === 'paid' ? 'success' : 'draft'}>{p.status === 'paid' ? 'Paid' : p.status === 'refunded' ? 'Refunded' : p.status}</Badge>
			</div>
		</header>

		<dl class="r-meta">
			<div><dt>Billed to</dt><dd>{p.userName || p.userEmail}<br /><span class="muted small">{p.userEmail}</span></dd></div>
			<div><dt>Date</dt><dd>{fmtDate(p.paidAt ?? p.createdAt)}</dd></div>
			<div><dt>Payment ID</dt><dd class="font-mono small break-all">{p.razorpayPaymentId ?? '–'}</dd></div>
		</dl>

		<table class="r-table">
			<thead><tr><th>Item</th><th class="text-right">Amount</th></tr></thead>
			<tbody>
				<tr>
					<td>{p.productTitle}<br /><span class="muted small">{kindLabel[p.productKind]}</span></td>
					<td class="text-right font-mono tabular">{inrPaise(p.amountPaise)}</td>
				</tr>
			</tbody>
			<tfoot><tr><th>Total paid</th><th class="text-right font-mono tabular">{inrPaise(p.amountPaise)}</th></tr></tfoot>
		</table>
		<p class="tiny muted mt-6">Paid online through Razorpay. This is a computer-generated receipt and needs no signature.</p>
	</article>
</div>

<style>
	.receipt { margin-top: .5rem; }
	.r-head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-bottom: 1rem; border-bottom: 1px solid hsl(var(--border)); }
	.r-org { font-family: var(--font-display); font-stretch: var(--display-stretch); font-weight: 800; font-size: 1.25rem; }
	.r-head > div:last-child { text-align: right; margin-left: auto; }
	.r-meta { display: grid; gap: .75rem; margin: 1.25rem 0; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); }
	.r-meta dt { font-size: .75rem; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: .04em; }
	.r-table { width: 100%; border-collapse: collapse; }
	.r-table th, .r-table td { padding: .625rem 0; border-bottom: 1px solid hsl(var(--border)); text-align: left; vertical-align: top; }
	.r-table thead th { font-size: .75rem; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: .04em; }
	.r-table tfoot th { border-bottom: 0; font-size: 1.0625rem; }
	.r-table .text-right { text-align: right; }
	@media print {
		:global(.appbar, .tabbar, .sidebar, .toasts) { display: none !important; }
		.no-print { display: none; }
		.receipt { box-shadow: none; border: 0; }
	}
</style>
