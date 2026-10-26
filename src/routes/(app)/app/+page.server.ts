import { listEnabledBanners } from '#lib/features/engage/server/service';
import { notesForUser } from '#lib/features/notes/server/service';
import { examMap } from '#lib/features/taxonomy/server/service';
import { catalog } from '#lib/features/tests/server/attempt';
import { nextLiveFor } from '#lib/features/live/server/service';
import { todayFor } from '#lib/features/posts/server/service';
import { getSettings } from '#lib/features/site/server/service';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

const DAY = 86_400_000;

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const exam = u.targetExamId;
	const [tests, notes, banners, exams, liveClass, daily, settings] = await Promise.all([
		catalog(u.id).catch(() => []),
		notesForUser(u, exam ? { examId: exam } : {}).catch(() => []),
		listEnabledBanners().catch(() => []),
		examMap(),
		nextLiveFor(u.id).catch(() => null),
		todayFor(u.id).catch(() => null),
		getSettings().catch(() => null)
	]);
	const now = Date.now();
	const mine = tests.filter((t) => !exam || !t.examId || t.examId === exam);
	const inProgress = tests.find((t) => t.inProgressAttemptId) ?? null;
	// Next scheduled test: upcoming first (soonest), else one whose window is open now.
	const scheduled = mine
		.filter((t) => t.startsAt && t.window !== 'ended' && t.attemptsUsed === 0)
		.sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
	const nextLive = scheduled.find((t) => t.window === 'upcoming') ?? scheduled[0] ?? null;
	const openNow = mine
		.filter((t) => t.window === 'live' && t.id !== nextLive?.id && t.id !== inProgress?.id && t.canStart !== false)
		.sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))
		.slice(0, 4);
	return {
		serverNow: new Date(now).toISOString(),
		firstName: u.name.split(/\s+/)[0] || 'there',
		examName: exam ? (exams.get(exam)?.name ?? null) : null,
		inProgress,
		nextLive,
		nextLiveSoon: !!nextLive?.startsAt && Date.parse(nextLive.startsAt) - now < DAY && Date.parse(nextLive.startsAt) > now,
		openNow,
		notes: notes.slice(0, 4),
		banners,
		liveClass,
		daily,
		connect: {
			youtube: settings?.socials?.youtube ?? null,
			instagram: settings?.socials?.instagram ?? null,
			facebook: settings?.socials?.facebook ?? null,
			whatsapp:
				settings?.socials?.whatsapp ??
				(settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}` : null)
		}
	};
};
