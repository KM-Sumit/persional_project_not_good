<script lang="ts">
	import AskDoubtButton from '#lib/features/doubts/components/AskDoubtButton.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { ArrowLeft, ArrowRight, Check, FileText, ListVideo, Lock, VideoOff } from '@lucide/svelte';
	import OfferPanel from '#lib/features/billing/components/OfferPanel.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import { toast } from '#lib/components/ui';
	import YouTubePlayer from '#lib/components/kit/YouTubePlayer.svelte';
	import Markdown from '#lib/components/kit/Markdown.svelte';
	import Outline from '#lib/features/courses/components/Outline.svelte';
	import LessonKindIcon from '#lib/features/courses/components/LessonKindIcon.svelte';
	import { duration } from '#lib/features/courses/components/format';

	let { data } = $props();
	const l = $derived(data.lesson);
	const c = $derived(data.course);
	const done = $derived(!!data.lessonState?.completed);
	const chapterIndex = $derived(c.chapters.findIndex((ch) => ch.id === l.chapterId));
	const chapter = $derived(c.chapters[chapterIndex]);
	const demo = $derived(data.paywall.locked ? (c.chapters.flatMap((ch) => ch.lessons).find((x) => x.isPreview) ?? null) : null);
	let outlineOpen = $state(false);
	let marking = $state(false);

	// Progress: save every ~15 s of playback, on pause/end, and auto-complete at 90% watched.
	let lastSaved = { id: '', at: 0, done: false };
	async function save(fields: Record<string, string>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		await fetch('?/progress', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } }).catch(() => {});
	}
	function onprogress(sec: number, total: number) {
		const id = l.id;
		if (lastSaved.id !== id) lastSaved = { id, at: 0, done };
		const finish = !lastSaved.done && total > 0 && sec / total >= 0.9;
		if (!finish && Math.abs(sec - lastSaved.at) < 15) return;
		lastSaved.at = sec;
		if (finish) lastSaved.done = true;
		save({ positionSec: String(sec), ...(finish ? { completed: 'true' } : {}) }).then(() => {
			if (finish) invalidateAll();
		});
	}
	function onended() {
		if (lastSaved.id === l.id && lastSaved.done) return;
		lastSaved = { id: l.id, at: 0, done: true };
		save({ completed: 'true' }).then(() => {
			toast('Lesson complete');
			invalidateAll();
		});
	}
</script>

<svelte:head><title>{l.title} · {c.title} · UCI</title></svelte:head>

