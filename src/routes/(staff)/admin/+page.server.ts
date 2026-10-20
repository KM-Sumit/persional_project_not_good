import { openCount } from '#lib/features/doubts/server/service';
import { requireStaff } from '#lib/server/http';
import { listPeople } from '#lib/features/people/server/service';
import { listTests, participants } from '#lib/features/tests/server/service';
import { listLeads } from '#lib/features/site/server/service';
import { currentSession } from '#lib/features/cohorts/server/service';
import type { PageServerLoad } from './$types';

const DAY = 86_400_000;
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const now = Date.now();
	// ponytail: KPIs are derived from capped service pages (200 students, 50 tests, 100 leads) and show "200+"
	// when the cap is hit; swap for a count-only overview service when numbers outgrow the caps.
	const [students, active, published, drafts, newLeads, session] = await Promise.all([
		listPeople({ role: 'student', limit: 200 }),
		listPeople({ role: 'student', sort: 'active', limit: 200 }),
		listTests({ status: 'published', limit: 50 }),
		listTests({ status: 'draft', limit: 50 }),
		listLeads({ status: 'new', limit: 100 }),
		currentSession()
	]);

	const weekAgo = now - 7 * DAY;
	const activeWeek = active.items.filter((p) => p.lastSeenAt && Date.parse(p.lastSeenAt) >= weekAgo).length;
	const live = published.items.filter((t) => t.window === 'live');
	const upcoming = published.items
		.filter((t) => t.window === 'upcoming' && t.startsAt)
		.sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))
		.slice(0, 6);

	// Recent results + scoreboard: the six most recent published tests that have attempts.
	const withAttempts = published.items.filter((t) => t.attemptCount > 0).slice(0, 6);
	const parts = await Promise.all(withAttempts.map(async (t) => ({ test: t, rows: await participants(t.id) })));
	const today = istDay(new Date(now).toISOString());
	let attemptsToday = 0;
	const recent: { attemptId: string; userId: string; name: string; email: string; test: string; testId: string; score: number | null; maxScore: number | null; percentage: number | null; at: string }[] = [];
	for (const { test, rows } of parts)
		for (const r of rows) {
			if (istDay(r.startedAt) === today) attemptsToday++;
			if (r.status !== 'in_progress')
				recent.push({ attemptId: r.attemptId, userId: r.userId, name: r.name, email: r.email, test: test.title, testId: test.id, score: r.score, maxScore: r.maxScore, percentage: r.percentage, at: r.submittedAt ?? r.startedAt });
		}
	recent.sort((a, b) => b.at.localeCompare(a.at));
	const scoreboard = parts.map(({ test, rows }) => ({
		testId: test.id,
		title: test.title,
		rows: rows
			.filter((r) => r.status !== 'in_progress' && r.percentage != null)
			.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
			.slice(0, 5)
			.map((r) => ({ userId: r.userId, name: r.name, score: r.score, maxScore: r.maxScore, percentage: r.percentage }))
	}));

	const plus = (n: number, more: boolean) => (more ? `${n}+` : String(n));
	return {
		session,
		kpis: {
			students: plus(students.items.length, !!students.nextCursor),
			activeWeek: plus(activeWeek, !!active.nextCursor && activeWeek === active.items.length),
			live: live.length,
			upcoming: published.items.filter((t) => t.window === 'upcoming').length,
			attemptsToday,
			newLeads: plus(newLeads.items.length, !!newLeads.next)
		},
		live,
		upcoming,
		recent: recent.slice(0, 20),
		scoreboard,
		attention: {
			emptyDrafts: drafts.items.filter((t) => t.questionCount === 0).slice(0, 5),
			drafts: drafts.counts.draft,
			oldLeads: newLeads.items.filter((l) => now - Date.parse(l.createdAt) > DAY).length,
			newLeads: newLeads.items.length,
			openDoubts: await openCount().catch(() => 0)
		}
	};
};
