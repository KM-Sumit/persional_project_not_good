// Live classes: client-safe pure helpers (no zod, no server imports). Pages import these at runtime.
import type { LiveClassDTO, LiveStatus, Timetable } from './schema';

// India Standard Time is UTC+05:30 all year (no DST), so offset math is exact.
const IST = 330 * 60_000;
const DAY = 86_400_000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Allowed status moves. Ending also works straight from scheduled (teacher streamed without pressing Go live). */
const MOVES: Record<LiveStatus, LiveStatus[]> = {
	scheduled: ['live', 'ended', 'cancelled'],
	live: ['ended', 'scheduled'],
	ended: [],
	cancelled: ['scheduled']
};
export const canMove = (from: LiveStatus, to: LiveStatus) => MOVES[from].includes(to);

/** IST calendar day as a sortable number, e.g. 20261021. */
export function istDay(iso: string | number): number {
	const t = new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + IST);
	return t.getUTCFullYear() * 10_000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
}
const dayStart = (key: number) => Date.UTC(Math.floor(key / 10_000), (Math.floor(key / 100) % 100) - 1, key % 100) - IST;

/** "10:00 AM" in IST. */
export function istTime(iso: string): string {
	const t = new Date(Date.parse(iso) + IST);
	const h = t.getUTCHours();
	return `${h % 12 || 12}:${String(t.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "Tue 21 Oct". */
export function istDate(iso: string): string {
	const t = new Date(Date.parse(iso) + IST);
	return `${DAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
}
/** "Today", "Tomorrow" or "Tue 21 Oct", relative to `now`. */
export function dayLabel(iso: string, now = Date.now()): string {
	const d = istDay(iso);
	if (d === istDay(now)) return 'Today';
	if (d === istDay(now + DAY)) return 'Tomorrow';
	return istDate(iso);
}

/** Scheduled classes stay on the timetable this long past their end (teacher running late). */
export const STALE_MS = 60 * 60_000;

/**
 * Student timetable: live now, the rest of today, the next 6 days by IST date, and recordings (newest first).
 * Cancelled classes show only on their own day so students see the change.
 */
export function groupTimetable(classes: LiveClassDTO[], now = Date.now()): Timetable {
	const today = istDay(now);
	const weekEnd = dayStart(today) + 7 * DAY;
	const out: Timetable = { live: [], today: [], week: [], recordings: [] };
	const byDay = new Map<number, LiveClassDTO[]>();
	for (const c of [...classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
		const start = Date.parse(c.startsAt);
		if (c.status === 'live') out.live.push(c);
		else if (c.status === 'ended') {
			if (c.youtubeId) out.recordings.push(c);
		} else if (c.status === 'cancelled' || Date.parse(c.endsAt) + STALE_MS > now) {
			const d = istDay(start);
			if (d === today) out.today.push(c);
			else if (d > today && start < weekEnd && c.status === 'scheduled') byDay.set(d, [...(byDay.get(d) ?? []), c]);
		}
	}
	out.week = [...byDay].map(([key, items]) => ({ key, label: dayLabel(items[0]!.startsAt, now), items }));
	out.recordings.reverse();
	return out;
}

/** Batch visibility: staff see everything; a class with no batch is for everyone. */
export const visibleTo = (c: { batchId: string | null }, v: { staff: boolean; batchIds: readonly string[] }) =>
	v.staff || c.batchId === null || v.batchIds.includes(c.batchId);
