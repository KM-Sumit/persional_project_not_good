// Pure exam rules (no DB): windows, deadlines, lockout, scoring, rank. Unit-tested in scoring.test.ts.
import type { TestKind, WindowState } from '../schema';

/** After the soft deadline the server still accepts saves/submit this long (slow phones, reconnects). */
export const GRACE_MS = 3 * 60_000;
export const LOCK_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const pct = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : 0);

/** Window from optional startsAt/endsAt: tests with no window are always live. */
export function windowState(t: { startsAt: Date | string | null; endsAt: Date | string | null }, now = new Date()): WindowState {
	const ms = now.getTime();
	if (t.startsAt && new Date(t.startsAt).getTime() > ms) return 'upcoming';
	if (t.endsAt && new Date(t.endsAt).getTime() <= ms) return 'ended';
	return 'live';
}

/** Late joiners of a windowed test only get the time left until it closes. */
export const attemptDeadline = (start: Date, durationMin: number, endsAt: Date | null) =>
	new Date(Math.min(start.getTime() + durationMin * 60_000, endsAt ? endsAt.getTime() : Infinity));

export const pastHardDeadline = (deadline: Date, now = new Date()) => now.getTime() >= deadline.getTime() + GRACE_MS;

/** Live tests always allow exactly one attempt; null = unlimited. */
export const effectiveMaxAttempts = (kind: TestKind, maxAttempts: number | null) => (kind === 'live' ? 1 : maxAttempts);

/** Next lockout row after one more wrong password. Reaching the limit locks and restarts the count. */
export function afterFailure(prev: { failures: number; lockedUntil: Date | null } | undefined, now = new Date()) {
	const failures = (prev?.failures ?? 0) + 1;
	return failures >= LOCK_FAILURES
		? { failures: 0, lockedUntil: new Date(now.getTime() + LOCK_MS), locked: true, left: 0 }
		: { failures, lockedUntil: null, locked: false, left: LOCK_FAILURES - failures };
}

export type ScoreItem = { marks: number; negativeMarks: number; correctIndex: number; selected: number | null | undefined };
export type ScoreOutcome = 'correct' | 'wrong' | 'skipped';
export const outcomeOf = (i: Pick<ScoreItem, 'correctIndex' | 'selected'>): ScoreOutcome =>
	i.selected == null ? 'skipped' : i.selected === i.correctIndex ? 'correct' : 'wrong';

/** +marks for correct, -negativeMarks for wrong, 0 for skipped; total clamped at 0. */
export function scoreAttempt(items: ScoreItem[]) {
	let raw = 0;
	let maxScore = 0;
	let correct = 0;
	let wrong = 0;
	let skipped = 0;
	for (const i of items) {
		maxScore += i.marks;
		const o = outcomeOf(i);
		if (o === 'correct') (raw += i.marks), correct++;
		else if (o === 'wrong') (raw -= i.negativeMarks), wrong++;
		else skipped++;
	}
	return { score: round2(Math.max(0, raw)), maxScore: round2(maxScore), correct, wrong, skipped };
}

/** Competition rank among others' first attempts; percentile = share of others scoring at most yours. */
export function rankFrom(others: { total: number; higher: number }) {
	return {
		rank: others.higher + 1,
		participants: others.total + 1,
		percentile: others.total ? round1(((others.total - others.higher) / others.total) * 100) : 100
	};
}

export function median(nums: number[]): number | null {
	if (!nums.length) return null;
	const s = [...nums].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : round2((s[m - 1] + s[m]) / 2);
}

const rand = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
export function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = rand(i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** 8 chars, no look-alikes (0/O, 1/l/I), easy to read out in class. */
export function generatePassword() {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
	return Array.from({ length: 8 }, () => alphabet[rand(alphabet.length)]).join('');
}
