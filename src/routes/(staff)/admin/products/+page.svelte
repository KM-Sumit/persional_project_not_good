<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CircleAlert, PackagePlus, ShoppingBag, Trash2 } from '@lucide/svelte';
	import { Badge, EmptyState, PageHeader, Sheet, Switch, toast } from '#lib/components/ui';
	import { ConfirmSheet, DataTable, Picker } from '#lib/components/kit';
	import { inr, kindLabel, validityText, type ProductDTO, type ProductKind } from '#lib/features/billing/format';
	import type { SubmitFunction } from '$app/forms';

	let { data } = $props();
	type Row = ProductDTO;

	// ---------- editor ----------
	type Draft = {
		id: string;
		kind: ProductKind;
		target: string | null;
		title: string;
		description: string;
		priceInr: string;
		mrpInr: string;
		validity: 'days' | 'until' | 'life';
		validityDays: string;
		validUntil: string;
		active: boolean;
	};
	const blank = (): Draft => ({
		id: '',
		kind: 'exam_pass',
		target: null,
		title: '',
		description: '',
		priceInr: '',
		mrpInr: '',
		validity: 'days',
		validityDays: '365',
		validUntil: '',
		active: true
	});
	let open = $state(false);
	let saving = $state(false);
	let formError = $state('');
	let d = $state<Draft>(blank());

	function edit(p?: Row) {
		formError = '';
		d = p
			? {
					id: p.id,
					kind: p.kind,
					target: p.examId ?? p.courseId ?? p.testId,
					title: p.title,
					description: p.description,
					priceInr: String(p.priceInr),
					mrpInr: p.mrpInr ? String(p.mrpInr) : '',
					validity: p.validUntil ? 'until' : p.validityDays ? 'days' : 'life',
					validityDays: p.validityDays ? String(p.validityDays) : '365',
					validUntil: p.validUntil ? new Date(p.validUntil).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '',
					active: p.active
				}
			: blank();
		open = true;
	}

	// Rows link to ?edit=<id> (whole row is the tap target on phones); the sheet follows the URL.
	const editId = $derived(page.url.searchParams.get('edit'));
	$effect(() => {
		const row = editId ? data.products.find((x) => x.id === editId) : undefined;
		if (row && d.id !== row.id) edit(row);
	});
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !open && editId) goto('/admin/products', { replace: true, reset: false });
		wasOpen = open;
	});

	const targetOptions = $derived(
		d.kind === 'exam_pass' ? data.targets.exams : d.kind === 'course' ? data.targets.courses : data.targets.tests
	);
	const targetField = $derived(d.kind === 'exam_pass' ? 'examId' : d.kind === 'course' ? 'courseId' : 'testId');
	const targetLabel = $derived(d.kind === 'exam_pass' ? 'Exam' : d.kind === 'course' ? 'Course' : 'Test');

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

	// ---------- delete ----------
	let delOpen = $state(false);
	let delRow = $state<Row | null>(null);
	let delForm = $state<HTMLFormElement>();
</script>

<svelte:head><title>Products · UCI Staff</title></svelte:head>

