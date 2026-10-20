// Client-safe post helpers (no zod): IST dates, the 14-day strip, streaks, labels.

export type PostKind = 'current_affairs' | 'job_alert' | 'syllabus' | 'announcement';
export const POST_KINDS: PostKind[] = ['current_affairs', 'job_alert', 'syllabus', 'announcement'];
export const kindLabel: Record<PostKind, string> = {
	current_affairs: 'Current affairs',
	job_alert: 'Job alert',
	syllabus: 'Syllabus',
	announcement: 'Announcement'
};

const DAY = 86_400_000;
const IST = 5.5 * 3_600_000;

/** YYYY-MM-DD of `d` in India time. */
export const istDate = (d: Date = new Date()) => new Date(d.getTime() + IST).toISOString().slice(0, 10);

/** The calendar day `n` days before `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export const daysBefore = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') - n * DAY).toISOString().slice(0, 10);

/** The last `n` days ending at `today`, oldest first. */
export const lastDays = (today: string, n = 14) => Array.from({ length: n }, (_, i) => daysBefore(today, n - 1 - i));

/** Consecutive days with activity, ending today; a streak whose last day is yesterday is still alive (today not done yet). */
export function streakFrom(days: Iterable<string>, today: string): number {
	const set = new Set(days);
	let d = set.has(today) ? today : daysBefore(today, 1);
	let n = 0;
	while (set.has(d)) {
		n++;
		d = daysBefore(d, 1);
	}
	return n;
}

export const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** "Tue 21 Oct 2026" (dates are calendar days, so format in UTC to avoid shifting). */
export const fmtDay = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
	new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' });