<div class="page pb-28 lg:pb-10">
	<PageHeader
		title={l.title}
		eyebrow="Chapter {chapterIndex + 1} · {chapter?.title ?? ''}"
		crumbs={[
			{ href: '/app/learn', label: 'Learn' },
			{ href: `/app/learn/${c.slug}`, label: c.title }
		]}
	/>

	<div class="player-grid">
		<div class="min-w-0 stack">
			{#key l.id}
				{#if data.locked}
					<div class="video locked-player" style={data.poster ? `--poster: url('${data.poster}')` : undefined}>
						<div class="lp-inner">
							<span class="lp-ic" aria-hidden="true"><Lock /></span>
							<span class="lp-label">Locked lesson</span>
							<span class="lp-title">{l.title}</span>
						</div>
					</div>
				{:else if l.kind === 'video'}
					{#if l.youtubeId}
						<div class="video"><YouTubePlayer videoId={l.youtubeId} start={done ? 0 : (data.lessonState?.positionSec ?? 0)} {onprogress} {onended} /></div>
					{:else}
						<div class="card card-pad unavailable">
							<VideoOff class="size-6" />
							<p class="font-semibold">Video not available yet</p>
							<p class="muted small">Your teacher has been told. The notes below still work.</p>
						</div>
					{/if}
				{:else if l.kind === 'pdf'}
					<div class="card card-pad flex items-center gap-3">
						<span class="leading-icon"><FileText /></span>
						<div class="grow min-w-0"><p class="font-semibold">Lesson PDF</p><p class="muted small">Opens in a new tab. The link works for a few minutes.</p></div>
						{#if l.fileId}<a class="btn btn-secondary" href="/api/files/{l.fileId}" target="_blank" rel="noopener">Open PDF</a>{/if}
					</div>
				{/if}
			{/key}

			{#if data.locked}
				<OfferPanel offer={data.paywall.offer} free={demo ? { href: `/app/learn/${c.slug}/${demo.id}`, label: 'Watch free demo', play: true } : null} />
			{/if}

			{#if !data.locked}<div class="lesson-meta">
				<span class="flex items-center gap-1.5"><LessonKindIcon kind={l.kind} />{l.kind === 'video' ? 'Video' : l.kind === 'pdf' ? 'PDF' : 'Reading'}{l.durationSec ? ` · ${duration(l.durationSec)}` : ''}</span>
				{#if done}<span class="badge badge-success"><Check class="size-3.5" />Done</span>{/if}
			</div>{/if}

			{#if data.html}
				<article class="card card-pad reading">
					{#if l.kind === 'video'}<h2 class="eyebrow mb-3">Lesson notes</h2>{/if}
					<Markdown html={data.html} />
				</article>
			{:else if l.kind === 'reading' && !data.locked}
				<p class="muted">This lesson has no text yet.</p>
			{/if}

			{#if !data.locked}
				<div class="flex items-center justify-between gap-3 card card-pad">
					<p class="small muted min-w-0">Stuck on something in this lesson?</p>
					<AskDoubtButton lessonId={l.id} />
				</div>
			{/if}

			{#if data.next && done && data.next.chapterId !== l.chapterId}
				<div class="card card-pad chapter-done">
					<p class="font-semibold">Chapter complete</p>
					<p class="muted small">Next up: {c.chapters.find((ch) => ch.id === data.next?.chapterId)?.title}</p>
				</div>
			{/if}

			<div class="actionbar inline-desktop">
				<div class="actionbar-inner">
					{#if data.prev}
						<a class="btn btn-ghost btn-fixed" href="/app/learn/{c.slug}/{data.prev.id}" aria-label="Previous lesson" data-sveltekit-replacestate><ArrowLeft /></a>
					{/if}
					<button type="button" class="btn btn-ghost btn-fixed lg:hidden" aria-label="All lessons" onclick={() => (outlineOpen = true)}><ListVideo /></button>
						{#if !data.locked}<form
						method="POST"
						action="?/progress"
						class="contents"
						use:enhance={() => {
							marking = true;
							return async ({ result, update }) => {
								marking = false;
								if (result.type === 'success') toast(done ? 'Marked as not done' : 'Lesson complete');
								await update();
							};
						}}
					>
						<input type="hidden" name="completed" value={done ? 'false' : 'true'} />
						<button class="btn btn-secondary" disabled={marking}>
							{#if done}Mark not done{:else}<Check />Mark complete{/if}
						</button>
					</form>{/if}
					{#if data.next}
						<a class="btn {data.locked ? 'btn-secondary' : 'btn-primary'}" href="/app/learn/{c.slug}/{data.next.id}" data-sveltekit-replacestate><span class="truncate">Next lesson</span><ArrowRight /></a>
					{:else}
						<a class="btn {data.locked ? 'btn-secondary' : 'btn-primary'}" href="/app/learn/{c.slug}">Course outline<ArrowRight /></a>
					{/if}
				</div>
			</div>
		</div>

		<aside class="side" aria-label="Course lessons">
			<div class="side-head">
				<p class="font-semibold truncate">{c.title}</p>
				<div class="flex items-center gap-2 mt-1.5">
					<div class="progress grow"><span style="width: {data.progress.percent}%"></span></div>
					<span class="tiny tabular muted">{data.progress.completed}/{data.progress.total}</span>
				</div>
			</div>
			<Outline slug={c.slug} chapters={c.chapters} state={data.state} current={l.id} locked={data.paywall.locked} />
		</aside>
	</div>
</div>

<Sheet bind:open={outlineOpen} title="Lessons" description="{data.progress.completed} of {data.progress.total} done">
	<Outline slug={c.slug} chapters={c.chapters} state={data.state} current={l.id} locked={data.paywall.locked} />
</Sheet>

<style>
	.player-grid {
		display: grid;
		gap: 1.5rem;
	}
	.side {
		display: none;
	}
	@media (min-width: 1024px) {
		.player-grid {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
		.side {
			display: block;
			position: sticky;
			top: calc(var(--appbar-h) + 1rem);
			max-height: calc(100dvh - var(--appbar-h) - 2rem);
			overflow-y: auto;
			overscroll-behavior: contain;
			scrollbar-width: thin;
		}
	}
	.side-head {
		padding: 0 0.25rem 1rem;
	}
	.video {
		border-radius: var(--radius);
		overflow: hidden;
		background: hsl(var(--foreground));
	}
	@media (max-width: 639px) {
		.video {
			margin-inline: calc(-1 * var(--gutter));
			border-radius: 0;
		}
	}
	.locked-player {
		aspect-ratio: 16 / 9;
		position: relative;
		display: grid;
		place-items: center;
		background: hsl(222 22% 10%); /* letterbox: dark in both themes, like the player it replaces */
		isolation: isolate;
	}
	.locked-player::before {
		content: '';
		position: absolute;
		inset: -12px;
		z-index: -1;
		background: var(--poster, none) center / cover no-repeat;
		filter: blur(10px) brightness(0.45);
	}
	.lp-inner {
		display: grid;
		justify-items: center;
		gap: 0.375rem;
		padding: 1rem;
		text-align: center;
		color: white;
	}
	.lp-ic {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.16);
		border: 1px solid rgb(255 255 255 / 0.3);
		margin-bottom: 0.25rem;
	}
	.lp-ic :global(svg) {
		width: 20px;
		height: 20px;
	}
	.lp-label {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.lp-title {
		font-weight: 650;
		font-size: 1rem;
		line-height: 1.3;
		max-width: 32ch;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.unavailable {
		aspect-ratio: 16 / 9;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.375rem;
		text-align: center;
	}
	.lesson-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.reading {
		padding: clamp(1.125rem, 0.8rem + 1.5vw, 2rem);
	}
	.chapter-done {
		border-left: 4px solid hsl(var(--success));
	}
</style>
