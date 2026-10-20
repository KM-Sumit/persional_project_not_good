<script lang="ts">
	import { page } from '$app/state';
</script>

<main class="page">
	<h1 class="page-title">{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="text-muted">
		{page.status === 404 ? 'That page is not here.' : 'Something went wrong. Go back and try again.'}
	</p>
	<a class="btn" href="/">Home</a>
</main>

<style>
	h1 {
		margin: 2.5rem 0 0.5rem;
		font-size: 1.75rem;
	}

	p {
		margin-bottom: 1.5rem;
	}

	a {
		width: 100%;
	}
</style>
