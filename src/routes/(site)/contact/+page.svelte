<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { CheckCircle2, Mail, MapPin, MessageCircle, Navigation, Phone } from '@lucide/svelte';
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import { orgJsonLd, real, waLink } from '#lib/features/site/components/format';

	let { data, form } = $props();
	const st = $derived(data.site.settings);
	const crumbs = [{ href: '/', label: 'Home' }];
	const address = $derived(real(st.address));
	const map = $derived(st.mapUrl ?? (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null));
	const wa = $derived(waLink(st.whatsappNumber, 'Hello, I want to know about admission at UCI.'));
	const prefill = page.url.searchParams.get('exam') ?? '';
	let busy = $state(false);
	const v = $derived(form && 'values' in form ? form.values : null);
	const done = $derived(form && 'ok' in form && form.ok ? form : null);
	const exams = $derived([...data.categories, 'Not sure yet']);
</script>

<Seo
	title="Contact and admissions"
	description="Enquire about admission at Upendra Competition Institute: call, WhatsApp, visit, or request a call back."
	crumbs={[...crumbs, { href: '/contact', label: 'Contact' }]}
	jsonld={[orgJsonLd(st, page.url.origin)]}
/>

<div class="page site-page">
	<PageHeader title="Contact and admissions" subtitle="Ask about batches, fees and timings. We call you back." {crumbs} />

	{#if st.contactPhone || wa || map}
		<div class="quick">
			{#if st.contactPhone}<a href="tel:{st.contactPhone}" class="btn btn-secondary btn-lg"><Phone />Call</a>{/if}
			{#if wa}<a href={wa} class="btn btn-secondary btn-lg" target="_blank" rel="noopener"><MessageCircle />WhatsApp</a>{/if}
			{#if map}<a href={map} class="btn btn-secondary btn-lg" target="_blank" rel="noopener"><Navigation />Directions</a>{/if}
		</div>
	{/if}

	<div class="layout">
		<div class="card card-pad">
			{#if done}
				<div class="done" role="status">
					<CheckCircle2 />
					<h2>Thank you, {done.name}</h2>
					<p>We have your enquiry and will call you back during office hours.</p>
					{#if st.whatsappNumber}
						<a href={waLink(st.whatsappNumber, `Hello, I sent an enquiry on the UCI website${done.examInterest ? ` for ${done.examInterest}` : ''}.`)} class="btn btn-primary" target="_blank" rel="noopener"><MessageCircle />Message us on WhatsApp</a>
					{/if}
				</div>
			{:else}
				<h2 class="form-title">Request a call back</h2>
				<form
					method="POST"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							await update({ reset: false });
							busy = false;
						};
					}}
				>
					<div class="field">
						<label class="label" for="name">Your name</label>
						<input id="name" name="name" autocomplete="name" required minlength="2" maxlength="80" value={v?.name ?? ''} />
					</div>
					<div class="field">
						<label class="label" for="phone">Mobile number</label>
						<div class="phone">
							<span class="font-mono">+91</span>
							<input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" required maxlength="14" placeholder="98XXXXXXXX" value={v?.phone ?? ''} />
						</div>
					</div>
					<fieldset class="field">
						<legend class="label">Exam you are preparing for</legend>
						<div class="opts">
							{#each exams as e (e)}
								<label class="opt"><input type="radio" name="examInterest" value={e} checked={v?.examInterest === e} /><span>{e}</span></label>
							{/each}
						</div>
					</fieldset>
					<fieldset class="field">
						<legend class="label">How do you want to study?</legend>
						<div class="opts">
							{#each ['Classroom', 'Online', 'Both'] as m (m)}
								<label class="opt"><input type="radio" name="mode" value={m} /><span>{m}</span></label>
							{/each}
						</div>
					</fieldset>
					<div class="field">
						<label class="label" for="message">Message <span class="opt-l">optional</span></label>
						<textarea id="message" name="message" rows="3" maxlength="1000">{v?.message ?? (prefill ? `Please tell me when tests for ${prefill} are available.` : '')}</textarea>
					</div>
					<input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
					{#if form && 'error' in form}<p class="err" role="alert">{form.error}</p>{/if}
					<button class="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Sending…' : 'Request a call back'}</button>
					<p class="tiny muted mt-2">We use your number only to reply to this enquiry. See the <a href="/legal/privacy" class="underline">privacy policy</a>.</p>
				</form>
			{/if}
		</div>

		<aside class="info">
			<h2 class="info-h">Visit the institute</h2>
			{#if address}<p class="row"><MapPin />{address}</p>{/if}
			{#if st.contactPhone}<p class="row"><Phone /><a href="tel:{st.contactPhone}">{st.contactPhone}</a></p>{/if}
			{#if st.email}<p class="row"><Mail /><a href="mailto:{st.email}">{st.email}</a></p>{/if}
			{#if map}<a href={map} class="btn btn-secondary" target="_blank" rel="noopener"><Navigation />Open in Google Maps</a>{/if}
			{#if !address && !st.contactPhone && !st.email}<p class="muted small">Address and phone will appear here. Meanwhile, send the form and we will call you.</p>{/if}
		</aside>
	</div>
</div>

<style>
	.site-page {
		padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem);
	}
	.quick {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		max-width: 36rem;
	}
	.layout {
		display: grid;
		gap: 1.5rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
			gap: 2.5rem;
			align-items: start;
		}
	}
	.form-title,
	.info-h {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 1rem 0 0;
		min-width: 0;
	}
	.phone {
		display: flex;
		align-items: stretch;
	}
	.phone span {
		display: grid;
		place-items: center;
		padding: 0 0.75rem;
		border: 1px solid hsl(var(--input));
		border-right: 0;
		border-radius: 12px 0 0 12px;
		background: hsl(var(--muted));
		font-size: 0.9375rem;
	}
	.phone input {
		border-top-left-radius: 0 !important;
		border-bottom-left-radius: 0 !important;
		flex: 1;
		min-width: 0;
	}
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.opt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.opt span {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 1rem;
		border-radius: 999px;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--surface));
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
	}
	.opt input:checked + span {
		background: hsl(var(--foreground));
		color: hsl(var(--background));
		border-color: transparent;
	}
	.opt input:focus-visible + span {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	.opt-l {
		font-weight: 400;
		color: hsl(var(--muted-foreground));
	}
	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
	}
	.err {
		margin: 1rem 0 0;
		color: hsl(var(--danger));
		font-size: 0.875rem;
		font-weight: 500;
	}
	form > .err + button,
	form > .hp + button {
		margin-top: 1.25rem;
	}
	.done {
		display: grid;
		justify-items: start;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}
	.done > :global(svg) {
		width: 36px;
		height: 36px;
		color: hsl(var(--success));
	}
	.done h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.5rem;
	}
	.done .btn {
		margin-top: 0.75rem;
	}
	.info {
		display: grid;
		gap: 0.75rem;
		align-content: start;
	}
	.row {
		display: flex;
		gap: 0.625rem;
		align-items: flex-start;
		line-height: 1.5;
	}
	.row :global(svg) {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		margin-top: 3px;
		color: hsl(var(--primary));
	}
	.info > .btn {
		justify-self: start;
	}
</style>
