<script lang="ts">
	let film = $state<HTMLVideoElement | null>(null);
	let filmReady = $state(false);

	$effect(() => {
		const node = film;
		if (!node) return;
		node.muted = true;
		const ready = () => {
			filmReady = true;
		};
		if (node.readyState >= 2) ready();
		node.addEventListener('loadeddata', ready);
		node.play()?.catch(() => {});
		return () => node.removeEventListener('loadeddata', ready);
	});

	const choices = [
		{ letter: 'A', text: '160' },
		{ letter: 'B', text: '200' },
		{ letter: 'C', text: '240' },
		{ letter: 'D', text: '320' }
	];

	const desk = [
		{
			title: 'Tests',
			detail: 'Practice, mock, and previous-year papers. The clock stays on the server if you leave.'
		},
		{
			title: 'Courses',
			detail: 'A lesson on its own page. Mark it done, then open the next one.'
		},
		{
			title: 'Notes',
			detail: 'Revision sheets in the form you can scan before a paper.'
		}
	];
</script>

<svelte:head>
	<title>Upendra Competition Institute — Sehore</title>
	<meta
		name="description"
		content="Upendra Competition Institute, Englishpura, Sehore. Timed papers, lessons, and notes for SSC, Railways, MP Police, Defence, and Agniveer."
	/>
</svelte:head>

<main class="index">
	<section class="open">
		<div class="intro">
			<h1>Upendra Competition Institute</h1>
			<p class="place">Englishpura, Main Road, Sehore.</p>
			<p class="lede">
				SSC, Railways, MP Police, Defence, and Agniveer. Sit the paper here. The attempt keeps running until the server says it is over.
			</p>
			<a class="btn btn-primary no-underline" href="/signin">Sign in</a>
		</div>

		<figure class="film">
			<div class="frame">
				<video
					bind:this={film}
					src="/intro.mp4"
					playsinline
					muted
					autoplay
					preload="auto"
					aria-label="Upendra Competition Institute"
				></video>
				{#if !filmReady}
					<span class="wait" aria-hidden="true"></span>
				{/if}
			</div>
			<figcaption>The institute, Sehore</figcaption>
		</figure>

		<article class="sheet" aria-label="A sample question">
			<header class="sheet-top">
				<span>Percentages practice</span>
				<span class="timer">09:18</span>
			</header>
			<p class="q-no">Question 2 of 3</p>
			<p class="q">If 40% of a number is 80, the number is</p>
			<ol class="choices">
				{#each choices as choice (choice.letter)}
					<li class={{ marked: choice.letter === 'B' }}>
						<span class="bubble">{choice.letter}</span>
						<span>{choice.text}</span>
					</li>
				{/each}
			</ol>
		</article>
	</section>

	<section id="inside" class="desk" aria-label="What you can open">
		{#each desk as item (item.title)}
			<a class="desk-row" href="/signin">
				<span class="desk-title">{item.title}</span>
				<span class="desk-detail">{item.detail}</span>
			</a>
		{/each}
	</section>
</main>

<style>
	.index {
		width: min(100%, 68rem);
		margin-inline: auto;
		padding: clamp(1.5rem, 4vw, 3.5rem) var(--gutter, 1rem) clamp(2.5rem, 6vw, 4.5rem);
	}
	.open {
		display: grid;
		gap: 2rem;
		align-items: start;
	}
	@media (min-width: 900px) {
		.open {
			grid-template-columns: minmax(0, 0.9fr) minmax(18rem, 1.1fr);
			gap: 3rem;
			align-items: center;
		}
	}
	.film {
		margin: 0;
		min-width: 0;
	}
	.frame {
		position: relative;
		width: 100%;
		aspect-ratio: 1010 / 590;
		overflow: hidden;
		border-radius: 12px;
		background: #14120f;
	}
	.film video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.wait {
		position: absolute;
		inset: 0;
		background: #1c1916;
	}
	.film figcaption {
		margin-top: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 650;
		color: hsl(var(--muted-foreground));
	}
	h1 {
		margin: 0;
		max-width: 12ch;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2.6rem, 1.4rem + 4.2vw, 4.75rem);
		line-height: 0.92;
		letter-spacing: -0.04em;
	}
	.place {
		margin: 1rem 0 0;
		font-size: 1rem;
		font-weight: 650;
	}
	.lede {
		max-width: 36rem;
		margin: 0.7rem 0 0;
		font-size: 1.0625rem;
		line-height: 1.55;
	}
	.intro .btn {
		margin-top: 1.35rem;
	}
	.sheet {
		background: hsl(var(--surface));
		border: 1px solid hsl(var(--border));
		border-radius: 2px 2px 2px 18px;
		padding: 1.1rem 1.15rem 1.2rem;
		box-shadow: 0 1px 0 hsl(var(--foreground) / 0.04);
	}
	.sheet-top {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.8125rem;
		font-weight: 700;
	}
	.timer {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: hsl(var(--primary));
	}
	.q-no {
		margin: 1.1rem 0 0;
		font-size: 0.8125rem;
		font-weight: 650;
		color: hsl(var(--muted-foreground));
	}
	.q {
		margin: 0.35rem 0 0;
		font-weight: 700;
		font-size: 1.125rem;
		line-height: 1.35;
	}
	.choices {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
	}
	.choices li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 2.75rem;
		padding: 0.35rem 0.45rem;
		border-bottom: 1px solid hsl(var(--border));
	}
	.bubble {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--foreground));
		font-size: 0.75rem;
		font-weight: 700;
	}
	.marked .bubble {
		background: hsl(var(--foreground));
		color: hsl(var(--background));
	}
	.desk {
		margin-top: clamp(2.5rem, 6vw, 4rem);
		border-top: 1px solid hsl(var(--foreground));
	}
	.desk-row {
		display: grid;
		gap: 0.2rem;
		padding: 1.05rem 0;
		border-bottom: 1px solid hsl(var(--border));
		color: inherit;
		text-decoration: none;
	}
	@media (min-width: 700px) {
		.desk-row {
			grid-template-columns: 8.5rem minmax(0, 1fr);
			gap: 1.5rem;
			align-items: baseline;
		}
	}
	.desk-row:hover .desk-title {
		color: hsl(var(--primary));
	}
	.desk-title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
	}
	.desk-detail {
		max-width: 42rem;
		font-size: 1rem;
		line-height: 1.45;
	}
</style>
