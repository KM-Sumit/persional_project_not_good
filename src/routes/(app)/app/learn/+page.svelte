<script lang="ts">
	import { Atom, BookOpen, Brain, ChevronRight, Globe, Landmark } from '@lucide/svelte';

	let { data } = $props();
	const icons = [BookOpen, Atom, Brain, Globe, Landmark];
	const tones = ['210 80% 62%', '145 62% 46%', '24 85% 58%', '262 70% 68%', '32 85% 58%'];
	const washes = ['214 28% 16%', '150 26% 15%', '22 30% 16%', '262 28% 18%', '28 32% 16%'];
	const list = $derived(data.tab === 'paid' ? data.paid : data.tab === 'mine' ? data.mine : data.free);
</script>

<svelte:head><title>Courses · UCI</title></svelte:head>

<div class="page flow">
	<header class="page-head">
		<div>
			<h1 class="page-title">Courses</h1>
			<p class="page-sub">Free lessons and paid full courses.</p>
		</div>
	</header>

	<nav class="segmented" aria-label="Courses">
		<a href="/app/learn" aria-current={data.tab === 'free' ? 'page' : undefined}>Free Courses</a>
		<a href="?tab=paid" aria-current={data.tab === 'paid' ? 'page' : undefined}>Paid Courses</a>
		{#if data.mine.length}<a href="?tab=mine" aria-current={data.tab === 'mine' ? 'page' : undefined}>My Courses</a>{/if}
	</nav>

	{#if list.length}
		<nav class="rows" aria-label="Course list">
			{#each list as c, i (c.id)}
				{@const Icon = icons[i % icons.length]!}
				<a class="row" href={data.tab === 'mine' ? `/app/learn/${c.slug}` : c.isPaid ? `/app/learn/${c.slug}` : `/app/learn/${c.slug}?view=classes`} style:--tone={tones[i % tones.length]} style:--wash={washes[i % washes.length]}>
					<span class="mark"><Icon strokeWidth={1.75} /></span>
					<span class="copy">
						<span class="name">{c.title}</span>
						<span class="blurb">
							{#if data.tab === 'mine'}{c.progress.percent}% complete{:else if c.isPaid && data.price[c.id]}₹{data.price[c.id]!.priceInr}{:else if c.isPaid}Paid{:else}Free{/if}
							· {c.lessonCount} {c.lessonCount === 1 ? 'class' : 'classes'}
						</span>
					</span>
					<ChevronRight class="go" />
				</a>
			{/each}
		</nav>
	{:else}
		<div class="card card-pad muted small">
			{data.tab === 'paid' ? 'Paid courses show up here once a course is put on sale.' : data.tab === 'mine' ? 'Start a course and it will stay here.' : 'Free courses are being added.'}
		</div>
	{/if}
</div>

<style>
	.flow { max-width: 40rem; display: grid; gap: 0.85rem; }
	.flow .page-head { margin-bottom: 0; }
	.rows { display: grid; gap: 0.6rem; }
	.row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 4.4rem;
		padding: 0.7rem 0.75rem;
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 1.1rem;
		color: inherit;
		text-decoration: none;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		flex-shrink: 0;
		border-radius: 0.8rem;
		background: hsl(var(--wash));
		color: hsl(var(--tone));
	}
	.mark :global(svg) { width: 1.25rem; height: 1.25rem; }
	.copy { flex: 1; min-width: 0; display: grid; gap: 0.1rem; }
	.name { font-weight: 800; line-height: 1.2; }
	.blurb { font-size: 0.75rem; color: hsl(var(--muted-foreground)); }
	:global(.go) { width: 1rem; height: 1rem; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
</style>
