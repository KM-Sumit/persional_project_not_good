// use:enhance callback for staff editors: success toast, error toast with the server's message, keep form values.
import { applyAction, deserialize, type SubmitFunction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { toast } from '#lib/components/ui';

export const withToast =
	(success: string | null, after?: () => void, busy?: (on: boolean) => void): SubmitFunction =>
	() => {
		busy?.(true);
		return async ({ result, update }) => {
		if (result.type === 'failure') toast(String(result.data?.message ?? 'Could not save.'), 'error');
		else if (result.type === 'error') toast(result.error?.message ?? 'Something went wrong.', 'error');
		else if (result.type === 'success') {
			if (success) toast(String(result.data?.message ?? success));
			after?.();
		}
		await update({ reset: false });
			busy?.(false);
		};
	};

/** POST a form action from code (drag reorder, up/down). Returns true on success. */
export async function postAction(action: string, fields: Record<string, string>): Promise<boolean> {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	const res = await fetch(action, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
	const result = deserialize(await res.text());
	if (result.type === 'success') {
		await invalidateAll();
		return true;
	}
	if (result.type === 'redirect') await applyAction(result);
	else toast(result.type === 'failure' ? String(result.data?.message ?? 'Could not save.') : 'Something went wrong.', 'error');
	await invalidateAll();
	return false;
}
