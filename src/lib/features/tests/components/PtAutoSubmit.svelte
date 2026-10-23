<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { attempt, serverNow }: { attempt: { attemptId: string; testId: string; deadlineAt: string } | null; serverNow: string } = $props();

	$effect(() => {
		const current = attempt;
		if (!current) return;
		const attemptId = current.attemptId;
		const offset = new Date(serverNow).getTime() - Date.now();
		const deadline = new Date(current.deadlineAt).getTime();
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function fire() {
			if (cancelled) return;
			const left = deadline - (Date.now() + offset);
			if (left > 250) {
				timer = setTimeout(() => void fire(), left);
				return;
			}
			cancelled = true;
			const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: 'POST' }).catch(() => null);
			if (!res || (res.status !== 200 && res.status !== 409)) return;
			const onPaper = page.url.pathname.includes(`/attempt/${attemptId}`);
			if (onPaper) await goto(`/app/results/${attemptId}`, { replaceState: true, invalidateAll: true });
			else await invalidateAll();
		}

		const wait = deadline - (Date.now() + offset);
		if (wait <= 0) void fire();
		else timer = setTimeout(() => void fire(), wait);

		const onVis = () => {
			if (document.visibilityState === 'visible' && Date.now() + offset >= deadline) void fire();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>
