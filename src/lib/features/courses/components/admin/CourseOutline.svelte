<script lang="ts">
	// Outline builder: chapters with lessons. Reorder with the arrow buttons (everywhere) or by dragging
	// the grip (mouse). Add one lesson inline, or paste many YouTube links at once.
	import { enhance } from '$app/forms';
	import {
		ArrowDown,
		ArrowUp,
		ArrowUpDown,
		ChevronRight,
		BookOpenText,
		Eye,
		EyeOff,
		FileText,
		GripVertical,
		ListPlus,
		Pencil,
		Plus,
		PlaySquare,
		Trash2
	} from '@lucide/svelte';
	import ConfirmSheet from '#lib/components/kit/ConfirmSheet.svelte';
	import type { ChapterDTO, CourseOutline, LessonDTO } from '#lib/features/courses/schema';
	import LessonForm from './LessonForm.svelte';
	import { postAction, withToast } from './submit';

	let { course }: { course: CourseOutline } = $props();

	// Local copy so drags move instantly; reloads (invalidateAll) replace it with the saved order.
	let chapters = $derived(course.chapters);
	let panel = $state<{ chapterId: string; mode: 'lesson' | 'bulk' } | null>(null);
	let addKind = $state<'video' | 'reading'>('video');
	let renaming = $state<string | null>(null);
	let confirm = $state<{ title: string; body: string; label: string; run: () => Promise<boolean> } | null>(null);
	let confirmOpen = $state(false);
	let saving = $state(false);
	/** Phones: arrows only while reordering; otherwise each lesson is one full-row link. */
	let reorder = $state(false);

	const fmt = (s: number) => (s ? `${Math.round(s / 60)} min` : '');
	const kindIcon = { video: PlaySquare, reading: BookOpenText, pdf: FileText };
	const kindLabel = { video: 'Video', reading: 'Reading', pdf: 'PDF' };

	async function save(action: string, fields: Record<string, string>) {
		saving = true;
		try {
			return await postAction(action, fields);
		} finally {
			saving = false;
		}
	}
	const saveChapters = (list: ChapterDTO[]) => save('?/reorderChapters', { ids: JSON.stringify(list.map((c) => c.id)) });
	const saveLessons = (ch: ChapterDTO) => save('?/reorderLessons', { chapterId: ch.id, ids: JSON.stringify(ch.lessons.map((l) => l.id)) });

	function swap<T>(list: T[], i: number, j: number): T[] {
		const next = [...list];
		[next[i], next[j]] = [next[j]!, next[i]!];
		return next;
	}
	function moveChapter(i: number, d: -1 | 1) {
		chapters = swap(chapters, i, i + d);
		saveChapters(chapters);
	}
	function moveLesson(ci: number, li: number, d: -1 | 1) {
		const ch = { ...chapters[ci]!, lessons: swap(chapters[ci]!.lessons, li, li + d) };
		chapters = chapters.map((c, k) => (k === ci ? ch : c));
		saveLessons(ch);
	}

	// ---- drag (mouse only; touch uses the arrows) ----
	let drag = $state<{ type: 'chapter' | 'lesson'; id: string; before: string } | null>(null);
	const order = () => JSON.stringify(chapters.map((c) => [c.id, c.lessons.map((l) => l.id)]));

	function start(e: DragEvent, type: 'chapter' | 'lesson', id: string) {
		drag = { type, id, before: order() };
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function overChapter(e: DragEvent, target: ChapterDTO) {
		if (!drag) return;
		e.preventDefault();
		if (drag.type === 'chapter') {
			if (drag.id === target.id) return;
			const from = chapters.findIndex((c) => c.id === drag!.id);
			const to = chapters.findIndex((c) => c.id === target.id);
			const next = [...chapters];
			next.splice(to, 0, next.splice(from, 1)[0]!);
			chapters = next;
		} else if (!target.lessons.length) placeLesson(target.id, 0);
	}
	function overLesson(e: DragEvent, target: LessonDTO) {
		if (drag?.type !== 'lesson') return;
		e.preventDefault();
		e.stopPropagation();
		if (drag.id === target.id) return;
		const ch = chapters.find((c) => c.id === target.chapterId)!;
		placeLesson(ch.id, ch.lessons.findIndex((l) => l.id === target.id));
	}
	function placeLesson(chapterId: string, index: number) {
		const moving = chapters.flatMap((c) => c.lessons).find((l) => l.id === drag!.id);
		if (!moving) return;
		chapters = chapters.map((c) => {
			const rest = c.lessons.filter((l) => l.id !== moving.id);
			if (c.id !== chapterId) return rest.length === c.lessons.length ? c : { ...c, lessons: rest };
			rest.splice(index, 0, { ...moving, chapterId });
			return { ...c, lessons: rest };
		});
	}
	async function end() {
		const d = drag;
		drag = null;
		if (!d || d.before === order()) return;
		if (d.type === 'chapter') await saveChapters(chapters);
		else await saveLessons(chapters.find((c) => c.lessons.some((l) => l.id === d.id))!);
	}

	function ask(title: string, body: string, label: string, run: () => Promise<boolean>) {
		confirm = { title, body, label, run };
		confirmOpen = true;
	}
	const toggle = (chapterId: string, mode: 'lesson' | 'bulk') =>
		(panel = panel?.chapterId === chapterId && panel.mode === mode ? null : { chapterId, mode });
	function openAdd(chapterId: string, kind: 'video' | 'reading') {
		if (panel?.chapterId === chapterId && panel.mode === 'lesson' && addKind === kind) {
			panel = null;
			return;
		}
		addKind = kind;
		panel = { chapterId, mode: 'lesson' };
	}
</script>

{#snippet bulkForm(chapterId: string)}
	<form method="POST" action="?/bulkAdd" class="stack-sm" use:enhance={withToast('Lessons added', () => (panel = null))}>
		<input type="hidden" name="chapterId" value={chapterId} />
		<label class="label" for="bulk-{chapterId || 'new'}">YouTube links, one per line</label>
		<textarea
			id="bulk-{chapterId || 'new'}"
			name="links"
			class="input textarea font-mono text-sm"
			rows="6"
			required
			placeholder={'https://youtu.be/abc123def45\nPercentages part 2 | https://www.youtube.com/watch?v=…'}
		></textarea>
		<p class="help">Titles come from YouTube. To set your own, write <span class="font-mono">Title | link</span>.</p>
		<button class="btn btn-primary"><ListPlus aria-hidden="true" />Add lessons</button>
	</form>
{/snippet}

{#if !chapters.length}
	<div class="card card-pad stack rise">
		<div>
			<h2 class="section-title">Add the first lessons</h2>
			<p class="text-sm text-muted-foreground">Paste YouTube links. They go into a chapter called “Course content” that you can rename.</p>
		</div>
		{@render bulkForm('')}
	</div>
{/if}

{#if chapters.length}
	<div class="reorder-bar">
		<button type="button" class="btn btn-secondary btn-sm" aria-pressed={reorder} onclick={() => (reorder = !reorder)}>
			<ArrowUpDown aria-hidden="true" />{reorder ? 'Done' : 'Reorder'}
		</button>
	</div>
{/if}

<ol class="stack" class:is-reorder={reorder} aria-label="Chapters" aria-busy={saving}>
	{#each chapters as ch, ci (ch.id)}
		<li
			class="card chapter"
			class:is-dragging={drag?.id === ch.id}
			ondragover={(e) => overChapter(e, ch)}
			ondrop={(e) => e.preventDefault()}
		>
			<header class="chapter-head">
				<span class="grip fine-only" draggable="true" ondragstart={(e) => start(e, 'chapter', ch.id)} ondragend={end} role="button" tabindex="-1" aria-label="Drag to reorder chapter">
					<GripVertical aria-hidden="true" />
				</span>
				{#if renaming === ch.id}
					<form method="POST" action="?/renameChapter" class="rename" use:enhance={withToast('Chapter renamed', () => (renaming = null))}>
						<input type="hidden" name="chapterId" value={ch.id} />
						<input class="input" name="title" value={ch.title} required maxlength="200" aria-label="Chapter title" />
						<button class="btn btn-primary btn-sm">Save</button>
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => (renaming = null)}>Cancel</button>
					</form>
				{:else}
					<div class="min-w-0 flex-1">
						<p class="eyebrow">Chapter {ci + 1} · {ch.lessons.length} lesson{ch.lessons.length === 1 ? '' : 's'}</p>
						<h3 class="truncate font-semibold">{ch.title}</h3>
					</div>
					<div class="row-actions">
						<span class="arrows">
							<button type="button" class="icon-btn icon-btn-sm" disabled={ci === 0 || saving} onclick={() => moveChapter(ci, -1)} aria-label="Move chapter up"><ArrowUp /></button>
							<button type="button" class="icon-btn icon-btn-sm" disabled={ci === chapters.length - 1 || saving} onclick={() => moveChapter(ci, 1)} aria-label="Move chapter down"><ArrowDown /></button>
						</span>
						<button type="button" class="icon-btn icon-btn-sm" onclick={() => (renaming = ch.id)} aria-label="Rename chapter"><Pencil /></button>
						<button
							type="button"
							class="icon-btn icon-btn-sm"
							aria-label="Delete chapter"
							onclick={() =>
								ask(`Delete “${ch.title}”?`, ch.lessons.length ? `Its ${ch.lessons.length} lesson(s) and students' progress on them are deleted too.` : 'The chapter is empty.', 'Delete chapter', () =>
									save('?/deleteChapter', { chapterId: ch.id })
								)}><Trash2 /></button
						>
					</div>
				{/if}
			</header>

			<ol class="lessons" aria-label="Lessons in {ch.title}">
				{#each ch.lessons as l, li (l.id)}
					{@const Icon = kindIcon[l.kind]}
					<li class="lesson" class:is-dragging={drag?.id === l.id} draggable="false" ondragover={(e) => overLesson(e, l)}>
						<span class="grip fine-only" draggable="true" ondragstart={(e) => start(e, 'lesson', l.id)} ondragend={end} role="button" tabindex="-1" aria-label="Drag to reorder lesson">
							<GripVertical aria-hidden="true" />
						</span>
						<a href="/admin/courses/{course.id}/lessons/{l.id}" class="lesson-main">
							<span class="thumb">
								{#if l.youtubeId}<img src="https://i.ytimg.com/vi/{l.youtubeId}/mqdefault.jpg" alt="" loading="lazy" />{:else}<Icon aria-hidden="true" />{/if}
							</span>
							<span class="min-w-0">
								<span class="line-clamp-2 text-sm font-semibold">{l.title}</span>
								<span class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
									<span>{kindLabel[l.kind]}</span>
									{#if l.durationSec}<span class="font-mono tabular">{fmt(l.durationSec)}</span>{/if}
									{#if l.isPreview}<span class="badge badge-primary">Free preview</span>{/if}
									{#if (l.kind === 'video' && !l.youtubeId) || (l.kind === 'pdf' && !l.fileId) || (l.kind === 'reading' && !l.body.trim())}<span class="badge badge-warning">Incomplete</span>{/if}
								</span>
							</span>
						</a>
						<ChevronRight class="chev" aria-hidden="true" />
						<div class="row-actions">
							<span class="arrows">
								<button type="button" class="icon-btn icon-btn-sm" disabled={li === 0 || saving} onclick={() => moveLesson(ci, li, -1)} aria-label="Move lesson up"><ArrowUp /></button>
								<button type="button" class="icon-btn icon-btn-sm" disabled={li === ch.lessons.length - 1 || saving} onclick={() => moveLesson(ci, li, 1)} aria-label="Move lesson down"><ArrowDown /></button>
							</span>
							<form method="POST" action="?/togglePreview" class="contents desk-only" use:enhance={withToast(null)}>
								<input type="hidden" name="lessonId" value={l.id} />
								<input type="hidden" name="on" value={String(!l.isPreview)} />
								<button class="icon-btn icon-btn-sm" aria-pressed={l.isPreview} aria-label={l.isPreview ? 'Turn off free preview' : 'Make free preview'} title={l.isPreview ? 'Free preview: on' : 'Free preview: off'}>
									{#if l.isPreview}<Eye />{:else}<EyeOff />{/if}
								</button>
							</form>
							<button
								type="button"
								class="icon-btn icon-btn-sm desk-only"
								aria-label="Delete lesson"
								onclick={() => ask(`Delete “${l.title}”?`, "Students' progress on this lesson is deleted too.", 'Delete lesson', () => save('?/deleteLesson', { lessonId: l.id }))}
								><Trash2 /></button
							>
						</div>
					</li>
				{:else}
					<li class="py-3 text-sm text-muted-foreground">No lessons yet.</li>
				{/each}
			</ol>

			{#if panel?.chapterId === ch.id}
				<div class="panel">
					{#if panel.mode === 'lesson'}
						{#key addKind}
							<LessonForm compact action="?/addLesson" chapterId={ch.id} initialKind={addKind} submitLabel={addKind === 'video' ? 'Add video' : 'Add notes'}>
								<button type="button" class="btn btn-ghost" onclick={() => (panel = null)}>Cancel</button>
							</LessonForm>
						{/key}
					{:else}
						{@render bulkForm(ch.id)}
					{/if}
				</div>
			{/if}
			<div class="chapter-foot">
				<button type="button" class="btn btn-secondary btn-sm" aria-expanded={panel?.chapterId === ch.id && panel.mode === 'lesson' && addKind === 'video'} onclick={() => openAdd(ch.id, 'video')}><PlaySquare aria-hidden="true" />Add video</button>
				<button type="button" class="btn btn-secondary btn-sm" aria-expanded={panel?.chapterId === ch.id && panel.mode === 'lesson' && addKind === 'reading'} onclick={() => openAdd(ch.id, 'reading')}><BookOpenText aria-hidden="true" />Add notes</button>
				<button type="button" class="btn btn-ghost btn-sm" aria-expanded={panel?.chapterId === ch.id && panel.mode === 'bulk'} onclick={() => toggle(ch.id, 'bulk')}><ListPlus aria-hidden="true" />Paste many links</button>
			</div>
		</li>
	{/each}
</ol>

<form method="POST" action="?/addChapter" class="add-chapter" use:enhance={withToast('Chapter added')}>
	<input class="input" name="title" required maxlength="200" placeholder="New chapter title" aria-label="New chapter title" />
	<button class="btn btn-secondary"><Plus aria-hidden="true" />Add chapter</button>
</form>

{#if confirm}
	<ConfirmSheet
		bind:open={confirmOpen}
		title={confirm.title}
		body={confirm.body}
		confirmLabel={confirm.label}
		danger
		onconfirm={async () => {
			if (!(await confirm!.run())) throw new Error('failed');
		}}
	/>
{/if}

<style>
	.chapter {
		padding: 0;
		overflow: hidden;
	}
	.chapter.is-dragging,
	.lesson.is-dragging {
		opacity: 0.5;
	}
	.chapter-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0.75rem 0.75rem 1rem;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.4);
	}
	.rename {
		display: flex;
		flex: 1;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
	}
	.rename .input {
		min-width: 0;
		flex: 1;
	}
	.lessons {
		padding: 0 0.5rem;
	}
	.lesson {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid hsl(var(--border));
	}
	.lesson:last-child {
		border-bottom: 0;
	}
	.lesson-main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		min-height: 44px;
		padding: 0 0.25rem;
		border-radius: var(--radius-sm);
	}
	.lesson-main:hover {
		background: hsl(var(--muted) / 0.6);
	}
	.thumb {
		display: grid;
		place-items: center;
		flex: none;
		width: 4.5rem;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.row-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}
	.grip {
		display: grid;
		place-items: center;
		width: 1.5rem;
		flex: none;
		cursor: grab;
		color: hsl(var(--muted-foreground));
	}
	.grip :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.panel {
		padding: 1rem;
		border-top: 1px solid hsl(var(--border));
	}
	.chapter-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid hsl(var(--border));
	}
	.add-chapter {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.add-chapter .input {
		flex: 1;
		min-width: 0;
	}
	/* Phones: thumbnails shrink and the up/down arrows stay; drag grips are mouse-only. */
	.reorder-bar,
	.lesson :global(.chev) {
		display: none;
	}
	@media (max-width: 767px) {
		.reorder-bar {
			display: flex;
			justify-content: flex-end;
			margin-bottom: 0.75rem;
		}
		.thumb {
			width: 4rem;
		}
		.lesson :global(.chev) {
			display: block;
			flex: none;
			width: 1.125rem;
			height: 1.125rem;
			color: hsl(var(--muted-foreground));
		}
		.is-reorder .lesson :global(.chev),
		.fine-only,
		.desk-only,
		.stack:not(.is-reorder) .arrows {
			display: none;
		}
		.lesson-main {
			min-height: 56px;
		}
	}
	.arrows {
		display: contents;
	}
	@media not (pointer: fine) {
		.fine-only {
			display: none;
		}
	}
</style>
