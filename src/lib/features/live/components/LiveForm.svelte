<script lang="ts">
	// Schedule / edit a live class. Posts to `action` with use:enhance; `ondone` runs after success.
	import { enhance } from '$app/forms';
	import { Switch, toast } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import DateTimePicker from '#lib/components/kit/DateTimePicker.svelte';
	import type { LiveClassDTO } from '../schema';

	type Opt = { value: string; label: string; group?: string };
	interface Props {
		action: string;
		options: { exams: Opt[]; batches: Opt[]; courses: Opt[] };
		initial?: LiveClassDTO | null;
		submitLabel: string;
		ondone?: () => void;
	}
	let { action, options, initial = null, submitLabel, ondone }: Props = $props();

	const DURATIONS = [30, 45, 60, 90, 120, 150, 180].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} h`.replace('.5 h', ' h 30 min') }));

	// Seeded once from `initial`; the form owns the values after that.
	const seed = () => initial;
	let startsAt = $state<string | null>(seed()?.startsAt ?? null);
	let durationMin = $state<string | null>(String(seed()?.durationMin ?? 60));
	let examId = $state<string | null>(seed()?.examId ?? null);
	let batchId = $state<string | null>(seed()?.batchId ?? null);
	let courseId = $state<string | null>(seed()?.courseId ?? null);
	let isPaid = $state(seed()?.isPaid ?? false);
	let busy = $state(false);
	const uid = $props.id();
	const minStart = new Date(Date.now() - 6 * 3600_000).toISOString();
</script>

<form
	method="POST"
	{action}
	class="stack"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Check the form.'), 'error');
			else if (result.type === 'error') toast(result.error?.message ?? 'Something went wrong.', 'error');
			else if (result.type === 'success' && result.data?.message) toast(String(result.data.message));
			await update({ reset: false });
			if (result.type === 'success') ondone?.();
		};
	}}
>
	<div class="field">
		<label class="label" for="{uid}-title">Title</label>
		<input id="{uid}-title" class="input" name="title" required minlength="3" maxlength="160" value={initial?.title ?? ''} placeholder="Reasoning: blood relations" />
	</div>
	<div class="field">
		<span class="label">Starts (IST)</span>
		<DateTimePicker bind:value={startsAt} name="startsAt" min={minStart} label="Start time" />
	</div>
	<div class="form-row">
		<div class="field">
			<span class="label">Duration</span>
			<Picker bind:value={durationMin} name="durationMin" options={DURATIONS} label="Duration" />
		</div>
		<div class="field">
			<label class="label" for="{uid}-teacher">Teacher</label>
			<input id="{uid}-teacher" class="input" name="teacher" maxlength="80" value={initial?.teacher ?? ''} placeholder="UCI Faculty" />
		</div>
	</div>
	<div class="form-row">
		<div class="field">
			<span class="label">Batch</span>
			<Picker bind:value={batchId} name="batchId" options={options.batches} placeholder="Everyone" label="Batch" searchable />
		</div>
		<div class="field">
			<span class="label">Exam</span>
			<Picker bind:value={examId} name="examId" options={options.exams} placeholder="Any exam" label="Exam" searchable />
		</div>
	</div>
	<div class="field">
		<span class="label">Course</span>
		<Picker bind:value={courseId} name="courseId" options={options.courses} placeholder="Not part of a course" label="Course" searchable />
	</div>
	<div class="field">
		<label class="label" for="{uid}-desc">What will be covered (optional)</label>
		<textarea id="{uid}-desc" class="input" name="description" rows="3" maxlength="2000">{initial?.description ?? ''}</textarea>
	</div>
	<Switch bind:checked={isPaid} name="isPaid" label="Paid class" description="Only students with this course or the exam pass can watch." />
	<button class="btn btn-primary btn-block" disabled={busy || !startsAt}>{submitLabel}</button>
</form>
