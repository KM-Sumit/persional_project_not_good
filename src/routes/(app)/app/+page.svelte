<script lang="ts">
	import {
		ArrowRight,
		BookOpen,
		Briefcase,
		ChevronRight,
		Camera,
		ClipboardList,
		Globe,
		KeyRound,
		MessageCircle,
		Newspaper,
		NotebookText,
		Share2,
		Tv,
		UsersRound
	} from '@lucide/svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import BannerCarousel from '#lib/features/engage/components/BannerCarousel.svelte';
	import LessonKindIcon from '#lib/features/courses/components/LessonKindIcon.svelte';

	let { data } = $props();

	const hour = $derived(
		Number(
			new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(
				new Date(data.serverNow)
			)
		)
	);
	const greet = $derived(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

	const next = $derived(data.inProgress ? 'resume' : data.cont ? 'continue' : 'start');

	const shortcuts = [
		{ href: '/app/learn', label: 'Courses', icon: BookOpen, tone: 'courses' },
		{ href: '/app/tests', label: 'Tests', icon: ClipboardList, tone: 'tests' },
		{ href: '/app/pt', label: 'Class Nest', icon: KeyRound, tone: 'nest' },
		{ href: '/app/notes', label: 'Study Notes', icon: NotebookText, tone: 'notes' },
		{ href: '/jobs', label: 'Job Alert', icon: Briefcase, tone: 'jobs' },
		{ href: '/app/daily', label: 'Current Affairs', icon: Newspaper, tone: 'affairs' },
		{ href: '/contact', label: 'Contact Us', icon: UsersRound, tone: 'contact' }
	] as const;

	let socialOpen = $state(false);
	const socials = $derived(
		[
			{ key: 'youtube', label: 'YouTube', href: data.connect.youtube, icon: Tv },
			{ key: 'instagram', label: 'Instagram', href: data.connect.instagram, icon: Camera },
			{ key: 'facebook', label: 'Facebook', href: data.connect.facebook, icon: Globe },
			{ key: 'whatsapp', label: 'WhatsApp', href: data.connect.whatsapp, icon: MessageCircle }
		].filter((l) => l.href)
	);
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

	{#if next !== 'start'}
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
		{/if}
	</section>
	{/if}

	<nav class="tiles rise" style="--i: 3" aria-label="Shortcuts">
		{#each shortcuts as s (s.href)}
			<a class="tile tone-{s.tone}" href={s.href}>
				<span class="tile-icon"><s.icon strokeWidth={2.25} /></span>
				<span class="tile-label">{s.label}</span>
				<span class="tile-chev"><ChevronRight strokeWidth={2.25} /></span>
			</a>
		{/each}
		<button type="button" class="tile tone-social" onclick={() => (socialOpen = true)}>
			<span class="tile-icon"><Share2 strokeWidth={2.25} /></span>
			<span class="tile-label">Social Media</span>
			<span class="tile-chev"><ChevronRight strokeWidth={2} /></span>
		</button>
	</nav>

	<Sheet bind:open={socialOpen} title="Social Media" description="WhatsApp, Facebook and the other pages we use.">
		{#if socials.length}
			<ul class="social-list">
				{#each socials as l (l.key)}
					<li>
						<a class="social-link" href={l.href} target="_blank" rel="noopener">
							<l.icon class="size-5" aria-hidden="true" />
							<span>{l.label}</span>
							<ChevronRight class="size-4" aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Social links are not added yet.</p>
		{/if}
	</Sheet>
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
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.tile {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		min-height: 4.75rem;
		padding: 0.7rem 0.55rem 0.7rem 0.65rem;
		background: #10141c;
		border: 1.5px solid rgb(255 140 40 / 0.9);
		border-radius: 1.15rem;
		box-shadow:
			0 0 0 1px rgb(255 120 20 / 0.25),
			0 0 16px rgb(255 110 20 / 0.35);
		color: #fff;
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.social-list {
		list-style: none;
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
	}
	.social-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.9rem;
		color: inherit;
		font-weight: 650;
		text-decoration: none;
	}
	.social-link span {
		flex: 1;
	}
	.tile-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.85rem;
		color: #fff;
		box-shadow: 0 8px 16px rgb(0 0 0 / 0.28);
	}
	.tile-icon :global(svg) {
		width: 1.4rem;
		height: 1.4rem;
	}
	.tone-courses .tile-icon { background: linear-gradient(160deg, #9b7bff, #5b46f0); }
	.tone-tests .tile-icon { background: linear-gradient(160deg, #ffc14d, #ff7a18); }
	.tone-nest .tile-icon { background: linear-gradient(160deg, #ff8a3d, #ff4b2b); }
	.tone-notes .tile-icon { background: linear-gradient(160deg, #4ae07a, #12b85a); }
	.tone-jobs .tile-icon { background: linear-gradient(160deg, #ff6b93, #ff3358); }
	.tone-affairs .tile-icon { background: linear-gradient(160deg, #4eb4ff, #2d6bff); }
	.tone-contact .tile-icon { background: linear-gradient(160deg, #ffb020, #ff7a00); }
	.tone-social .tile-icon { background: linear-gradient(160deg, #ff4fd8, #7a5cff); }
	.tile-label {
		flex: 1;
		min-width: 0;
		color: #fff;
		font-size: 0.95rem;
		font-weight: 750;
		line-height: 1.15;
	}
	.tile-chev {
		display: grid;
		flex-shrink: 0;
		color: rgb(255 255 255 / 0.78);
	}
	.tile-chev :global(svg) {
		width: 1.05rem;
		height: 1.05rem;
	}
</style>
