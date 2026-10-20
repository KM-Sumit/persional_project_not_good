<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleStop, Radio, RotateCcw, Trash2, Video, XCircle } from '@lucide/svelte';
	import { Badge, PageHeader, Sheet, Switch } from '#lib/components/ui';
	import Picker from '#lib/components/kit/Picker.svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import YouTubePlayer from '#lib/components/kit/YouTubePlayer.svelte';
	import LiveForm from '#lib/features/live/components/LiveForm.svelte';
	import { dayLabel, istTime } from '#lib/features/live/format';
	import { toasting } from '../../students/_enhance';

	let { data } = $props();
	const c = $derived(data.live);
	const now = $derived(Date.parse(data.serverNow));

	let ending = $state(false);
	let saveAsLesson = $state(true);
	let chapterId = $state<string | null>(null);
	let confirmCancel = $state(false);
	let confirmDelete = $state(false);
	let cancelForm = $state<HTMLFormElement>();
	let deleteForm = $state<HTMLFormElement>();

	// Chapters of the class's course first, so the usual choice is at the top.
	const chapters = $derived(
		[...data.options.chapters].sort((a, b) => Number(b.courseId === c.courseId) - Number(a.courseId === c.courseId))
	);
	const STATUS = { scheduled: 'Scheduled', live: 'Live now', ended: 'Ended', cancelled: 'Cancelled' } as const;
	const TONE = { scheduled: 'default', live: 'live', ended: 'closed', cancelled: 'danger' } as const;
</script>

<svelte:head><title>{c.title} · Live classes · UCI Admin</title></svelte:head>

