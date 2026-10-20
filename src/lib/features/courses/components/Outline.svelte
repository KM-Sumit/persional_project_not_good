<script lang="ts">
	// Course outline: chapters with numbered lesson rows (kind, duration, done/started). Used by the course page
	// and as the lesson player's playlist (side column on desktop, sheet on phone).
	import { Check, Lock } from '@lucide/svelte';
	import type { ChapterDTO, LessonState } from '#lib/features/courses/schema';
	import LessonKindIcon from './LessonKindIcon.svelte';
	import { duration } from './format';

	let {
		slug,
		chapters,
		state,
		current = null,
		locked = false
	}: { slug: string; chapters: ChapterDTO[]; state: Record<string, LessonState>; current?: string | null; locked?: boolean } = $props();

	const numbers = $derived(new Map(chapters.flatMap((c) => c.lessons).map((l, i) => [l.id, i + 1])));
</script>

<div class="course-outline">
	{#each chapters as ch, ci (ch.id)}
		{@const done = ch.lessons.filter((l) => state[l.id]?.completed).length}
		<section>
			<header class="ch-head">
				<span class="eyebrow">Chapter {ci + 1}</span>
				<h3 class="ch-title">{ch.title}</h3>
				<span class="tiny muted tabular">{done ? `${done}/${ch.lessons.length} done` : `${ch.lessons.length} lessons`}</span>
			</header>
			{#if ch.lessons.length}
				<ol class="lessons">
					{#each ch.lessons as l (l.id)}
						{@const s = state[l.id]}
						{@const shut = locked && !l.isPreview}
						<li>
							<a
								href="/app/learn/{slug}/{l.id}"
								class="lesson"
								class:is-current={l.id === current}
								class:is-locked={shut}
								aria-current={l.id === current ? 'page' : undefined}
								data-sveltekit-replacestate={current ? '' : undefined}
							>
								<span class="mark" class:is-done={s?.completed} class:is-started={!s?.completed && (s?.positionSec ?? 0) > 0} aria-hidden="true">
									{#if shut}<Lock class="size-3.5" />{:else if s?.completed}<Check class="size-3.5" strokeWidth={3} />{:else}<span class="font-mono tabular">{numbers.get(l.id)}</span>{/if}
								</span>
								<span class="grow min-w-0">
									<span class="l-title">{l.title}</span>
									<span class="l-meta">{#if locked && l.isPreview}<span class="demo">Demo</span>{/if}<LessonKindIcon kind={l.kind} class="size-3.5" />{l.kind === 'video' ? 'Video' : l.kind === 'pdf' ? 'PDF' : 'Reading'}{l.durationSec ? ` · ${duration(l.durationSec)}` : ''}{s?.completed ? ' · done' : ''}</span>
								</span>
							</a>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="tiny muted px-3 pb-3">Lessons for this chapter are coming soon.</p>
			{/if}
		</section>
	{/each}
</div>

<style>
	.course-outline {
		display: grid;
		gap: 1rem;
	}
	.ch-head {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		gap: 0 0.5rem;
		padding: 0 0.25rem 0.5rem;
	}
	.ch-head .eyebrow {
		grid-column: 1 / -1;
	}
	.ch-title {
		font-weight: 700;
		font-size: 1rem;
		line-height: 1.3;
	}
	.lessons {
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
		background: hsl(var(--surface));
		overflow: hidden;
	}
	.lessons li + li {
		border-top: 1px solid hsl(var(--border));
	}
	.lesson {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 56px;
		padding: 0.625rem 0.875rem;
		color: inherit;
		position: relative;
	}
	.lesson:hover {
		background: hsl(var(--muted) / 0.5);
	}
	.lesson.is-current {
		background: hsl(var(--accent));
	}
	.lesson.is-current::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: hsl(var(--sun));
	}
	.mark {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--foreground) / 0.35);
		display: grid;
		place-items: center;
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--foreground) / 0.75);
	}
	.mark.is-started {
		background: linear-gradient(90deg, hsl(var(--foreground) / 0.18) 50%, transparent 50%);
	}
	.mark.is-done {
		background: hsl(var(--foreground));
		border-color: hsl(var(--foreground));
		color: hsl(var(--background));
	}
	.lesson.is-locked .l-title {
		color: hsl(var(--muted-foreground));
	}
	.lesson.is-locked .mark {
		border-color: hsl(var(--border));
		color: hsl(var(--muted-foreground));
	}
	.demo {
		font-weight: 700;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: hsl(var(--success));
		margin-right: 0.25rem;
	}
	.l-title {
		display: block;
		font-weight: 600;
		font-size: 0.9375rem;
		line-height: 1.35;
	}
	.l-meta {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.125rem;
	}
</style>
