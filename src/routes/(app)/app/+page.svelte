<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, BookOpenText, CalendarClock, ChevronRight, ClipboardList, Newspaper, NotebookText, PlayCircle, Radio, Timer, UsersRound } from '@lucide/svelte';
	import Countdown from '#lib/components/kit/Countdown.svelte';
	import { toast } from '#lib/components/ui';
	import BannerCarousel from '#lib/features/engage/components/BannerCarousel.svelte';
	import LessonKindIcon from '#lib/features/courses/components/LessonKindIcon.svelte';
	import { when } from '#lib/features/courses/components/format';

	let { data } = $props();

	const hour = $derived(Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date(data.serverNow))));
	const greet = $derived(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

	// Exactly one "next thing", in priority order.
	const next = $derived(
		data.inProgress
			? 'resume'
			: data.nextLive && (data.nextLiveSoon || data.nextLive.window === 'live')
				? 'live'
				: data.cont
					? 'continue'
					: data.nextLive
						? 'live'
						: 'start'
	);
	const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
	let joining = $state(false);
</script>

<svelte:head><title>Today · UCI</title></svelte:head>

<div class="page pb-8">
	<header class="page-head rise" style="--i: 0">
		<div class="min-w-0">
			<p class="eyebrow">{greet}</p>
			<h1 class="page-title">Hello, {data.firstName}</h1>
		</div>
		{#if data.examName}
			<a href="/app/me#exam" class="chip shrink-0" title="Change target exam">{data.examName}</a>
		{/if}
	</header>

	<div class="today">
		<div class="stack-lg min-w-0">
			<!-- The one next thing -->
			<section class="rise" style="--i: 1" aria-label="Next up">
				{#if next === 'resume' && data.inProgress}
					{@const t = data.inProgress}
					<article class="card next">
						<p class="eyebrow">Test in progress</p>
						<h2 class="next-title">{t.title}</h2>
						<p class="muted small">Your answers are saved. Pick up where you left off before time runs out.</p>
						<a class="btn btn-primary btn-lg" href="/app/tests/{t.id}/attempt/{t.inProgressAttemptId}">Resume test<ArrowRight /></a>
					</article>
				{:else if next === 'live' && data.nextLive}
					{@const t = data.nextLive}
					<article class="card next admit">
						<div class="admit-top">
							<p class="eyebrow">{t.window === 'live' ? 'Live now' : 'Admit card · scheduled test'}</p>
							{#if t.window === 'live'}<span class="badge badge-live">Live</span>{/if}
						</div>
						<h2 class="next-title">{t.title}</h2>
						<dl class="admit-grid">
							<div><dt>Starts</dt><dd>{t.startsAt ? when(t.startsAt) : 'Anytime'}</dd></div>
							<div><dt>Duration</dt><dd class="font-mono tabular">{t.durationMin} min</dd></div>
							<div><dt>Questions</dt><dd class="font-mono tabular">{t.questionCount}</dd></div>
							<div><dt>Marks</dt><dd class="font-mono tabular">{t.totalMarks}</dd></div>
						</dl>
						{#if t.window === 'upcoming' && data.nextLiveSoon && t.startsAt}
							<p class="countdown"><Timer class="size-4" /> Starts in <Countdown to={t.startsAt} serverNow={data.serverNow} warnAt={0} /></p>
						{/if}
						<a class="btn btn-primary btn-lg" href="/app/tests/{t.id}">{t.window === 'live' ? 'Open test' : 'View instructions'}<ArrowRight /></a>
					</article>
				{:else if next === 'continue' && data.cont}
					{@const c = data.cont}
					<article class="card next">
						<p class="eyebrow">Continue learning</p>
						<h2 class="next-title">{c.lesson.title}</h2>
						<p class="muted small flex items-center gap-1.5"><LessonKindIcon kind={c.lesson.kind} />{c.course.title}</p>
						<div class="flex items-center gap-3">
							<div class="progress grow"><span style="width: {c.progress.percent}%"></span></div>
							<span class="font-mono tabular small">{c.progress.completed}/{c.progress.total}</span>
						</div>
						<a class="btn btn-primary btn-lg" href="/app/learn/{c.course.slug}/{c.lesson.id}">
							{c.lesson.positionSec > 0 ? 'Resume lesson' : 'Start lesson'}<ArrowRight />
						</a>
					</article>
				{:else}
					<article class="card next">
						<p class="eyebrow">Start here</p>
						<h2 class="next-title">Take your first practice test</h2>
						<p class="muted small">See where you stand today. Every test shows answers, solutions and your rank.</p>
						<a class="btn btn-primary btn-lg" href="/app/tests">Browse tests<ArrowRight /></a>
					</article>
				{/if}
			</section>

			{#if data.liveClass || data.daily?.post}
				<!-- Every-day items: the next live class and today's current affairs quiz. -->
				<section class="list rise" style="--i: 2" aria-label="Today">
					{#if data.liveClass}
						{@const c = data.liveClass}
						<a class="list-row" href="/app/live/{c.id}">
							<span class="leading-icon"><Radio /></span>
							<span class="grow">
								<span class="title block">{c.title}</span>
								<span class="meta block">{c.status === 'live' ? 'Live now' : when(c.startsAt)} · {c.teacher}</span>
							</span>
							{#if c.status === 'live'}<span class="badge badge-live">Live</span>{/if}
							<ChevronRight class="chev" />
						</a>
					{/if}
					{#if data.daily?.post}
						{@const d = data.daily}
						<a class="list-row" href="/app/daily">
							<span class="leading-icon"><Newspaper /></span>
							<span class="grow">
								<span class="title block">Today's current affairs</span>
								<span class="meta block">
									{d.quiz?.status === 'done' ? `Quiz done${d.quiz.score != null ? ` · ${d.quiz.score} marks` : ''}` : d.quiz ? 'Read, then take the quiz' : 'Read today’s update'}{d.streak > 1 ? ` · ${d.streak}-day streak` : ''}
								</span>
							</span>
							<ChevronRight class="chev" />
						</a>
					{/if}
				</section>
			{/if}

			{#if data.banners.length}
				<section class="rise" style="--i: 2"><BannerCarousel banners={data.banners} /></section>
			{/if}

			<section class="rise" style="--i: 3">
				<div class="section-head">
					<h2 class="section-title">Tests open now</h2>
					<a class="section-link" href="/app/tests">All tests</a>
				</div>
				{#if data.openNow.length}
					<div class="list">
						{#each data.openNow as t (t.id)}
							<a class="list-row" href="/app/tests/{t.id}">
								<span class="leading-icon"><ClipboardList /></span>
								<span class="grow">
									<span class="title block">{t.title}</span>
									<span class="meta block"><span class="tabular">{t.questionCount}</span> questions · <span class="tabular">{t.durationMin}</span> min{t.attemptsUsed ? ` · attempted ${t.attemptsUsed}×` : ''}</span>
								</span>
								{#if t.kind === 'live'}<span class="trail"><span class="badge badge-live">Live</span></span>{/if}
							</a>
						{/each}
					</div>
				{:else}
					<div class="card card-pad muted small">No other tests are open for your exam right now. New ones show up here.</div>
				{/if}
			</section>

			{#if next !== 'continue' && data.cont}
				{@const c = data.cont}
				<section class="rise" style="--i: 4">
					<div class="section-head"><h2 class="section-title">Continue learning</h2><a class="section-link" href="/app/learn">My courses</a></div>
					<div class="list"><a class="list-row" href="/app/learn/{c.course.slug}/{c.lesson.id}">
						<span class="leading-icon"><PlayCircle /></span>
						<span class="grow">
							<span class="title block">{c.lesson.title}</span>
							<span class="meta block">{c.course.title} · <span class="tabular">{c.progress.percent}%</span> done</span>
						</span>
					</a></div>
				</section>
			{/if}
		</div>

		<aside class="stack-lg min-w-0">
			{#if data.nextLive && next !== 'live'}
				{@const t = data.nextLive}
				<section class="rise" style="--i: 4">
					<div class="section-head"><h2 class="section-title">Next scheduled test</h2></div>
					<div class="list"><a class="list-row" href="/app/tests/{t.id}">
						<span class="leading-icon"><CalendarClock /></span>
						<span class="grow">
							<span class="title block">{t.title}</span>
							<span class="meta block">{t.startsAt ? when(t.startsAt) : ''}</span>
						</span>
					</a></div>
				</section>
			{/if}

			<section class="rise" style="--i: 5">
				<div class="section-head">
					<h2 class="section-title">New notes</h2>
					<a class="section-link" href="/app/notes">All notes</a>
				</div>
				{#if data.notes.length}
					<div class="list">
						{#each data.notes as n (n.id)}
							<a class="list-row" href="/app/notes/{n.slug}">
								<span class="leading-icon"><NotebookText /></span>
								<span class="grow">
									<span class="title block">{n.title}</span>
									<span class="meta block"><span class="tabular">{n.readingMinutes}</span> min read{n.hasPdf ? ' · PDF' : ''}</span>
								</span>
							</a>
						{/each}
					</div>
				{:else}
					<div class="card card-pad muted small">Notes for your exam will appear here.</div>
				{/if}
			</section>

			<section class="card card-pad rise" style="--i: 6">
				<div class="flex items-start gap-3">
					<span class="leading-icon"><UsersRound /></span>
					<div class="min-w-0">
						<h2 class="font-semibold">Joined a batch at UCI?</h2>
						<p class="muted small">Enter the 6-letter code from your teacher to unlock your batch's tests, courses and notes.</p>
					</div>
				</div>
				<form
					method="POST"
					action="/app/me?/join"
					class="join"
					use:enhance={() => {
						joining = true;
						return async ({ result, update, formElement }) => {
							joining = false;
							if (result.type === 'success') {
								toast(`Joined ${(result.data as { batch?: string })?.batch ?? 'batch'}`);
								formElement.reset();
								await update({ reset: false, invalidateAll: true });
							} else if (result.type === 'failure') toast((result.data as { message?: string })?.message ?? 'Could not join.', 'error');
							else await update();
						};
					}}
				>
					<label class="sr-only" for="join-code">Batch code</label>
					<input id="join-code" name="code" class="input font-mono uppercase" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="AB12CD" required />
					<button class="btn btn-secondary" disabled={joining}>Join</button>
				</form>
			</section>

			<div class="list rise" style="--i: 7"><a class="list-row" href="/app/learn">
				<span class="leading-icon"><BookOpenText /></span>
				<span class="grow"><span class="title block">Courses</span><span class="meta block">Video lessons and reading for {data.examName ?? 'your exam'}</span></span>
			</a></div>
		</aside>
	</div>
</div>

<style>
	.today {
		display: grid;
		gap: var(--space-section);
	}
	@media (min-width: 1024px) {
		.today {
			grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.next {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		border-left: 4px solid hsl(var(--sun));
	}
	.next .btn {
		align-self: flex-start;
		margin-top: 0.25rem;
	}
	@media (max-width: 639px) {
		.next .btn {
			align-self: stretch;
		}
	}
	.next-title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.admit-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.admit-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-top: 1.5px dashed hsl(var(--border));
		border-bottom: 1.5px dashed hsl(var(--border));
		padding: 0.75rem 0;
		gap: 0.75rem 1rem;
	}
	@media (min-width: 640px) {
		.admit-grid {
			grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
		}
	}
	.admit-grid dt {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: hsl(var(--muted-foreground));
	}
	.admit-grid dd {
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.countdown {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
	}
	.countdown :global(.kit-countdown) {
		font-size: 1.25rem;
	}
	.join {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.875rem;
	}
	.join .input {
		flex: 1;
		min-width: 0;
		letter-spacing: 0.15em;
	}
</style>
