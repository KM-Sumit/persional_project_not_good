// use:enhance callback that toasts the action's message (or its failure) and refreshes page data.
import type { enhance } from '$app/forms';

type SubmitFunction = NonNullable<Parameters<typeof enhance>[1]>;
import { toast } from '#lib/components/ui';

export function toasting(after?: (data: Record<string, unknown> | undefined) => void, opts: { reset?: boolean } = {}): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			if (result.type === 'failure') toast(String(result.data?.message ?? 'Something went wrong.'), 'error');
			else if (result.type === 'error') toast(result.error?.message ?? 'Something went wrong.', 'error');
			else if (result.type === 'success' && result.data?.message) toast(String(result.data.message));
			await update({ reset: opts.reset ?? true });
			if (result.type === 'success') after?.(result.data);
		};
}
