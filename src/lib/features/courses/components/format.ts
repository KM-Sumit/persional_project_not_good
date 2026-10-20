// Display helpers for student screens (client-safe). Dates always in IST: the institute and its exams run on it.

export function duration(sec: number): string {
	if (!sec) return '';
	const m = Math.round(sec / 60);
	if (m < 60) return `${Math.max(1, m)} min`;
	return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

const ist = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o });
const whenFmt = ist({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayFmt = ist({ day: 'numeric', month: 'short', year: 'numeric' });

/** "Tue, 21 Oct, 10:00 am IST" */
export const when = (iso: string) => `${whenFmt.format(new Date(iso))} IST`;
/** "21 Oct 2026" */
export const day = (iso: string) => dayFmt.format(new Date(iso));

/** "3 h ago", "2 d ago", else a date. `now` comes from the server so SSR and hydration agree. */
export function ago(iso: string, now: string): string {
	const s = (Date.parse(now) - Date.parse(iso)) / 1000;
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
	if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
	return day(iso);
}
