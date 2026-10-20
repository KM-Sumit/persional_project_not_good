export type Toast = { id: number; message: string; tone: 'success' | 'error' | 'warning' };

export const toasts = $state<Toast[]>([]);
let seq = 0;

export function toast(message: string, tone: Toast['tone'] = 'success', ms = 3500) {
	const id = ++seq;
	toasts.push({ id, message, tone });
	setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number) {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}
