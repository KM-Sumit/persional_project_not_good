<script lang="ts" module>
	const loaded: Record<string, ReturnType<typeof openPdf>> = {};

	function openPdf(url: string) {
		let pending = loaded[url];
		if (!pending) {
			pending = (async () => {
				const pdfjs = await import('pdfjs-dist');
				if (!pdfjs.GlobalWorkerOptions.workerSrc) {
					const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
					pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
				}
				return pdfjs.getDocument({ url, withCredentials: true }).promise;
			})();
			loaded[url] = pending;
		}
		return pending;
	}
</script>

<script lang="ts">
	// Draws one PDF page at a time. Phone browsers and the Android app cannot show a PDF
	// in a new tab, and drawing every page at once freezes the phone.
	let { src, title = 'PDF' }: { src: string; title?: string } = $props();

	let box = $state<HTMLDivElement>();
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let pageNo = $state(1);
	let total = $state(0);

	$effect(() => {
		const url = src;
		const root = box;
		const n = pageNo;
		if (!root) return;
		let cancel = false;
		status = 'loading';
		(async () => {
			const pdf = await openPdf(url);
			if (cancel) return;
			total = pdf.numPages;
			const page = await pdf.getPage(Math.min(n, pdf.numPages));
			if (cancel) return;
			const width = Math.max(root.clientWidth, 280);
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({ scale: (width / base.width) * ratio });
			const canvas = document.createElement('canvas');
			canvas.width = Math.floor(viewport.width);
			canvas.height = Math.floor(viewport.height);
			canvas.style.width = '100%';
			canvas.style.height = 'auto';
			await page.render({ canvas, viewport }).promise;
			if (cancel) return;
			root.replaceChildren(canvas);
			status = 'ready';
		})().catch(() => {
			if (!cancel) status = 'error';
		});
		return () => {
			cancel = true;
		};
	});
</script>

<div class="pdf-view">
	<div class="bar">
		<button type="button" class="btn btn-secondary btn-sm" disabled={pageNo <= 1 || status === 'loading'} onclick={() => (pageNo -= 1)}>Previous</button>
		<span class="small tabular">{total ? `Page ${pageNo} of ${total}` : title}</span>
		<button type="button" class="btn btn-secondary btn-sm" disabled={!total || pageNo >= total || status === 'loading'} onclick={() => (pageNo += 1)}>Next</button>
	</div>
	{#if status === 'loading'}<p class="muted small">Opening {title}…</p>{/if}
	{#if status === 'error'}
		<p class="error" role="alert">This PDF could not be opened in the app.</p>
	{/if}
	<div class="pages" bind:this={box} aria-label={title}></div>
</div>

<style>
	.pdf-view {
		display: grid;
		gap: 0.75rem;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pages :global(canvas) {
		background: white;
		border-radius: var(--radius);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
	}
</style>
