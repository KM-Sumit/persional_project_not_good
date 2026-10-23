<script lang="ts">
	import {
		ArrowRight,
		BookOpen,
		Briefcase,
		ChevronRight,
		ClipboardList,
		KeyRound,
		Newspaper,
		NotebookText,
		Timer,
		UsersRound
	} from '@lucide/svelte';
	import Countdown from '#lib/components/kit/Countdown.svelte';
	import BannerCarousel from '#lib/features/engage/components/BannerCarousel.svelte';
	import LessonKindIcon from '#lib/features/courses/components/LessonKindIcon.svelte';
	import { when } from '#lib/features/courses/components/format';

	let { data } = $props();

	const hour = $derived(
		Number(
			new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(
				new Date(data.serverNow)
			)
		)
	);
	const greet = $derived(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

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

	const shortcuts = [
		{ href: '/app/learn', label: 'Courses', icon: BookOpen },
		{ href: '/app/tests', label: 'Tests', icon: ClipboardList },
		{ href: '/app/pt', label: 'PT Test', icon: KeyRound },
		{ href: '/app/notes', label: 'Study Notes', icon: NotebookText },
		{ href: '/jobs', label: 'Job Alert', icon: Briefcase },
		{ href: '/app/daily', label: 'Current Affairs', icon: Newspaper },
		{ href: '/contact', label: 'Connect Us', icon: UsersRound }
	] as const;
</script>

<svelte:head><title>Home · UCI</title></svelte:head>

<div class="home">
	<header class="home-head rise" style="--i: 0">
		<p class="eyebrow">{greet}</p>
		<h1 class="page-title">Hello, {data.firstName}</h1>
	</header>

	<section class="rise" style="--i: 1">
		<BannerCarousel banners={data.banners} />
	</section>

	<section class="rise" style="--i: 2" aria-label="Next up">
		{#if next === 'resume' && data.inProgress}
			{@const t = data.inProgress}
			<article class="hero-card">
				<p class="eyebrow">Test in progress</p>
				<h2 class="hero-title">{t.title}</h2>
				<p class="hero-copy">Your answers are saved. Pick up where you left off before time runs out.</p>
				<a class="btn btn-primary btn-lg btn-block" href="/app/tests/{t.id}/attempt/{t.inProgressAttemptId}"
					>Resume test <ArrowRight /></a
				>
			</article>
		{:else if next === 'live' && data.nextLive}
			{@const t = data.nextLive}
			<article class="hero-card">
				<p class="eyebrow">{t.window === 'live' ? 'Live now' : 'Admit card · scheduled test'}</p>
				<h2 class="hero-title">{t.title}</h2>
				<p class="hero-copy">
					{t.startsAt ? when(t.startsAt) : 'Open now'} · {t.durationMin} min · {t.questionCount} questions
				</p>
				{#if t.window === 'upcoming' && data.nextLiveSoon && t.startsAt}
					<p class="countdown"><Timer class="size-4" /> Starts in <Countdown to={t.startsAt} serverNow={data.serverNow} warnAt={0} /></p>
				{/if}
				<a class="btn btn-primary btn-lg btn-block" href="/app/tests/{t.id}"
					>{t.window === 'live' ? 'Open test' : 'View instructions'} <ArrowRight /></a
				>
			</article>
		{:else if next === 'continue' && data.cont}
			{@const c = data.cont}
			<article class="hero-card">
				<p class="eyebrow">Continue learning</p>
				<h2 class="hero-title">{c.lesson.title}</h2>
				<p class="hero-copy flex items-center gap-1.5"><LessonKindIcon kind={c.lesson.kind} />{c.course.title}</p>
				<a class="btn btn-primary btn-lg btn-block" href="/app/learn/{c.course.slug}/{c.lesson.id}">
					{c.lesson.positionSec > 0 ? 'Resume lesson' : 'Start lesson'}
					<ArrowRight />
				</a>
			</article>
		{:else}
			<article class="hero-card">
				<p class="eyebrow">Start here</p>
				<h2 class="hero-title">Take your first practice test</h2>
				<p class="hero-copy">See where you stand today. Every test shows answers, solutions and your rank.</p>
				<a class="btn btn-primary btn-lg btn-block" href="/app/tests">Browse tests <ArrowRight /></a>
			</article>
		{/if}
	</section>

	<nav class="tiles rise" style="--i: 3" aria-label="Shortcuts">
		{#each shortcuts as s (s.href)}
			<a class="tile" href={s.href}>
				<span class="tile-icon"><s.icon strokeWidth={1.75} /></span>
				<span class="tile-label">{s.label}</span>
				<span class="tile-chev"><ChevronRight strokeWidth={2} /></span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.home {
		width: 100%;
		max-width: 28rem;
		margin: 0 auto;
		padding: 0.25rem var(--gutter) 2.5rem;
		display: grid;
		gap: 1.15rem;
	}
	.home-head {
		display: grid;
		gap: 0.2rem;
	}
	.home-head .page-title {
		font-size: clamp(1.75rem, 1.4rem + 2vw, 2.15rem);
		letter-spacing: -0.03em;
	}
	.hero-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.55rem;
		padding: 1.2rem 1.15rem 1.15rem 1.25rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.35rem;
		border-left: 5px solid hsl(var(--sun));
		box-shadow: var(--shadow-sm);
	}
	.hero-title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(1.25rem, 1.1rem + 0.7vw, 1.55rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.hero-copy {
		color: hsl(var(--muted-foreground));
		font-size: 0.9rem;
		line-height: 1.4;
	}
	.hero-card .btn {
		margin-top: 0.55rem;
		border-radius: 999px;
		font-weight: 700;
	}
	.countdown {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
	}
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
	.tile {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 3.55rem;
		padding: 0.72rem 0.55rem 0.72rem 0.7rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.15rem;
		box-shadow: var(--shadow-sm);
		color: inherit;
		text-decoration: none;
	}
	.tile-icon {
		display: grid;
		flex-shrink: 0;
		color: hsl(var(--sun));
	}
	.tile-icon :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}
	.tile-label {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		line-height: 1.2;
		white-space: nowrap;
	}
	.tile-chev {
		display: grid;
		flex-shrink: 0;
		color: hsl(var(--muted-foreground));
		opacity: 0.7;
	}
	.tile-chev :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
