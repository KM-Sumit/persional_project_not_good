<script lang="ts">
	import { page } from '$app/state';
	import { ArrowRight, MessageCircle, Phone, Quote } from '@lucide/svelte';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import IntroVideo from '#lib/features/site/components/IntroVideo.svelte';
	import AdmitCard from '#lib/features/site/components/AdmitCard.svelte';
	import CourseTile from '#lib/features/site/components/CourseTile.svelte';
	import SectionHead from '#lib/features/site/components/SectionHead.svelte';
	import PersonCard from '#lib/features/site/components/PersonCard.svelte';
	import { orgJsonLd, plural, waLink } from '#lib/features/site/components/format';

	let { data } = $props();
	const st = $derived(data.site.settings);
	const wa = $derived(waLink(st.whatsappNumber, 'Hello, I want to know about admission at UCI.'));
	const examName = $derived(new Map(data.hub.categories.flatMap((c) => c.exams.map((e) => [e.id, e.name] as const))));
	const examTotal = (ids: string[]) =>
		ids.reduce((a, id) => a + (data.hub.counts[id]?.tests ?? 0), 0);

	const steps = [
		{ k: 'Learn', body: 'Video lessons and revision notes, chapter by chapter, organised by exam.' },
		{ k: 'Practice', body: 'Topic tests with instant scoring and a worked solution for every question.' },
		{ k: 'Live test', body: 'Scheduled full mocks: everyone starts on the same server clock, one attempt.' },
		{ k: 'Rank', body: 'Your rank, percentile and question-wise analysis the moment the window closes.' }
	];

	const faqs = [
		{
			q: 'How do I take admission?',
			a: 'Send an enquiry from the contact page, call, or visit the institute. We help you pick the right batch for your exam. For online study you only need to sign in with your Google account.'
		},
		{
			q: 'What are the fees?',
			a: 'Fees depend on the course and batch. Classroom fees are shared at the counter or on a call. Online passes and paid courses show their price on the exam or course page before you pay, and payments go through Razorpay (UPI, cards, net banking).'
		},
		{
			q: 'Is it online or offline?',
			a: 'Both. Classroom batches run at the institute, and the same courses, notes and mock tests are available in the UCI app, so you can revise and test from home.'
		},
		{
			q: 'Are classes in Hindi medium?',
			a: 'Yes. Teaching is in Hindi with the English terms you will see in the paper. Every test shows its language on the instructions screen before you start.'
		},
		{
			q: 'Are the mock tests really free?',
			a: 'Free tests are marked Free. You sign in with Google to save your answers and see your rank; there is no payment step for a free test.'
		}
	];
	const faqLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
	});
</script>

<Seo
	title="UCI · Coaching for SSC, Railway, MPPSC and MP Police"
	description="Upendra Competition Institute (UCI): Hindi-medium coaching for SSC, Railway, MPPSC and MP Police exams. Video courses, notes, free mock tests and live tests with ranks."
	jsonld={[orgJsonLd(st, page.url.origin), faqLd]}
/>

