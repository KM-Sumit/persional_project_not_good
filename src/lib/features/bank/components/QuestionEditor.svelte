<script lang="ts">
	// Add/edit one MCQ in a sheet: prompt, 2-6 options with the correct one as a filled OMR bubble,
	// explanation (markdown), topic, difficulty. Posts to `action` with use:enhance; extra hidden fields via `fields`.
	import { enhance } from '$app/forms';
	import { Plus, X } from '@lucide/svelte';
	import { Button, Sheet, toast } from '#lib/components/ui';
	import FileUpload from '#lib/components/kit/FileUpload.svelte';
	import MarkdownEditor from '#lib/components/kit/MarkdownEditor.svelte';
	import { LETTERS } from './format';

	type Q = {
		prompt: string;
		options: string[];
		promptHi?: string | null;
		optionsHi?: string[] | null;
		explanationHi?: string | null;
		correctIndex: number;
		explanation: string;
		topic: string;
		difficulty: string;
		imageFileId?: string | null;
	};
	let {
		open = $bindable(false),
		question = null,
		action,
		fields = {},
		title,
		submitLabel = 'Save question',
		children,
		onsaved,
		onlocal,
		image: withImage = true
	}: {
		open?: boolean;
		question?: Q | null;
		action: string;
		fields?: Record<string, string>;
		title?: string;
		submitLabel?: string;
		/** Extra form controls (e.g. marks) rendered above the buttons. */
		children?: import('svelte').Snippet;
		onsaved?: () => void;
		/** Local mode (wizard drafts): no request; the question is handed back. */
		onlocal?: (q: Q) => void;
		/** false hides the image field (and leaves any saved image untouched). */
		image?: boolean;
	} = $props();

	const blank = (): Q => ({
		prompt: '',
		options: ['', '', '', ''],
		promptHi: '',
		optionsHi: ['', '', '', ''],
		explanationHi: '',
		correctIndex: 0,
		explanation: '',
		topic: '',
		difficulty: 'medium'
	});
	let q = $state<Q>(blank());
	let busy = $state(false);
	const uid = $props.id();

	// Reset the draft each time the sheet opens.
	let image = $state<{ id: string; name: string; url: string } | null>(null);
	$effect(() => {
		if (!open) return;
		q = question
			? {
					...blank(),
					...question,
					options: [...question.options],
					promptHi: question.promptHi ?? '',
					optionsHi: question.options.map((_, i) => question.optionsHi?.[i] ?? ''),
					explanationHi: question.explanationHi ?? ''
				}
			: blank();
		image = question?.imageFileId ? { id: question.imageFileId, name: 'Current image', url: `/api/files/${question.imageFileId}` } : null;
	});

	function removeOption(i: number) {
		q.options.splice(i, 1);
		q.optionsHi?.splice(i, 1);
		if (q.correctIndex >= q.options.length) q.correctIndex = q.options.length - 1;
		else if (q.correctIndex > i) q.correctIndex--;
	}
</script>

