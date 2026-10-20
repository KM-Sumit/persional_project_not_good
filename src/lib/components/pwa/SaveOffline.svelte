<script lang="ts">
	// "Save offline" toggle for a note page (kind 'note', id = slug) or its PDF (kind 'file', id = file id).
	import { onMount } from 'svelte';
	import { CircleCheck, CloudDownload, LoaderCircle } from '@lucide/svelte';
	import { toast } from '#lib/components/ui';
	import { isSaved, offlineSupported, removeSaved, saveOffline, savedUrl, type SavedKind } from './offline';

	let { kind, id, title, label = kind === 'file' ? 'Save PDF offline' : 'Save offline', class: cls = 'btn btn-secondary' }: { kind: SavedKind; id: string; title: string; label?: string; class?: string } = $props();

	let supported = $state(false);
	let saved = $state(false);
	let busy = $state(false);

	onMount(async () => {
		supported = offlineSupported();
		saved = await isSaved(kind, id).catch(() => false);
	});

	async function toggle() {
		busy = true;
		try {
			if (saved) {
				await removeSaved(savedUrl(kind, id));
				saved = false;
				toast('Removed from downloads');
			} else {
				await saveOffline(kind, id, title);
				saved = true;
				toast('Saved for offline reading');
			}
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Could not save. Try again.', 'error');
		} finally {
			busy = false;
		}
	}
</script>

{#if supported}
	<button type="button" class={cls} onclick={toggle} disabled={busy} aria-pressed={saved}>
		{#if busy}<LoaderCircle class="animate-spin" />{:else if saved}<CircleCheck />{:else}<CloudDownload />{/if}
		{saved ? 'Saved offline' : label}
	</button>
{/if}
