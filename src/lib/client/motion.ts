// Which page transition a navigation plays. The root layout sets it as data-nav on its .page-view wrapper;
// app.css animates per platform (iOS push/pop, Android fade-through, desktop fade).
export type NavDirection = 'forward' | 'back' | 'tab-left' | 'tab-right';

/** Pure. `tabs` = the bottom-tab hrefs in order; moving between two of them is a tab switch. */
export function navDirection(
	from: string,
	to: string,
	tabs: readonly string[],
	opts: { pop?: number; back?: boolean } = {}
): NavDirection {
	const a = tabs.indexOf(from);
	const b = tabs.indexOf(to);
	if (a >= 0 && b >= 0) return b > a ? 'tab-right' : 'tab-left';
	if ((opts.pop ?? 0) < 0 || opts.back) return 'back';
	// Going up the tree (e.g. /teacher/quizzes/5 -> /teacher/quizzes) reads as back too.
	if (from.startsWith(to + '/')) return 'back';
	return 'forward';
}