<div class="page">
	<PageHeader title={c.title} eyebrow="{dayLabel(c.startsAt, now)}, {istTime(c.startsAt)} IST · {c.durationMin} min" crumbs={[{ href: '/admin/live', label: 'Live classes' }]}>
		{#snippet actions()}<Badge tone={TONE[c.status]}>{STATUS[c.status]}</Badge>{/snippet}
	</PageHeader>

	<div class="grid-2">
		<div class="stack min-w-0">
			{#if c.youtubeId}
				<div class="rise"><YouTubePlayer videoId={c.youtubeId} /></div>
			{/if}

			<section class="card card-pad stack rise" style="--i: 1" aria-labelledby="ctl-h">
				<h2 id="ctl-h" class="section-title">
					{c.status === 'scheduled' ? 'Go live' : c.status === 'live' ? 'You are live' : c.status === 'ended' ? 'Class ended' : 'Class cancelled'}
				</h2>
				{#if c.status === 'scheduled' || c.status === 'live'}
					<p class="muted small">
						{c.status === 'scheduled'
							? 'Start the stream in YouTube Studio, then paste its link here. Students can join as soon as you go live.'
							: 'Stream restarted? Paste the new link to switch everyone to it.'}
					</p>
					<form method="POST" action="?/goLive" class="go" use:enhance={toasting(undefined, { reset: false })}>
						<label class="sr-only" for="stream">YouTube Live link</label>
						<input id="stream" class="input" name="stream" required placeholder="https://youtube.com/live/…" value={c.youtubeId ? `https://youtube.com/live/${c.youtubeId}` : ''} />
						<button class="btn {c.status === 'live' ? 'btn-secondary' : 'btn-primary'}"><Radio />{c.status === 'live' ? 'Update link' : 'Go live'}</button>
					</form>
				{/if}
				{#if c.status === 'live'}
					<div class="row-actions">
						<button class="btn btn-ink" onclick={() => (ending = true)}><CircleStop /> End class</button>
						<form method="POST" action="?/unlive" use:enhance={toasting()}><button class="btn btn-ghost"><RotateCcw /> Back to scheduled</button></form>
					</div>
				{:else if c.status === 'scheduled'}
					<div class="row-actions">
						<button class="btn btn-ghost" onclick={() => (confirmCancel = true)}><XCircle /> Cancel class</button>
					</div>
				{:else if c.status === 'ended'}
					<p class="muted small">
						{#if c.lessonId}The recording was saved as a lesson. Students find it in the course and under Recordings on their Live tab.
						{:else if c.youtubeId}Students can watch the recording under Recordings on their Live tab.
						{:else}No recording link was added for this class.{/if}
					</p>
				{:else}
					<p class="muted small">Students see it as cancelled on its day. Reschedule to bring it back.</p>
					<form method="POST" action="?/unlive" use:enhance={toasting()}><button class="btn btn-secondary"><RotateCcw /> Reschedule</button></form>
				{/if}
			</section>

			<section class="danger rise" style="--i: 2">
				<button class="btn btn-ghost btn-sm text-danger" onclick={() => (confirmDelete = true)}><Trash2 /> Delete class</button>
			</section>
		</div>

		<section class="card card-pad rise" style="--i: 1" aria-labelledby="edit-h">
			<h2 id="edit-h" class="section-title mb-3">Details</h2>
			{#if c.status === 'ended'}
				<dl class="facts small">
					<dt>Teacher</dt><dd>{c.teacher}</dd>
					<dt>For</dt><dd>{data.options.batches.find((b) => b.value === c.batchId)?.label ?? 'Everyone'}</dd>
					<dt>Course</dt><dd>{data.options.courses.find((o) => o.value === c.courseId)?.label ?? 'None'}</dd>
					<dt>Access</dt><dd>{c.isPaid ? 'Paid' : 'Free'}</dd>
				</dl>
			{:else}
				{#key c.id}<LiveForm action="?/update" options={data.options} initial={c} submitLabel="Save changes" />{/key}
			{/if}
		</section>
	</div>
</div>

<Sheet bind:open={ending} title="End class" description="Students are told the class is over.">
	<form method="POST" action="?/end" class="stack" use:enhance={toasting(() => (ending = false))}>
		<Switch bind:checked={saveAsLesson} name="saveAsLesson" label="Save recording as a lesson" description="Adds a video lesson with this stream to a course chapter." />
		{#if saveAsLesson}
			{#if chapters.length}
				<div class="field">
					<span class="label">Chapter</span>
					<Picker bind:value={chapterId} name="chapterId" options={chapters} placeholder="Choose chapter" label="Chapter" searchable />
				</div>
				<div class="field">
					<label class="label" for="lesson-title">Lesson title</label>
					<input id="lesson-title" class="input" name="lessonTitle" maxlength="160" value={c.title} />
				</div>
			{:else}
				<p class="muted small">No course chapters yet. Add a chapter to a course first, or end without saving.</p>
			{/if}
		{/if}
		<button class="btn btn-primary btn-block" disabled={saveAsLesson && !chapterId}><Video />{saveAsLesson ? 'End and save lesson' : 'End class'}</button>
	</form>
</Sheet>

<form method="POST" action="?/cancel" bind:this={cancelForm} use:enhance={toasting()} hidden></form>
<form method="POST" action="?/delete" bind:this={deleteForm} use:enhance={toasting()} hidden></form>
<ConfirmSheet bind:open={confirmCancel} title="Cancel this class?" body="Students see it as cancelled. You can reschedule it later." confirmLabel="Cancel class" danger onconfirm={() => cancelForm?.requestSubmit()} />
<ConfirmSheet bind:open={confirmDelete} title="Delete this class?" body="It disappears from every timetable. A saved lesson stays in its course." confirmLabel="Delete class" danger onconfirm={() => deleteForm?.requestSubmit()} />

<style>
	.grid-2 { display: grid; gap: 1rem; }
	@media (min-width: 1024px) { .grid-2 { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; } }
	.go { display: flex; gap: .5rem; flex-wrap: wrap; }
	.go .input { flex: 1 1 14rem; min-width: 0; }
	.row-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
	.facts { display: grid; grid-template-columns: auto 1fr; gap: .5rem 1rem; }
	.facts dt { color: hsl(var(--muted-foreground)); }
</style>
