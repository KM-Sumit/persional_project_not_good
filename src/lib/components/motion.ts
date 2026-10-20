/** Platform + navigation motion helpers for the study shell. */

export type Platform = 'ios' | 'android' | 'desktop';

/** Set by the inline script in app.html before first paint. */
export function platform(): Platform {
	if (typeof document === 'undefined') return 'desktop';
	return (document.documentElement.dataset.platform as Platform | undefined) ?? 'desktop';
}

export function reducedMotion(): boolean {
	if (typeof matchMedia === 'undefined') return false;
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Light haptic tick. Only some Android browsers implement vibrate. */
export function haptic(ms = 10): void {
	if (!reducedMotion()) navigator.vibrate?.(ms);
}

/** Bottom-tab root routes, in tab order. */
export const TAB_ROOTS = ['/home', '/tests', '/study', '/profile'] as const;

export type NavDirection = 'forward' | 'back' | 'tab-left' | 'tab-right';

function tabIndex(pathname: string): number {
	if (pathname === '/home') return 0;
	if (pathname === '/tests' || pathname.startsWith('/tests/') || pathname.startsWith('/attempts/'))
		return 1;
	if (
		pathname === '/study' ||
		pathname.startsWith('/study/') ||
		pathname.startsWith('/courses') ||
		pathname.startsWith('/notes')
	)
		return 2;
	if (pathname === '/profile' || pathname.startsWith('/profile/')) return 3;
	return -1;
}

/** Which page transition a navigation from → to should play. */
export function navDirection(
	from: string,
	to: string,
	opts: { pop?: number; back?: boolean }
): NavDirection {
	const a = tabIndex(from);
	const b = tabIndex(to);
	if (a >= 0 && b >= 0 && a !== b) return b > a ? 'tab-right' : 'tab-left';
	if ((opts.pop ?? 0) < 0 || opts.back) return 'back';
	return 'forward';
}
