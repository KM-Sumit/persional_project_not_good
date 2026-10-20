// Display helpers shared by the staff tests + bank screens. Times are always shown in IST.
const ist = new Intl.DateTimeFormat('en-IN', {
	timeZone: 'Asia/Kolkata',
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	hour: 'numeric',
	minute: '2-digit'
});
export const fmtIST = (iso: string | null | undefined) => (iso ? `${ist.format(new Date(iso))} IST` : '');

const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDay = (iso: string | null | undefined) => (iso ? day.format(new Date(iso)) : '');

export const kindLabel = { practice: 'Practice', mock: 'Mock', pyq: 'PYQ', live: 'Live', daily: 'Daily quiz' } as const;
export const accessLabel = { open: 'Open', password: 'Password', paid: 'Paid' } as const;
export const statusTone = { draft: 'draft', published: 'success', cancelled: 'danger', archived: 'closed' } as const;
export const difficultyLabel = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
export const LETTERS = 'ABCDEF';

export const fmtDuration = (sec: number | null | undefined) => {
	if (sec == null) return '';
	const m = Math.floor(sec / 60);
	return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${sec % 60}s`;
};
