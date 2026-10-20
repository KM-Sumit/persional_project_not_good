// Captures the browser's install prompt so the app can offer "Install" from its own UI.

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

/** Reactive: read canInstall.value in templates/effects. */
export const canInstall = $state({ value: false });

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as BeforeInstallPromptEvent;
		canInstall.value = true;
	});
	window.addEventListener('appinstalled', () => {
		deferred = null;
		canInstall.value = false;
	});
}

/** Shows the native install dialog. Resolves true if the user accepted. */
export async function installApp(): Promise<boolean> {
	if (!deferred) return false;
	const e = deferred;
	deferred = null;
	canInstall.value = false;
	await e.prompt();
	return (await e.userChoice).outcome === 'accepted';
}
