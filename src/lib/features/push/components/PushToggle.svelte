<script lang="ts">
	// Notifications on/off for this device. States: unsupported (iOS needs Add to Home Screen first),
	// not configured, blocked in browser settings, off, on. Subscribing asks for permission on the tap.
	import { onMount } from 'svelte';
	import { BellOff } from '@lucide/svelte';
	import { Switch, toast } from '#lib/components/ui';

	type State = 'loading' | 'ios-install' | 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';
	let st = $state<State>('loading');
	let busy = $state(false);
	let on = $state(false);
	let publicKey: string | null = null;

	const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

	async function current() {
		return (await navigator.serviceWorker.ready).pushManager.getSubscription();
	}

	onMount(async () => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
			st = ios() && !standalone() ? 'ios-install' : 'unsupported';
			return;
		}
		publicKey = await fetch('/api/push')
			.then((r) => (r.ok ? r.json() : { publicKey: null }))
			.then((j: { publicKey: string | null }) => j.publicKey)
			.catch(() => null);
		if (!publicKey) return void (st = 'unavailable');
		if (Notification.permission === 'denied') return void (st = 'denied');
		const sub = await current().catch(() => null);
		on = Boolean(sub);
		st = on ? 'on' : 'off';
	});

	async function enable() {
		if ((await Notification.requestPermission()) !== 'granted') {
			st = Notification.permission === 'denied' ? 'denied' : 'off';
			on = false;
			return;
		}
		const reg = await navigator.serviceWorker.ready;
		const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey! }));
		const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
		if (!res.ok) throw new Error('Could not turn on notifications.');
		st = 'on';
		toast('Notifications on for this device');
	}

	async function disable() {
		const sub = await current();
		if (sub) {
			await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
			await sub.unsubscribe();
		}
		st = 'off';
		toast('Notifications off for this device');
	}

	async function change(next: boolean) {
		busy = true;
		try {
			await (next ? enable() : disable());
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Could not change notifications.', 'error');
		} finally {
			on = st === 'on';
			busy = false;
		}
	}

	const desc: Record<State, string> = {
		loading: 'Checking this device…',
		'ios-install': 'On iPhone, tap Share, then Add to Home Screen, and open UCI from there to turn this on.',
		unsupported: 'This browser cannot show notifications. Try Chrome, Edge or Firefox.',
		unavailable: 'Notifications are not available yet.',
		denied: 'Blocked in browser settings. Allow notifications for this site, then reload.',
		off: 'Live classes, new tests and answers to your doubts.',
		on: 'On for this device.'
	};
</script>

<div class="push-toggle">
	<Switch bind:checked={on} label="Notifications" description={desc[st]} disabled={busy || (st !== 'on' && st !== 'off')} onchange={change} />
	{#if st === 'denied'}<p class="hint"><BellOff class="size-4 shrink-0" />Site settings: tap the lock icon next to the address.</p>{/if}
</div>

<style>
	.hint {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0 1rem 0.75rem;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}
</style>
