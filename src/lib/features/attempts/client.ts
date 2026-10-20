export async function saveAnswer(attemptId: string, questionId: string, selectedIndex: number): Promise<void> {
	let response: Response;
	try {
		response = await fetch(`/api/attempts/${attemptId}/answers`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			body: JSON.stringify({ questionId, selectedIndex })
		});
	} catch {
		throw new Error('Could not save that answer.');
	}
	if (response.ok) return;
	const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
	throw new Error(typeof data?.message === 'string' ? data.message : 'Could not save that answer.');
}
