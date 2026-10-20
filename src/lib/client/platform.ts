// Platform + haptics. data-platform is set on <html> by the inline script in app.html before first paint,
// so CSS can branch on :root[data-platform='ios' | 'android' | 'desktop'] with no flash.
export type Platform = 'ios' | 'android' | 'desktop';

export function platform(): Platform {
	if (typeof document === 'undefined') return 'desktop';
	return (document.documentElement.dataset.platform as Platform | undefined) ?? 'desktop';
}

export function reducedMotion(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Light haptic tick (10ms). Only Android browsers implement vibrate; elsewhere a silent no-op. */
export function haptic(ms = 10): void {
	if (typeof navigator !== 'undefined' && !reducedMotion()) navigator.vibrate?.(ms);
}
