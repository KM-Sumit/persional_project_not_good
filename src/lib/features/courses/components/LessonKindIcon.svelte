<script lang="ts">
	import { FileText, PlayCircle, BookOpenText } from '@lucide/svelte';
	import type { LessonKind } from '#lib/features/courses/schema';

	let { kind, class: cls = 'size-4' }: { kind: LessonKind; class?: string } = $props();
	const Icon = $derived(kind === 'video' ? PlayCircle : kind === 'pdf' ? FileText : BookOpenText);
</script>

<Icon class={cls} aria-label={kind === 'video' ? 'Video' : kind === 'pdf' ? 'PDF' : 'Reading'} />
