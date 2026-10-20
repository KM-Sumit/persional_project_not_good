<script lang="ts">
	// Unlock offer for paid content: product, what it includes, price, and two equal actions (unlock + a free option).
	// Used by the locked lesson, the paid course page and the paid note.
	import { Lock, Play, ShieldCheck } from '@lucide/svelte';
	import { Badge } from '#lib/components/ui';
	import { inr, offerIncludes, percentOff, type PaywallOffer } from '../format';

	let {
		offer,
		eyebrow = 'Unlock this course',
		free = null
	}: { offer: PaywallOffer | null; eyebrow?: string; free?: { href: string; label: string; play?: boolean } | null } = $props();
	const off = $derived(offer ? percentOff(offer) : 0);
</script>

<section class="card card-pad offer" aria-label={eyebrow}>
	<p class="eyebrow">{eyebrow}</p>
	{#if offer}
		<h2 class="o-title">{offer.title}</h2>
		<p class="small muted">{offerIncludes(offer)}</p>
		<p class="o-price">
			<span class="now tabular">{inr(offer.priceInr)}</span>
			{#if off}<s class="font-mono tabular muted">{inr(offer.mrpInr!)}</s><Badge tone="success">{off}% off</Badge>{/if}
		</p>
	{:else}
		<h2 class="o-title">Paid content</h2>
		<p class="small muted">It is not on sale online yet. Ask the institute to unlock it for you.</p>
	{/if}
	{#if offer || free}
		<div class="o-actions">
			{#if offer}<a class="btn btn-primary btn-lg" href="/app/checkout?product={offer.id}"><Lock />Unlock for {inr(offer.priceInr)}</a>{/if}
			{#if free}<a class="btn btn-secondary btn-lg" href={free.href} data-sveltekit-replacestate>{#if free.play}<Play />{/if}{free.label}</a>{/if}
		</div>
	{/if}
	{#if offer}<p class="trust tiny muted"><ShieldCheck class="size-3.5" aria-hidden="true" /><span>UPI, cards and net banking</span><span class="whitespace-nowrap">Secure payment by Razorpay</span></p>{/if}
</section>

<style>
	.offer {
		container-type: inline-size;
	}
	.o-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-size: 1.375rem;
		font-weight: 800;
		line-height: 1.15;
		margin-top: 0.25rem;
	}
	.o-price {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.now {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-size: 2rem;
		font-weight: 800;
		line-height: 1;
	}
	.o-actions {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	@container (min-width: 30rem) {
		.o-actions:has(> :nth-child(2)) {
			grid-template-columns: 1fr 1fr;
		}
	}
	.o-actions .btn {
		width: 100%;
		white-space: nowrap;
	}
	/* Two phrases separated by a dot that only shows when they share a line (wraps cleanly on phones). */
	.trust {
		margin-top: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		column-gap: 0.375rem;
		text-align: center;
	}
	.trust > span + span::before {
		content: '·';
		margin-right: 0.375rem;
	}
	@media (max-width: 420px) {
		.trust > span + span { flex-basis: 100%; }
		.trust > span + span::before { content: none; }
	}
</style>