{#snippet body()}
		<div class="field">
			<label class="label" for="{uid}-prompt">Question</label>
			<textarea id="{uid}-prompt" name="prompt" class="textarea" rows="3" required maxlength="5000" bind:value={q.prompt}></textarea>
		</div>

		<fieldset class="field">
			<legend class="label">Options <span class="opt">(tap the bubble of the correct one)</span></legend>
			<div class="stack-sm">
				{#each q.options as _, i (i)}
					<div class="opt-row">
						<label class="omr-pick" title="Mark {LETTERS[i]} correct">
							<input type="radio" name="correctIndex" value={i} checked={q.correctIndex === i} onchange={() => (q.correctIndex = i)} />
							<span class="omr-bubble" aria-hidden="true">{LETTERS[i]}</span>
							<span class="sr-only">Option {LETTERS[i]} is correct</span>
						</label>
						<input class="input" name="option" required maxlength="1000" aria-label="Option {LETTERS[i]}" bind:value={q.options[i]} />
						{#if q.options.length > 2}
							<button type="button" class="icon-btn icon-btn-sm" aria-label="Remove option {LETTERS[i]}" onclick={() => removeOption(i)}><X /></button>
						{/if}
					</div>
				{/each}
			</div>
			{#if q.options.length < 6}
				<button type="button" class="btn btn-ghost btn-sm self-start" onclick={() => (q.options.push(''), q.optionsHi?.push(''))}><Plus class="size-4" />Add option</button>
			{/if}
		</fieldset>

		<div class="field">
			<label class="label" for="{uid}-prompt-hi">Question in Hindi <span class="opt">(optional)</span></label>
			<textarea id="{uid}-prompt-hi" name="promptHi" class="textarea" rows="3" maxlength="5000" bind:value={q.promptHi}></textarea>
		</div>
		<fieldset class="field">
			<legend class="label">Options in Hindi <span class="opt">(optional, same order)</span></legend>
			<div class="stack-sm">
				{#each q.options as _, i (i)}
					<input class="input" name="optionHi" maxlength="1000" aria-label="Hindi option {LETTERS[i]}" bind:value={q.optionsHi![i]} />
				{/each}
			</div>
		</fieldset>
		<div class="field">
			<label class="label" for="{uid}-explain-hi">Explanation in Hindi <span class="opt">(optional)</span></label>
			<textarea id="{uid}-explain-hi" name="explanationHi" class="textarea" rows="3" maxlength="5000" bind:value={q.explanationHi}></textarea>
		</div>

		<div class="field">
			<span class="label">Explanation <span class="opt">(optional)</span></span>
			<MarkdownEditor bind:value={q.explanation} name="explanation" rows={4} placeholder="Why the answer is right. Markdown and $maths$ work." />
		</div>
		{#if withImage}<FileUpload accept="image" bind:value={image} name="imageFileId" label="Image (optional)" />{/if}
		<div class="form-row">
			<div class="field">
				<label class="label" for="{uid}-topic">Topic <span class="opt">(optional)</span></label>
				<input id="{uid}-topic" name="topic" class="input" maxlength="200" bind:value={q.topic} />
			</div>
			<div class="field">
				<label class="label" for="{uid}-diff">Difficulty</label>
				<select id="{uid}-diff" name="difficulty" class="select" bind:value={q.difficulty}>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</select>
			</div>
		</div>
		{@render children?.()}
		<div class="flex justify-end gap-2">
			<Button variant="ghost" type="button" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" loading={busy}>{submitLabel}</Button>
		</div>
{/snippet}

<Sheet bind:open title={title ?? (question ? 'Edit question' : 'New question')}>
	{#if onlocal}
		<form
			class="stack"
			onsubmit={(e) => {
				e.preventDefault();
				onlocal({ ...q, options: q.options.map((o) => o.trim()), imageFileId: image?.id ?? null });
				open = false;
			}}
		>
			{@render body()}
		</form>
	{:else}
		<form
			method="POST"
			{action}
			class="stack"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not save.'), 'error');
					else if (result.type === 'success' || result.type === 'redirect') {
						toast(question ? 'Question updated' : 'Question added');
						open = false;
						onsaved?.();
					}
					await update({ reset: false });
				};
			}}
		>
			{#each Object.entries(fields) as [k, v] (k)}<input type="hidden" name={k} value={v} />{/each}
			{@render body()}
		</form>
	{/if}
</Sheet>

<style>
	.opt-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.opt-row .input {
		flex: 1;
		min-width: 0;
	}
	.omr-pick {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		cursor: pointer;
	}
	.omr-pick input {
		position: absolute;
		opacity: 0;
		inset: 0;
		cursor: pointer;
	}
	.omr-pick .omr-bubble {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1.5px solid hsl(var(--input));
		font: 600 0.8rem var(--font-mono);
		color: hsl(var(--muted-foreground));
	}
	.omr-pick input:checked + .omr-bubble {
		background: hsl(var(--success));
		border-color: hsl(var(--success));
		color: hsl(var(--primary-foreground));
	}
	.omr-pick input:focus-visible + .omr-bubble {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
</style>
