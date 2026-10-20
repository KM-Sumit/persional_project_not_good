import { fail } from '@sveltejs/kit';
import { archiveTest, listTests, publishTest, unpublishTest } from '#lib/features/tests/server/service';
import { listSessions } from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { idsFrom } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import { testAccessEnum, testKindEnum, type TestListQuery } from '#lib/features/tests/schema';
import type { Actions, PageServerLoad } from './$types';

const TABS = ['all', 'live', 'published', 'draft', 'archived'] as const;

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const sp = event.url.searchParams;
	const sessions = await listSessions();
	const current = sessions.find((s) => s.isCurrent);
	const sessionParam = sp.get('session');
	const sessionId = sessionParam === 'all' ? undefined : (sessions.find((s) => s.id === sessionParam) ?? current)?.id;
	const tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as (typeof TABS)[number]) : 'all';
	const kind = testKindEnum.safeParse(sp.get('kind')).data;
	const access = testAccessEnum.safeParse(sp.get('access')).data;
	const examId = /^[0-9a-f-]{36}$/i.test(sp.get('exam') ?? '') ? sp.get('exam')! : undefined;
	const base: TestListQuery = { sessionId, access, examId, kind, q: sp.get('q')?.trim() || undefined };
	const query: TestListQuery = {
		...base,
		...(tab === 'live' ? { status: 'published', kind: 'live' } : tab === 'all' ? {} : { status: tab }),
		cursor: sp.get('cursor'),
		limit: 30
	};
	// "Live & upcoming" = published live tests; its count needs the kind-scoped tally.
	const [list, liveTally, taxonomy] = await Promise.all([
		listTests(query),
		kind && kind !== 'live' ? null : listTests({ ...base, kind: 'live', limit: 1 }),
		tree()
	]);
	return {
		list,
		liveCount: liveTally?.counts.published ?? 0,
		taxonomy,
		sessions,
		sessionId: sessionParam === 'all' ? 'all' : (sessionId ?? 'all'),
		tab
	};
};

const bulk = (fn: (id: string) => Promise<unknown>, verb: string) => async (event: Parameters<Actions[string]>[0]) => {
	requireStaff(event);
	const ids = idsFrom(await event.request.formData());
	const errors: string[] = [];
	for (const id of ids) await fn(id).catch((e: Error) => errors.push(e.message));
	const ok = ids.length - errors.length;
	if (errors.length) return fail(422, { message: `${ok} ${verb}. ${errors.length} skipped: ${errors[0]}` });
	return { message: `${ok} ${ok === 1 ? 'test' : 'tests'} ${verb}` };
};

export const actions: Actions = {
	publish: bulk(publishTest, 'published'),
	unpublish: bulk(unpublishTest, 'moved to drafts'),
	archive: bulk(archiveTest, 'archived')
};
