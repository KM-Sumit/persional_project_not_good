<script lang="ts">
	import { ChevronRight, Receipt, Ticket } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader } from '#lib/components/ui';
	import { fmtDate, inrPaise, kindLabel, type PaymentStatus } from '#lib/features/billing/format';

	let { data } = $props();
	const statusTone: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'draft'> = {
		paid: 'success',
		created: 'warning',
		failed: 'danger',
		refunded: 'draft'
	};
	const statusLabel: Record<PaymentStatus, string> = { paid: 'Paid', created: 'Pending', failed: 'Failed', refunded: 'Refunded' };
	const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
</script>

<svelte:head><title>Billing · UCI</title></svelte:head>

<div class="page-narrow pb-10">
	<PageHeader title="Billing" subtitle="Your passes, purchases and receipts" crumbs={[{ href: '/app/me', label: 'Me' }]} />

	{#if !data.passes.length && !data.payments.length}
		<div class="card rise">
			<EmptyState icon={Ticket} title="Nothing bought yet" body="Passes and courses you buy show up here with their end date and receipt.">
				{#snippet action()}<a class="btn btn-secondary" href="/app/tests">Browse tests</a>{/snippet}
			</EmptyState>
		</div>
	{:else}
	<section class="rise" style="--i: 0" aria-labelledby="passes">
		<h2 id="passes" class="section-title mb-3">Your access</h2>
		{#if data.passes.length}
			<div class="list">
				{#each data.passes as e (e.productId)}
					<a class="list-row" href={e.active ? e.href : `/app/checkout?product=${e.productId}`}>
						<span class="leading-icon" aria-hidden="true"><Ticket /></span>
						<span class="grow">
							<span class="title block">{e.title}</span>
							<span class="meta block">
								{kindLabel[e.kind]} ·
								{#if !e.active}Ended {fmtDate(e.expiresAt!)}
								{:else if e.expiresAt}Until {fmtDate(e.expiresAt)}
								{:else}Lifetime{/if}{e.granted ? ' · given by the institute' : ''}
							</span>
						</span>
						<span class="trail">
							{#if !e.active}<Badge tone="closed">Renew</Badge>
							{:else if e.expiresAt && daysLeft(e.expiresAt) <= 15}<Badge tone="warning"><span class="font-mono tabular">{daysLeft(e.expiresAt)}</span> days left</Badge>
							{:else}<Badge tone="success">Active</Badge>{/if}
						</span>
						<ChevronRight class="chev" aria-hidden="true" />
					</a>
				{/each}
			</div>
		{:else}
			<div class="card">
				<EmptyState icon={Ticket} compact title="No passes yet" body="When you buy a test series pass or a course, it shows up here with its end date.">
					{#snippet action()}<a class="btn btn-secondary" href="/app/tests">Browse tests</a>{/snippet}
				</EmptyState>
			</div>
		{/if}
	</section>

	<section class="rise mt-8" style="--i: 1" aria-labelledby="purchases">
		<h2 id="purchases" class="section-title mb-3">Payments</h2>
		{#if data.payments.length}
			<div class="list">
				{#each data.payments as pay (pay.id)}
					{@const linkable = pay.status === 'paid' || pay.status === 'refunded'}
					<svelte:element this={linkable ? 'a' : 'div'} class="list-row" href={linkable ? `/app/me/billing/${pay.id}` : undefined}>
						<span class="leading-icon" aria-hidden="true"><Receipt /></span>
						<span class="grow">
							<span class="title block">{pay.productTitle}</span>
							<span class="meta block"><span class="font-mono">{pay.receipt}</span> · {fmtDate(pay.paidAt ?? pay.createdAt)}</span>
						</span>
						<span class="trail">
							<span class="block font-mono tabular font-semibold">{inrPaise(pay.amountPaise)}</span>
							<Badge tone={statusTone[pay.status]}>{statusLabel[pay.status]}</Badge>
						</span>
						{#if linkable}<ChevronRight class="chev" aria-hidden="true" />{/if}
					</svelte:element>
				{/each}
			</div>
			<p class="small muted mt-3">Paid but not unlocked? It usually takes under a minute. If not, contact the institute with the receipt number.</p>
		{:else}
			<div class="card">
				<EmptyState icon={Receipt} compact title="No payments yet" body="Receipts for everything you buy will be kept here." />
			</div>
		{/if}
	</section>
	{/if}
</div>
