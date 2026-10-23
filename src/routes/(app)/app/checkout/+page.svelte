<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { CalendarClock, CircleAlert, CircleCheck, LoaderCircle, LockOpen, MessageCircle, ShieldCheck, TicketPercent, X } from '@lucide/svelte';
	import { Badge, PageHeader } from '#lib/components/ui';
	import { fmtDate, inr, kindLabel, validityText, type CheckoutOrder, type CouponQuote } from '#lib/features/billing/format';

	let { data } = $props();
	const p = $derived(data.product);

	type Phase = 'idle' | 'opening' | 'paying' | 'verifying' | 'success' | 'failed' | 'cancelled';
	type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
	type RzpFail = { error?: { description?: string; metadata?: { order_id?: string } } };
	type RzpCtor = new (o: Record<string, unknown>) => { open(): void; on(ev: string, cb: (r: RzpFail) => void): void };

	let phase = $state<Phase>('idle');
	let message = $state('');
	let unlocked = $state('');
	let orderId = $state('');
	let resp = $state<RzpResponse>({ razorpay_order_id: '', razorpay_payment_id: '', razorpay_signature: '' });
	let verifyForm = $state<HTMLFormElement>();
	let failForm = $state<HTMLFormElement>();
	const busy = $derived(phase === 'opening' || phase === 'paying' || phase === 'verifying');

	// ---------- coupon ----------
	let quote = $state<CouponQuote | null>(null);
	$effect.pre(() => {
		quote = data.quote; // a ?coupon= link pre-applies; changes with the product
	});
	let couponOpen = $state(false);
	let couponCode = $state('');
	let couponError = $state('');
	let applying = $state(false);
	const total = $derived(quote?.totalInr ?? p.priceInr);

	const included = $derived(
		p.kind === 'exam_pass'
			? [`Every paid mock test and PYQ for ${p.targetName}`, `Paid courses and notes for ${p.targetName}`, 'Rank, analysis and solutions after each test']
			: p.kind === 'course'
				? [`The full course: ${p.targetName}`, 'Every lesson, notes and practice inside it', 'Pick up where you left off on any device']
				: [`The test: ${p.targetName}`, 'Rank, analysis and solutions after you submit']
	);
	const off = $derived(p.mrpInr && p.mrpInr > p.priceInr ? Math.round(((p.mrpInr - p.priceInr) / p.mrpInr) * 100) : 0);
	const canExtend = $derived(!data.owned || (!!p.validityDays && !p.validUntil && data.owned.expiresAt !== null));

	// Checkout.js: loaded on first tap, once; a failed load clears the promise so the next tap retries.
	let sdk: Promise<RzpCtor> | undefined;
	function loadSdk() {
		return (sdk ??= new Promise<RzpCtor>((resolve, reject) => {
			const w = window as unknown as { Razorpay?: RzpCtor };
			if (w.Razorpay) return resolve(w.Razorpay);
			const s = document.createElement('script');
			s.src = 'https://checkout.razorpay.com/v1/checkout.js';
			s.async = true;
			s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Checkout could not load.')));
			s.onerror = () => {
				sdk = undefined;
				s.remove();
				reject(new Error('Checkout could not load. Check your connection and try again.'));
			};
			document.head.append(s);
		}));
	}

	/** Razorpay wants a hex theme colour; derive it from the --primary token so the brand stays in one place. */
	function primaryHex() {
		const [h, s, l] = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().split(/\s+/).map(parseFloat);
		if ([h, s, l].some(Number.isNaN)) return undefined;
		const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
		const f = (n: number) => {
			const k = (n + h / 30) % 12;
			return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
		};
		return `#${f(0)}${f(8)}${f(4)}`;
	}

	async function pay(order: CheckoutOrder) {
		orderId = order.orderId;
		try {
			const Razorpay = await loadSdk();
			phase = 'paying';
			const rzp = new Razorpay({
				key: order.keyId,
				order_id: order.orderId,
				amount: order.amountPaise,
				currency: 'INR',
				name: 'Upendra Competition Institute',
				description: order.title,
				prefill: data.prefill,
				notes: { receipt: order.receipt },
				theme: { color: primaryHex() },
				// UPI first (most students pay with GPay / PhonePe), every other method still below it.
				config: {
					display: {
						blocks: { upi: { name: 'Pay with UPI', instruments: [{ method: 'upi' }] } },
						sequence: ['block.upi'],
						preferences: { show_default_blocks: true }
					}
				},
				handler: (r: RzpResponse) => {
					resp = r;
					phase = 'verifying';
					tick().then(() => verifyForm?.requestSubmit());
				},
				modal: {
					ondismiss: () => {
						if (phase === 'paying') phase = 'cancelled';
					}
				}
			});
			rzp.on('payment.failed', (r) => {
				phase = 'failed';
				message = r.error?.description ?? 'The payment did not go through.';
				tick().then(() => failForm?.requestSubmit());
			});
			rzp.open();
		} catch (e) {
			phase = 'failed';
			message = (e as Error).message;
		}
	}
