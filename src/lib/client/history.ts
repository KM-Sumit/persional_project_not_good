// Opt-in "smart back": return to the screen the user actually came from (like a native app) and fall back
// to the parent href when there is no in-app history (deep link, reload, new tab).
// Usage: <a href="/teacher/quizzes" data-back onclick={(e) => goBack(e, '/teacher/quizzes')}>Back</a>
import { goto } from '$app/navigation';

let depth = 0;
let length = 0;

/** Called by the root layout's afterNavigate. */
export function trackNavigation(type: string, delta?: number) {
	if (type === 'enter') depth = 0;
	else if (type === 'popstate') depth = Math.max(0, depth + (delta ?? -1));
	else if ((type === 'link' || type === 'goto' || type === 'form') && history.length > length) depth++;
	length = history.length;
}

type NavApi = { currentEntry: { index: number } | null };
const entry = () => (globalThis as { navigation?: NavApi }).navigation?.currentEntry;

export const canGoBack = () => {
	const e = entry();
	return e ? e.index > 0 : depth > 0;
};

export function goBack(e: MouseEvent, fallback: string) {
	if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // keep "open in new tab"
	e.preventDefault();
	if (canGoBack()) history.back();
	else goto(fallback, { replaceState: true });
}