<div class="page">
	<PageHeader title="Products" subtitle="Passes, courses and tests on sale" crumbs={[{ href: '/admin', label: 'Dashboard' }]}>
		{#snippet actions()}
			<button class="btn btn-primary" onclick={() => edit()}><PackagePlus /> New product</button>
		{/snippet}
	</PageHeader>

	{#if !data.enabled}
		<p class="alert alert-warning mb-4 flex items-start gap-2" role="status">
			<CircleAlert class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
			<span>Online payments are off until the Razorpay keys are set. Students see a "contact the institute" message; you can still grant access by hand from Payments.</span>
		</p>
	{/if}

	{#snippet name(r: Row)}
		<span class="block font-semibold truncate">{r.title}</span>
		<span class="hidden md:block tiny muted truncate">{kindLabel[r.kind]} · {r.targetName || 'Missing target'}</span>
	{/snippet}
	{#snippet price(r: Row)}
		<span class="font-mono tabular font-semibold">{inr(r.priceInr)}</span>
		{#if r.mrpInr}<s class="hidden md:block tiny muted font-mono tabular">{inr(r.mrpInr)}</s>{/if}
	{/snippet}
	{#snippet validity(r: Row)}<span class="small">{validityText(r)}</span>{/snippet}
	{#snippet sold(r: Row)}<span class="font-mono tabular">{r.sold}</span>{/snippet}
	{#snippet status(r: Row)}
		{#if r.active}<Badge tone="success">On sale</Badge>{:else}<Badge tone="draft">Off</Badge>{/if}
	{/snippet}
	{#snippet empty()}
		<EmptyState icon={ShoppingBag} title="Nothing on sale yet" body="Create an exam pass first: one price unlocks every paid test, course and note for that exam.">
			{#snippet action()}<button class="btn btn-primary" onclick={() => edit()}><PackagePlus /> New product</button>{/snippet}
		</EmptyState>
	{/snippet}

	<DataTable
		rows={data.products}
		getId={(r) => r.id}
		rowHref={(r) => `/admin/products?edit=${r.id}`}
		{empty}
		columns={[
			{ key: 'title', label: 'Product', cell: name },
			{ key: 'price', label: 'Price', cell: price, align: 'right' },
			{ key: 'validity', label: 'Validity', cell: validity },
			{ key: 'sold', label: 'Holders', cell: sold, align: 'right', hideOnPhone: true },
			{ key: 'status', label: 'Status', cell: status }
		]}
	/>
</div>

<Sheet bind:open title={d.id ? 'Edit product' : 'New product'} description="Price in whole rupees. Students pay through Razorpay.">
	<form id="product-form" method="POST" action="?/save" use:enhance={submitSave} class="grid gap-4">
		<input type="hidden" name="id" value={d.id} />
		<fieldset class="field">
			<legend class="label">What are you selling?</legend>
			<div class="segmented" role="radiogroup">
				{#each ['exam_pass', 'course', 'test'] as const as k (k)}
					<label><input type="radio" name="kind" value={k} bind:group={d.kind} onchange={() => (d.target = null)} />{kindLabel[k]}</label>
				{/each}
			</div>
		</fieldset>
		<div class="field">
			<span class="label" id="target-label">{targetLabel}</span>
			{#key d.kind}
				<Picker bind:value={d.target} name={targetField} options={targetOptions} placeholder="Choose {targetLabel.toLowerCase()}" label={targetLabel} searchable />
			{/key}
			{#if d.kind === 'exam_pass'}<p class="help">Unlocks every paid test, course and note tagged with this exam.</p>{/if}
		</div>
		<div class="field">
			<label class="label" for="p-title">Name <span class="muted">(optional)</span></label>
			<input class="input" id="p-title" name="title" bind:value={d.title} maxlength="160" placeholder="Left blank, it is named after the {targetLabel.toLowerCase()}" />
		</div>
		<div class="field">
			<label class="label" for="p-desc">What's included <span class="muted">(optional)</span></label>
			<textarea class="textarea" id="p-desc" name="description" rows="3" bind:value={d.description} maxlength="4000"></textarea>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="field">
				<label class="label" for="p-price">Price (₹)</label>
				<input class="input font-mono tabular" id="p-price" name="priceInr" inputmode="numeric" required bind:value={d.priceInr} placeholder="499" />
			</div>
			<div class="field">
				<label class="label" for="p-mrp">MRP (₹) <span class="muted">(optional)</span></label>
				<input class="input font-mono tabular" id="p-mrp" name="mrpInr" inputmode="numeric" bind:value={d.mrpInr} placeholder="999" />
			</div>
		</div>
		<fieldset class="field">
			<legend class="label">Validity</legend>
			<div class="segmented" role="radiogroup">
				<label><input type="radio" name="validity" value="days" bind:group={d.validity} />Days</label>
				<label><input type="radio" name="validity" value="until" bind:group={d.validity} />Until a date</label>
				<label><input type="radio" name="validity" value="life" bind:group={d.validity} />Lifetime</label>
			</div>
			{#if d.validity === 'days'}
				<input class="input font-mono tabular mt-2" name="validityDays" inputmode="numeric" bind:value={d.validityDays} aria-label="Days of access" />
				<p class="help">Counted from the day of purchase. Buying again adds the days on top.</p>
			{:else if d.validity === 'until'}
				<input class="input mt-2" type="date" name="validUntil" bind:value={d.validUntil} aria-label="Access ends on" />
				<p class="help">Everyone's access ends on this date, e.g. the exam date. Sales stop after it.</p>
			{/if}
		</fieldset>
		<Switch bind:checked={d.active} name="active" value="true" label="On sale" description="Off hides it from students; people who bought it keep access." />
		{#if formError}<p class="alert alert-danger" role="alert">{formError}</p>{/if}
	</form>
	{#if d.id}
		<div class="sheet-extra">
			<a class="btn btn-ghost btn-sm" href="/app/checkout?product={d.id}" target="_blank" rel="noopener">Preview checkout</a>
			<button class="btn btn-ghost btn-sm text-danger" type="button" onclick={() => { delRow = data.products.find((x) => x.id === d.id) ?? null; delOpen = true; }}><Trash2 /> Delete</button>
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn btn-secondary" type="button" onclick={() => (open = false)}>Cancel</button>
		<button class="btn btn-primary" form="product-form" disabled={saving}>{saving ? 'Saving…' : d.id ? 'Save product' : 'Create product'}</button>
	{/snippet}
</Sheet>

<form method="POST" action="?/delete" bind:this={delForm} hidden use:enhance={toasting}>
	<input type="hidden" name="id" value={delRow?.id ?? ''} />
</form>
<ConfirmSheet
	bind:open={delOpen}
	title="Delete {delRow?.title ?? 'product'}?"
	body="Only products nobody has paid for can be deleted. To stop selling, turn it off instead."
	confirmLabel="Delete product"
	danger
	onconfirm={() => { open = false; delForm?.requestSubmit(); }}
/>

<style>
	.sheet-extra { display: flex; justify-content: space-between; gap: .5rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid hsl(var(--border)); }
</style>
