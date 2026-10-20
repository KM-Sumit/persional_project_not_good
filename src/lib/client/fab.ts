// The one floating action button (rendered by src/routes/+layout.svelte). A page sets what it does:
//   $effect(() => setFab({ label: 'New batch', onclick: () => (creating = true) }));
// The returned cleanup clears it when the page goes away, so it never leaks to the next screen.
// Without a page FAB, /teacher and /teacher/quizzes default to "New quiz".
import { writable } from 'svelte/store';
import type { Component } from 'svelte';

export type Fab = { label: string; href?: string; onclick?: () => void; icon?: Component<{ class?: string }> };

export const fab = writable<Fab | null>(null);

export function setFab(f: Fab): () => void {
	fab.set(f);
	return () => fab.update((cur) => (cur === f ? null : cur));
}