<!-- Hero: the thesis is "prepare under exam conditions", so the one action is a free mock test. -->
<section class="hero site-wrap">
	<div class="hero-copy rise">
		<p class="hero-kicker"><span>Dream. Prepare. Achieve.</span></p>
		<h1 class="hero-title">
			<span class="hero-en">{st.heroHeadline || 'Coaching for SSC, Railway, MPPSC and MP Police exams'}</span>
		</h1>
		<p class="hero-sub">
			{st.heroSubline || 'Classroom and online batches in Hindi medium, with video courses, notes and live mock tests that rank you against every UCI student.'}
		</p>
		<div class="hero-cta">
			<a href="/login?next=/app/tests" class="btn btn-primary btn-lg">Take a free mock test<ArrowRight /></a>
			<a href="/exams" class="btn btn-ghost btn-lg">Browse exams</a>
		</div>
		{#if st.stats?.length}
			<dl class="hero-stats">
				{#each st.stats as s (s.label)}
					<div><dt>{s.label}</dt><dd class="font-mono tabular">{s.value}</dd></div>
				{/each}
			</dl>
		{/if}
	</div>
	<div class="hero-media rise" style="--i: 1">
		<div class="frame">
			<IntroVideo />
			<p class="frame-cap"><span>Upendra Competition Institute</span><span class="font-mono">Madhya Pradesh</span></p>
		</div>
	</div>
</section>

{#if data.hub.categories.length}
	<nav class="site-wrap exam-strip" aria-label="Exams">
		<div class="chips">
			{#each data.hub.categories as c (c.id)}
				<a href="/exams/{c.slug}" class="chip">{c.name}</a>
			{/each}
			<a href="/exams" class="chip">All exams</a>
		</div>
	</nav>
{/if}

{#if data.live}
	<section class="site-wrap sec" aria-labelledby="live-h">
		<SectionHead id="live-h" title="Your next exam-day rehearsal" />
		<AdmitCard test={data.live} />
	</section>
{/if}

<section class="site-wrap sec" aria-labelledby="exams-h">
	<SectionHead id="exams-h" title="Exams we prepare you for" href="/exams" link="All exams" />
	<div class="cats">
		{#each data.hub.categories as c, i (c.id)}
			{@const n = examTotal(c.exams.map((e) => e.id))}
			<article class="cat card rise" style="--i: {i}">
				<a href="/exams/{c.slug}" class="cat-head">
					<h3>{c.name}</h3>
					<ArrowRight />
				</a>
				{#if c.description}<p class="cat-desc">{c.description}</p>{/if}
				<ul class="cat-exams">
					{#each c.exams as e (e.id)}
						<li><a href="/exams/{c.slug}/{e.slug}">{e.name}</a></li>
					{/each}
				</ul>
				<p class="cat-foot font-mono tabular">{plural(c.exams.length, 'exam')}{#if n} · {plural(n, 'test')}{/if}</p>
			</article>
		{/each}
	</div>
</section>

<section class="site-wrap sec" aria-labelledby="how-h">
	<SectionHead id="how-h" title="How preparation works at UCI" />
	<ol class="steps">
		{#each steps as s, i (s.k)}
			<li class="step">
				<span class="bubble" class:is-filled={i === steps.length - 1} aria-hidden="true">{i + 1}</span>
				<div>
					<h3>{s.k}</h3>
					<p>{s.body}</p>
				</div>
			</li>
		{/each}
	</ol>
</section>

{#if data.courses.length}
	<section class="site-wrap sec" aria-labelledby="courses-h">
		<SectionHead id="courses-h" title="Courses" href="/courses" link={data.courseTotal > data.courses.length ? `All ${data.courseTotal} courses` : 'All courses'} />
		<div class="grid-3">
			{#each data.courses as c (c.id)}
				<CourseTile course={c} examName={c.examId ? examName.get(c.examId) : undefined} price={data.prices[c.id]?.priceInr} thumb={data.thumbs[c.slug]} />
			{/each}
		</div>
	</section>
{/if}

{#if data.site.toppers.length}
	<section class="site-wrap sec" aria-labelledby="results-h">
		<SectionHead id="results-h" title="Selections" href="/results" link="All results" />
		<div class="people">
			{#each data.site.toppers.slice(0, 4) as t (t.id)}
				<PersonCard name={t.name} photo={t.photo} role={t.result} meta={t.exam} />
			{/each}
		</div>
	</section>
{/if}

{#if data.site.faculty.length}
	<section class="site-wrap sec" aria-labelledby="faculty-h">
		<SectionHead id="faculty-h" title="Faculty" href="/faculty" link="All faculty" />
		<div class="people">
			{#each data.site.faculty.slice(0, 4) as f (f.id)}
				<PersonCard name={f.name} photo={f.photo} role={f.subject} />
			{/each}
		</div>
	</section>
{/if}

<section class="site-wrap sec faq-sec" aria-labelledby="faq-h">
	<SectionHead id="faq-h" title="Questions parents and students ask" />
	<div class="faq">
		{#each faqs as f (f.q)}
			<details>
				<summary>{f.q}</summary>
				<p>{f.a}</p>
			</details>
		{/each}
	</div>
</section>

<section class="site-wrap sec">
	<div class="cta-band">
		<Quote class="cta-mark" aria-hidden="true" />
		<div class="min-w-0">
			<h2>Talk to us about admission</h2>
		</div>
		<div class="cta-actions">
			<a href="/contact" class="btn btn-primary btn-lg">Send an enquiry</a>
			{#if st.contactPhone}<a href="tel:{st.contactPhone}" class="btn btn-lg cta-ghost"><Phone />Call</a>{/if}
			{#if wa}<a href={wa} class="btn btn-lg cta-ghost" target="_blank" rel="noopener"><MessageCircle />WhatsApp</a>{/if}
		</div>
	</div>
</section>

<style>
	.hero {
		display: grid;
		gap: 2rem;
		padding-top: clamp(1.5rem, 1rem + 3vw, 4rem);
		padding-bottom: 1.5rem;
		align-items: center;
	}
	@media (min-width: 1024px) {
		.hero {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
			gap: 3.5rem;
		}
	}
	.hero-kicker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		font-family: var(--font-display);
		font-stretch: 80%;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: hsl(var(--primary));
	}
	.hero-title {
		margin-top: 1rem;
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		text-wrap: balance;
	}
	.hero-en {
		display: block;
		margin-top: 0.5rem;
		font-weight: 600;
		font-size: clamp(1.25rem, 1.05rem + 0.9vw, 1.75rem);
		line-height: 1.2;
		letter-spacing: -0.015em;
		color: hsl(var(--muted-foreground));
	}
	.hero-sub {
		margin-top: 1rem;
		max-width: 34rem;
		font-size: 1.0625rem;
		line-height: 1.6;
	}
	.hero-cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.75rem;
	}
	@media (max-width: 639px) {
		.hero-cta > :first-child {
			flex: 1 1 100%;
		}
		.hero-cta > :last-child {
			display: none;
		}
	}
	.hero-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem 2rem;
		margin-top: 2rem;
		padding-top: 1.25rem;
		border-top: 1px solid hsl(var(--border));
	}
	.hero-stats dd {
		font-size: 1.5rem;
		font-weight: 600;
		order: -1;
	}
	.hero-stats div {
		display: flex;
		flex-direction: column;
	}
	.hero-stats dt {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
	.frame {
		padding: 0.625rem;
		border-radius: calc(var(--radius) + 6px);
		background: #0b0c0e;
		box-shadow: var(--shadow-lg);
	}
	.frame-cap {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.375rem 0.125rem;
		font-size: 0.75rem;
		color: hsl(0 0% 100% / 0.6);
	}
	.frame-cap span:first-child {
		color: hsl(0 0% 100% / 0.9);
		font-weight: 600;
	}
	@media (max-width: 479px) {
		.frame-cap span:last-child {
			display: none;
		}
	}
	.exam-strip {
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
	}
	.exam-strip .chips {
		margin: 0;
		padding: 0;
		flex-wrap: wrap;
	}
	.sec {
		margin-top: clamp(2.5rem, 1.75rem + 3vw, 5rem);
	}
	.cats {
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 640px) {
		.cats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.cats {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	.cat {
		display: flex;
		flex-direction: column;
		padding: 1.25rem;
	}
	.cat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 44px;
	}
	.cat-head h3 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: 1.625rem;
		letter-spacing: -0.02em;
	}
	.cat-head :global(svg) {
		width: 20px;
		height: 20px;
		color: hsl(var(--primary));
	}
	.cat-desc {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}
	.cat-exams {
		margin: 0.75rem 0 1rem;
		border-top: 1px solid hsl(var(--border));
	}
	.cat-exams a {
		display: flex;
		align-items: center;
		min-height: 40px;
		font-size: 0.9375rem;
		font-weight: 500;
		border-bottom: 1px solid hsl(var(--border));
	}
	@media (max-width: 639px) {
		.cat {
			padding: 1rem;
		}
		.cat-exams {
			display: flex;
			flex-wrap: wrap;
			gap: 0.375rem;
			margin: 0.5rem 0 0.75rem;
			border-top: 0;
		}
		.cat-exams a {
			min-height: 36px;
			padding: 0 0.75rem;
			border: 1px solid hsl(var(--border));
			border-radius: 999px;
			font-size: 0.875rem;
		}
	}
	.cat-exams a:hover {
		color: hsl(var(--primary));
	}
	.cat-foot {
		margin-top: auto;
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
	.steps {
		display: grid;
		gap: 0;
		counter-reset: none;
	}
	@media (min-width: 768px) {
		.steps {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 1.5rem;
		}
	}
	.step {
		position: relative;
		display: flex;
		gap: 1rem;
		padding-bottom: 1.5rem;
	}
	@media (min-width: 768px) {
		.step {
			flex-direction: column;
		}
		.step:not(:last-child)::after {
			content: '';
			position: absolute;
			top: 22px;
			left: 56px;
			right: -0.75rem;
			border-top: 2px dotted hsl(var(--border));
		}
	}
	@media (max-width: 767px) {
		.step:not(:last-child)::after {
			content: '';
			position: absolute;
			left: 21px;
			top: 48px;
			bottom: 4px;
			border-left: 2px dotted hsl(var(--border));
		}
	}
	.bubble {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 2px solid hsl(var(--foreground));
		font-family: var(--font-mono);
		font-weight: 600;
		background: hsl(var(--surface));
	}
	.bubble.is-filled {
		background: hsl(var(--sun));
		border-color: hsl(var(--sun));
		color: #111;
	}
	.step h3 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		font-size: 1.25rem;
	}
	.step h3 span {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
	}
	.step p {
		margin-top: 0.25rem;
		font-size: 0.9375rem;
		color: hsl(var(--muted-foreground));
		max-width: 22rem;
	}
	.grid-3 {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 640px) {
		.grid-3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.grid-3 {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.people {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	@media (min-width: 1024px) {
		.people {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	.faq {
		max-width: 48rem;
		border-top: 1px solid hsl(var(--border));
	}
	.faq details {
		border-bottom: 1px solid hsl(var(--border));
	}
	.faq summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 56px;
		padding: 0.75rem 0;
		font-weight: 600;
		font-size: 1.0625rem;
		cursor: pointer;
		list-style: none;
	}
	.faq summary::-webkit-details-marker {
		display: none;
	}
	.faq summary::after {
		content: '+';
		font-family: var(--font-mono);
		font-size: 1.25rem;
		color: hsl(var(--primary));
	}
	.faq details[open] summary::after {
		content: '−';
	}
	.faq p {
		padding-bottom: 1rem;
		color: hsl(var(--muted-foreground));
		line-height: 1.65;
		max-width: 42rem;
	}
	.cta-band {
		position: relative;
		display: grid;
		gap: 1.25rem;
		padding: clamp(1.5rem, 1rem + 2vw, 2.75rem);
		border-radius: calc(var(--radius) + 6px);
		background: #0b0c0e;
		color: #fff;
		overflow: hidden;
	}
	@media (min-width: 900px) {
		.cta-band {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
		}
	}
	.cta-band :global(.cta-mark) {
		position: absolute;
		right: -1rem;
		top: -1.5rem;
		width: 9rem;
		height: 9rem;
		color: hsl(var(--sun) / 0.12);
	}
	.cta-band h2 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 800;
		font-size: clamp(1.625rem, 1.3rem + 1.3vw, 2.375rem);
		line-height: 1.1;
	}
	.cta-band p {
		margin-top: 0.375rem;
		color: hsl(0 0% 100% / 0.7);
	}
	.cta-actions {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.cta-ghost {
		background: hsl(0 0% 100% / 0.1);
		color: #fff;
	}
	.cta-ghost:hover {
		background: hsl(0 0% 100% / 0.16);
	}
	@media (max-width: 639px) {
		.cta-actions > :global(*) {
			flex: 1 1 auto;
		}
	}
</style>
