<script lang="ts">
	import { PageHeader } from '#lib/components/ui';
	import Seo from '#lib/features/site/components/Seo.svelte';
	import { LEGAL, LEGAL_SLUGS, LEGAL_UPDATED } from '#lib/features/site/components/legal';
	import { real } from '#lib/features/site/components/format';

	let { data } = $props();
	const d = $derived(data.doc);
	const st = $derived(data.site.settings);
	const crumbs = [{ href: '/', label: 'Home' }];
	const updated = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(LEGAL_UPDATED));
</script>

<Seo title={d.title} description={d.summary} crumbs={[...crumbs, { href: `/legal/${data.slug}`, label: d.title }]} />

<div class="page-narrow site-page">
	<PageHeader title={d.title} subtitle="Last updated {updated}" {crumbs} />
	<nav class="chips legal-nav" aria-label="Legal pages">
		{#each LEGAL_SLUGS as s (s)}
			<a href="/legal/{s}" class="chip" aria-current={s === data.slug ? 'true' : undefined}>{LEGAL[s].title}</a>
		{/each}
	</nav>
	<p class="intro">{d.intro}</p>
	<ol class="secs">
		{#each d.sections as s, i (s.title)}
			<li>
				<h2><span class="n font-mono tabular">{i + 1}.</span>{s.title}</h2>
				{#each s.body as p, j (j)}<p>{p}</p>{/each}
			</li>
		{/each}
		<li>
			<h2><span class="n font-mono tabular">{d.sections.length + 1}.</span>Grievance officer</h2>
			<p>Questions, complaints and requests about this policy go to the Grievance Officer, Upendra Competition Institute.</p>
			<dl class="contact">
				{#if st.email}<div><dt>Email</dt><dd><a href="mailto:{st.email}">{st.email}</a></dd></div>{/if}
				{#if st.contactPhone}<div><dt>Phone</dt><dd><a href="tel:{st.contactPhone}">{st.contactPhone}</a></dd></div>{/if}
				{#if real(st.address)}<div><dt>Address</dt><dd>{real(st.address)}</dd></div>{/if}
				{#if !st.email && !st.contactPhone}<div><dt>Contact</dt><dd>Use the <a href="/contact">contact page</a>.</dd></div>{/if}
			</dl>
			<p>We acknowledge complaints within 24 hours and resolve them within 15 days.</p>
		</li>
	</ol>
</div>

<style>
	.site-page { padding-top: clamp(1.25rem, 1rem + 1.5vw, 2.5rem); }
	.legal-nav { margin-bottom: 1.5rem; }
	.intro { font-size: 1.0625rem; line-height: 1.7; }
	.secs { margin-top: 2rem; display: grid; gap: 2rem; }
	h2 { display: flex; gap: 0.5rem; font-family: var(--font-display); font-stretch: var(--display-stretch); font-weight: 700; font-size: 1.25rem; margin-bottom: 0.5rem; }
	.n { color: hsl(var(--primary)); font-weight: 600; font-size: 1rem; padding-top: 0.15rem; }
	.secs p { color: hsl(var(--muted-foreground)); line-height: 1.7; }
	.secs p + p { margin-top: 0.625rem; }
	.contact { margin: 0.75rem 0; padding: 1rem; border: 1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--surface)); display: grid; gap: 0.5rem; }
	.contact div { display: flex; gap: 1rem; }
	.contact dt { width: 5rem; flex-shrink: 0; font-size: 0.875rem; color: hsl(var(--muted-foreground)); }
	.contact dd { min-width: 0; overflow-wrap: anywhere; }
	.contact a { text-decoration: underline; }
</style>
