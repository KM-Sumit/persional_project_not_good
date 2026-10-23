<script lang="ts">
	// Image / PDF upload to POST /api/files with progress, preview and remove. Drop a file on the box or
	// pick one. Checks size and type before uploading (same rules the server enforces); the hidden input
	// `name` carries the file id for form actions.
	import { FileText, ImageUp, RotateCcw, Upload, Video, X } from '@lucide/svelte';
	import { UPLOAD_RULES, type FileDto } from '#lib/features/files/schema';

	interface Props {
		accept: 'image' | 'pdf' | 'video';
		value: FileDto | null;
		name?: string;
		label?: string;
	}
	let { accept, value = $bindable(null), name, label }: Props = $props();

	const rule = $derived(UPLOAD_RULES[accept]);
	const mimes = $derived(
		accept === 'image' ? 'image/*,.jpg,.jpeg,.png,.webp,.gif' : accept === 'video' ? 'video/*,.mp4,.webm,.mov' : 'application/pdf,.pdf'
	);
	const maxMb = $derived(rule.maxBytes / 1024 / 1024);
	const what = $derived(accept === 'image' ? 'JPEG, PNG, WebP or GIF' : accept === 'video' ? 'MP4 or WebM' : 'PDF');

	let input = $state<HTMLInputElement>();
	let progress = $state<number | null>(null);
	let error = $state('');
	let over = $state(false);
	let last = $state<File | null>(null);
	let xhr: XMLHttpRequest | null = null;
	const uid = $props.id();

	function start(file: File | undefined) {
		if (!file) return;
		error = '';
		// Phone camera often sends an empty type or image/jpg. The server checks the real bytes.
		const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
		const loose = !type || type === 'application/octet-stream' || (accept === 'image' && type.startsWith('image/')) || (accept === 'video' && type.startsWith('video/'));
		if (!rule.mimes[type] && !loose) return void (error = `Use a ${what} file.`);
		if (file.size > rule.maxBytes) return void (error = `That file is too large (max ${maxMb} MB).`);
		last = file;
		const data = new FormData();
		data.set('file', file);
		data.set('kind', accept);
		const req = new XMLHttpRequest();
		xhr = req;
		progress = 0;
		req.upload.onprogress = (e) => e.lengthComputable && (progress = Math.round((e.loaded / e.total) * 100));
		req.onload = () => {
			xhr = null;
			progress = null;
			let res: { message?: string } & Partial<FileDto> = {};
			try {
				res = JSON.parse(req.responseText);
			} catch {
				/* not JSON */
			}
			if (req.status >= 200 && req.status < 300 && res.id) value = { id: res.id, name: res.name ?? file.name, url: res.url ?? '' };
			else error = res.message ?? 'Upload failed. Try again.';
		};
		req.onerror = () => {
			xhr = null;
			progress = null;
			error = 'Upload failed. Check your connection and try again.';
		};
		req.open('POST', '/api/files');
		req.send(data);
	}

	function cancel() {
		xhr?.abort();
		xhr = null;
		progress = null;
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		over = false;
		start(e.dataTransfer?.files[0]);
	}
</script>

{#if name}<input type="hidden" {name} value={value?.id ?? ''} />{/if}
<div class="kit-upload">
	{#if label}<span class="label" id="{uid}-label">{label}</span>{/if}
	{#if value}
		<div class="kit-up-file">
			{#if accept === 'image'}
				<img src={value.url} alt="" class="kit-up-thumb" />
			{:else}
				<span class="leading-icon"><FileText /></span>
			{/if}
			<div class="min-w-0 flex-1">
				<a href={value.url} target="_blank" rel="noopener" class="kit-up-name">{value.name}</a>
				<p class="tiny muted">Uploaded</p>
			</div>
			<button type="button" class="icon-btn" aria-label="Remove {value.name}" onclick={() => ((value = null), (error = ''))}><X /></button>
		</div>
	{:else if progress != null}
		<div class="kit-up-file" aria-live="polite">
			<span class="leading-icon"><Upload /></span>
			<div class="min-w-0 flex-1">
				<p class="kit-up-name">{last?.name}</p>
				<div class="progress mt-2" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
					<span style:width="{progress}%"></span>
				</div>
			</div>
			<span class="font-mono tabular small">{progress}%</span>
			<button type="button" class="icon-btn" aria-label="Cancel upload" onclick={cancel}><X /></button>
		</div>
	{:else}
		<button
			type="button"
			class="kit-up-drop"
			class:is-over={over}
			aria-describedby="{uid}-help"
			aria-labelledby={label ? `${uid}-label` : undefined}
			onclick={() => input?.click()}
			ondragover={(e) => (e.preventDefault(), (over = true))}
			ondragleave={() => (over = false)}
			ondrop={drop}
		>
			{#if accept === 'image'}<ImageUp />{:else if accept === 'video'}<Video />{:else}<FileText />{/if}
			<span class="kit-up-cta">{accept === 'image' ? 'Upload a photo' : accept === 'video' ? 'Upload a video' : 'Upload a PDF'}</span>
			<span class="tiny muted" id="{uid}-help">{what}, up to {maxMb} MB. Drop it here or tap to choose.</span>
		</button>
		<input bind:this={input} type="file" accept={mimes} class="sr-only" tabindex="-1" aria-hidden="true" onchange={(e) => start(e.currentTarget.files?.[0])} />
	{/if}
	{#if error}
		<p class="error" role="alert">
			{error}
			{#if last && rule.mimes[last.type] && last.size <= rule.maxBytes}
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => start(last!)}><RotateCcw />Retry</button>
			{/if}
		</p>
	{/if}
</div>

<style>
	.kit-upload {
		min-width: 0;
	}
	.kit-up-drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 1.5rem 1rem;
		border: 1.5px dashed hsl(var(--input));
		border-radius: 14px;
		background: hsl(var(--surface));
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background-color 0.15s;
	}
	.kit-up-drop:hover,
	.kit-up-drop.is-over {
		border-color: hsl(var(--primary));
		background: hsl(var(--accent));
	}
	.kit-up-drop:focus-visible {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	.kit-up-drop :global(svg) {
		width: 24px;
		height: 24px;
		color: hsl(var(--muted-foreground));
	}
	.kit-up-cta {
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.kit-up-file {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.5rem 0.625rem 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 14px;
		background: hsl(var(--surface));
		min-width: 0;
	}
	.kit-up-thumb {
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: 10px;
		background: hsl(var(--muted));
		flex-shrink: 0;
	}
	.kit-up-name {
		display: block;
		font-weight: 600;
		font-size: 0.9375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.kit-up-name:hover {
		text-decoration: underline;
	}
</style>
