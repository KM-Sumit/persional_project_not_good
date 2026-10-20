// Pure helpers shared by the tests hub, the attempt screen and the result page (client-safe).
import type { TestKind } from '../schema';

/** NTA/CBT palette states. Each one has its own colour AND shape (see Palette.svelte). */
export type QState = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

export function qState(a: { selected: number | null; marked: boolean } | undefined, visited: boolean): QState {
	const picked = a?.selected != null;
	if (a?.marked) return picked ? 'answered-marked' : 'marked';
	if (picked) return 'answered';
	return visited ? 'not-answered' : 'not-visited';
}

export const STATE_LABEL: Record<QState, string> = {
	answered: 'Answered',
	'not-answered': 'Not answered',
	'not-visited': 'Not visited',
	marked: 'Marked for review',
	'answered-marked': 'Answered and marked (will be scored)'
};
export const STATE_ORDER: QState[] = ['answered', 'not-answered', 'not-visited', 'marked', 'answered-marked'];

export function countStates(states: QState[]): Record<QState, number> {
	const c = { answered: 0, 'not-answered': 0, 'not-visited': 0, marked: 0, 'answered-marked': 0 } as Record<QState, number>;
	for (const s of states) c[s]++;
	return c;
}

/** 3725 -> "1:02:05", 125 -> "02:05". */
export function clock(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const KIND_LABEL: Record<TestKind, string> = { practice: 'Practice', mock: 'Mock test', pyq: 'PYQ', live: 'Live test', daily: 'Daily quiz' };

const IST = { timeZone: 'Asia/Kolkata' } as const;
/** "Tue 21 Oct, 10:00 AM" in IST. */
export const fmtWhen = (iso: string) =>
	new Date(iso).toLocaleString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' });
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));
export const minutes = (sec: number) => (sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`);
