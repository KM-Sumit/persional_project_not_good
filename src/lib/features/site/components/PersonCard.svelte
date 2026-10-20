<script lang="ts">
	// Topper or faculty card: real photo when uploaded, else an initial on the saffron wash.
	let { name, photo, role, meta, quote }: { name: string; photo: string | null; role: string; meta?: string; quote?: string } = $props();
</script>

<article class="person card">
	{#if photo}<img src={photo} alt="" loading="lazy" width="88" height="88" />{:else}<span class="avatar" aria-hidden="true">{name[0]}</span>{/if}
	<h3>{name}</h3>
	<p class="role">{role}</p>
	{#if meta}<p class="tiny muted">{meta}</p>{/if}
	{#if quote}<p class="quote">{quote}</p>{/if}
</article>

<style>
	.person {
		padding: 1.25rem 1rem;
		text-align: center;
		height: 100%;
	}
	img,
	.avatar {
		width: 88px;
		height: 88px;
		margin: 0 auto 0.875rem;
		border-radius: 999px;
		object-fit: cover;
	}
	.avatar {
		display: grid;
		place-items: center;
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 2rem;
	}
	h3 {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 700;
		font-size: 1.1875rem;
	}
	.role {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--primary));
	}
	.quote {
		margin-top: 0.625rem;
		font-size: 0.875rem;
		line-height: 1.55;
		color: hsl(var(--muted-foreground));
	}
</style>