</script>

<svelte:head><title>Checkout · {p.title} · UCI</title></svelte:head>

<div class="page checkout">
	<PageHeader title="Checkout" crumbs={[{ href: '/app/me', label: 'Profile' }]} />

	{#if phase === 'success'}
		<section class="card card-pad rise done" role="status">
			<span class="done-icon"><CircleCheck /></span>
			<h2 class="title">You're in.</h2>
			<p class="muted">{p.title} is unlocked on your account. A receipt is in Billing.</p>
			<div class="done-actions">
				<a class="btn btn-primary btn-lg" href={unlocked || '/app'}><LockOpen /> Open {kindLabel[p.kind].toLowerCase()}</a>
				<a class="btn btn-secondary btn-lg" href="/app/me/billing">See receipt</a>
			</div>
		</section>
	{:else}
		<div class="grid-co">
			<section class="card card-pad rise" style="--i: 0">
				<div class="flex flex-wrap items-center gap-2">
					<Badge tone="primary">{kindLabel[p.kind]}</Badge>
					<span class="small muted inline-flex items-center gap-1"><CalendarClock class="size-4" aria-hidden="true" />{validityText(p)}</span>
				</div>
				<h2 class="title">{p.title}</h2>
				{#if p.description}<p class="desc">{p.description}</p>{/if}
				<h3 class="eyebrow mt-5">What you get</h3>
				<ul class="gets">
					{#each included as line (line)}
						<li><CircleCheck aria-hidden="true" />{line}</li>
					{/each}
				</ul>
			</section>

			<aside class="rise" style="--i: 1">
				<div class="card card-pad price-card">
					{#if data.owned}
						<p class="alert alert-success mb-4 flex items-start gap-2" role="status">
							<CircleCheck class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
							<span>You already have this{data.owned.expiresAt ? ` until ${fmtDate(data.owned.expiresAt)}` : ' for life'}.
								<a class="underline font-semibold" href={data.owned.href}>Open it</a></span>
						</p>
					{/if}

					<p class="eyebrow">Price</p>
					<p class="price">
						<span class="font-mono tabular now">{inr(total)}</span>
						{#if quote}<s class="font-mono tabular mrp">{inr(p.priceInr)}</s>
						{:else if off}<s class="font-mono tabular mrp">{inr(p.mrpInr!)}</s><Badge tone="success">{off}% off</Badge>{/if}
					</p>
					<p class="small muted">One-time payment. {validityText(p)}.</p>

					{#if data.enabled && data.onSale && canExtend}
						{#if quote}
							<div class="coupon-on" role="status">
								<TicketPercent class="size-4 shrink-0" aria-hidden="true" />
								<span class="grow min-w-0"><span class="font-mono font-semibold">{quote.code}</span> applied · <span class="font-mono tabular">{inr(quote.offInr)}</span> off</span>
								<button type="button" class="icon-btn" aria-label="Remove coupon" disabled={busy} onclick={() => { quote = null; couponCode = ''; }}><X /></button>
							</div>
						{:else if !couponOpen}
							<button type="button" class="btn btn-ghost btn-sm coupon-link" onclick={() => (couponOpen = true)}><TicketPercent />Have a coupon?</button>
						{:else}
							<form
								class="coupon-form"
								method="POST"
								action="?/coupon"
								use:enhance={() => {
									applying = true;
									couponError = '';
									return async ({ result }) => {
										applying = false;
										if (result.type === 'success' && result.data?.quote) quote = result.data.quote as CouponQuote;
										else couponError = result.type === 'failure' ? String(result.data?.couponError ?? 'That code did not work.') : 'Could not check the code. Try again.';
									};
								}}
							>
								<input type="hidden" name="productId" value={p.id} />
								<label class="sr-only" for="coupon-code">Coupon code</label>
								<input
									id="coupon-code"
									class="input font-mono uppercase"
									name="code"
									bind:value={couponCode}
									maxlength="24"
									autocomplete="off"
									autocapitalize="characters"
									spellcheck="false"
									placeholder="Coupon code"
									aria-invalid={couponError ? 'true' : undefined}
									aria-describedby={couponError ? 'coupon-error' : undefined}
								/>
								<button class="btn btn-secondary" disabled={applying || !couponCode.trim()}>
									{#if applying}<LoaderCircle class="animate-spin" aria-hidden="true" />{/if}Apply
								</button>
							</form>
							{#if couponError}<p id="coupon-error" class="small text-danger mt-1.5" role="alert">{couponError}</p>{/if}
						{/if}
					{/if}

					{#if phase === 'failed'}
						<p class="alert alert-danger mt-4 flex items-start gap-2" role="alert">
							<CircleAlert class="size-4 shrink-0 mt-0.5" aria-hidden="true" /><span>{message} No money was taken for this attempt. You can try again.</span>
						</p>
					{:else if phase === 'cancelled'}
						<p class="alert mt-4 flex items-start gap-2" role="status"><X class="size-4 shrink-0 mt-0.5" aria-hidden="true" />Payment window closed. Nothing was charged.</p>
					{:else if phase === 'verifying'}
						<p class="alert mt-4 flex items-center gap-2" role="status">
							<LoaderCircle class="size-4 shrink-0 animate-spin" aria-hidden="true" />Confirming your payment…
						</p>
					{/if}

					{#if !data.enabled}
						<div class="alert alert-warning mt-4" role="status">
							<p class="font-semibold">Payments are not set up yet — contact the institute.</p>
							<p class="mt-1">Pay at the centre or on WhatsApp and we'll unlock it for you.</p>
						</div>
						{#if !data.owned}
							<div class="actionbar inline-desktop">
								<div class="actionbar-inner">
									<span class="bar-price"><span class="font-mono tabular">{inr(p.priceInr)}</span><span class="tiny muted">{validityText(p)}</span></span>
									{#if data.whatsapp}
										<a class="btn btn-primary btn-lg pay" href={data.whatsapp} target="_blank" rel="noopener"><MessageCircle /> WhatsApp us</a>
									{:else}
										<a class="btn btn-primary btn-lg pay" href="/contact"><MessageCircle /> Contact us</a>
									{/if}
								</div>
							</div>
						{/if}
					{:else if !data.onSale}
						<p class="alert alert-warning mt-4" role="status">This is not on sale right now. Ask the institute about the next batch.</p>
					{:else if canExtend}
						<div class="actionbar inline-desktop">
							<form
								class="actionbar-inner"
								method="POST"
								action="?/start"
								use:enhance={() => {
									phase = 'opening';
									return async ({ result }) => {
										if (result.type === 'success' && result.data?.order) await pay(result.data.order as CheckoutOrder);
										else {
											phase = 'failed';
											message =
												result.type === 'failure' ? String(result.data?.message ?? 'Could not start the payment.') : 'Could not start the payment.';
										}
									};
								}}
							>
								<input type="hidden" name="productId" value={p.id} />
								<input type="hidden" name="coupon" value={quote?.code ?? ''} />
								<span class="bar-price"><span class="font-mono tabular">{inr(total)}</span><span class="tiny muted">{validityText(p)}</span></span>
								<button class="btn btn-primary btn-lg pay" disabled={busy}>
									{#if busy}<LoaderCircle class="animate-spin" aria-hidden="true" />{/if}
									{#if phase === 'opening'}Opening…{:else if phase === 'verifying'}Confirming…{:else}<span class="md:hidden">{data.owned ? 'Extend' : 'Pay now'}</span><span class="hidden md:inline">{data.owned ? 'Extend for' : 'Pay'} {inr(total)}</span>{/if}
								</button>
							</form>
						</div>
						<p class="secure small muted"><ShieldCheck class="size-4" aria-hidden="true" />UPI, cards and netbanking · secured by Razorpay</p>
					{/if}

					{#if data.enabled && data.whatsapp && phase === 'failed'}
						<a class="btn btn-ghost btn-block mt-2" href={data.whatsapp} target="_blank" rel="noopener"><MessageCircle /> Need help? WhatsApp us</a>
					{/if}
				</div>
			</aside>
		</div>
	{/if}
</div>

<form
	method="POST"
	action="?/verify"
	bind:this={verifyForm}
	hidden
	use:enhance={() =>
		async ({ result }) => {
			if (result.type === 'success') {
				unlocked = String(result.data?.href ?? '/app');
				phase = 'success';
			} else {
				phase = 'failed';
				message =
					result.type === 'failure'
						? String(result.data?.message ?? 'We could not confirm the payment.')
						: 'We could not confirm the payment. If money was taken, access unlocks within minutes.';
			}
		}}
>
	<input type="hidden" name="razorpay_order_id" value={resp.razorpay_order_id} />
	<input type="hidden" name="razorpay_payment_id" value={resp.razorpay_payment_id} />
	<input type="hidden" name="razorpay_signature" value={resp.razorpay_signature} />
</form>
<form method="POST" action="?/failed" bind:this={failForm} hidden use:enhance={() => async () => {}}>
	<input type="hidden" name="orderId" value={orderId} />
	<input type="hidden" name="reason" value={message} />
</form>

<style>
	.checkout { max-width: 64rem; }
	.grid-co { display: grid; gap: 1rem; }
	@media (min-width: 900px) {
		.grid-co { grid-template-columns: minmax(0, 1fr) 22rem; align-items: start; gap: 1.5rem; }
		aside { position: sticky; top: calc(var(--appbar-h) + 1rem); }
	}
	.title { font-family: var(--font-display); font-stretch: var(--display-stretch); font-size: 1.625rem; font-weight: 800; line-height: 1.15; margin-top: .75rem; }
	.desc { margin-top: .5rem; white-space: pre-line; color: hsl(var(--muted-foreground)); }
	.gets { margin-top: .625rem; display: grid; gap: .5rem; }
	.gets li { display: flex; gap: .5rem; align-items: flex-start; }
	.gets :global(svg) { width: 1.125rem; height: 1.125rem; flex-shrink: 0; margin-top: .15rem; color: hsl(var(--success)); }
	.price { display: flex; align-items: baseline; flex-wrap: wrap; gap: .5rem; margin-top: .25rem; }
	.now { font-size: 2.25rem; font-weight: 700; letter-spacing: -0.02em; }
	.mrp { color: hsl(var(--muted-foreground)); }
	.bar-price { display: none; }
	.bar-price > .font-mono { font-size: 1.25rem; font-weight: 700; line-height: 1.1; }
	@media (max-width: 767px) { .bar-price { display: flex; flex-direction: column; flex: 0 1 auto; min-width: 0; } }
	@media (min-width: 768px) { .pay { width: 100%; } .actionbar.inline-desktop :global(.actionbar-inner > .btn) { flex: 1; } }
	.coupon-link { margin-top: .5rem; margin-left: -.5rem; }
	.coupon-form { display: flex; gap: .5rem; margin-top: .75rem; }
	.coupon-form .input { flex: 1; min-width: 0; text-transform: uppercase; }
	.coupon-on { display: flex; align-items: center; gap: .5rem; margin-top: .75rem; padding: .25rem .25rem .25rem .75rem; border-radius: var(--radius); background: hsl(var(--success) / .1); color: hsl(var(--foreground)); font-size: .875rem; }
	.coupon-on > :global(svg) { color: hsl(var(--success)); }
	.secure { display: flex; align-items: center; justify-content: center; gap: .375rem; margin-top: .75rem; }
	.done { text-align: center; max-width: 34rem; margin: 1rem auto; padding-block: 2.5rem; }
	.done-icon { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 999px; background: hsl(var(--success) / .12); color: hsl(var(--success)); }
	.done-icon :global(svg) { width: 32px; height: 32px; }
	.done h2 { margin-top: 1rem; }
	.done-actions { display: flex; flex-wrap: wrap; gap: .625rem; justify-content: center; margin-top: 1.5rem; }
</style>
