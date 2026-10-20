import { describe, expect, test } from 'bun:test';
import {
	GRACE_MS,
	LOCK_MS,
	afterFailure,
	attemptDeadline,
	effectiveMaxAttempts,
	generatePassword,
	median,
	pastHardDeadline,
	rankFrom,
	scoreAttempt,
	windowState
} from './scoring';

describe('scoreAttempt', () => {
	const q = (selected: number | null, marks = 2, negativeMarks = 0.5) => ({ marks, negativeMarks, correctIndex: 1, selected });
	test('correct adds marks, wrong subtracts negatives, skipped is 0', () => {
		expect(scoreAttempt([q(1), q(1), q(0), q(null)])).toEqual({ score: 3.5, maxScore: 8, correct: 2, wrong: 1, skipped: 1 });
	});
	test('per-question marks and negatives', () => {
		expect(scoreAttempt([q(1, 4, 1), q(2, 1, 0.25), q(undefined as unknown as null, 1, 1)]).score).toBe(3.75);
	});
	test('total is clamped at 0', () => {
		expect(scoreAttempt([q(0), q(0), q(3)]).score).toBe(0);
	});
	test('no float noise', () => {
		expect(scoreAttempt([q(1, 0.1, 0), q(1, 0.2, 0)]).score).toBe(0.3);
	});
});

describe('windowState', () => {
	const now = new Date('2026-10-20T10:00:00Z');
	test('no window = live', () => expect(windowState({ startsAt: null, endsAt: null }, now)).toBe('live'));
	test('upcoming before start', () => expect(windowState({ startsAt: '2026-10-20T10:00:01Z', endsAt: null }, now)).toBe('upcoming'));
	test('live inside the window', () =>
		expect(windowState({ startsAt: '2026-10-20T09:00:00Z', endsAt: '2026-10-20T11:00:00Z' }, now)).toBe('live'));
	test('ended at or after end', () => expect(windowState({ startsAt: null, endsAt: now }, now)).toBe('ended'));
});

describe('deadline + grace', () => {
	const start = new Date('2026-10-20T10:00:00Z');
	test('duration from start', () => expect(attemptDeadline(start, 30, null).toISOString()).toBe('2026-10-20T10:30:00.000Z'));
	test('late joiner capped at window end', () =>
		expect(attemptDeadline(start, 30, new Date('2026-10-20T10:10:00Z')).toISOString()).toBe('2026-10-20T10:10:00.000Z'));
	test('hard deadline only after 3 min grace', () => {
		expect(pastHardDeadline(start, new Date(start.getTime() + GRACE_MS - 1))).toBe(false);
		expect(pastHardDeadline(start, new Date(start.getTime() + GRACE_MS))).toBe(true);
	});
});

describe('attempt limits and lockout', () => {
	test('live forces one attempt', () => {
		expect(effectiveMaxAttempts('live', null)).toBe(1);
		expect(effectiveMaxAttempts('live', 5)).toBe(1);
		expect(effectiveMaxAttempts('practice', null)).toBeNull();
		expect(effectiveMaxAttempts('mock', 3)).toBe(3);
	});
	test('5th failure locks for 15 min and resets the count', () => {
		const now = new Date('2026-10-20T10:00:00Z');
		let s: { failures: number; lockedUntil: Date | null } | undefined;
		for (let i = 1; i <= 4; i++) {
			const n = afterFailure(s, now);
			expect(n.locked).toBe(false);
			expect(n.left).toBe(5 - i);
			s = n;
		}
		const locked = afterFailure(s, now);
		expect(locked.locked).toBe(true);
		expect(locked.failures).toBe(0);
		expect(locked.lockedUntil!.getTime() - now.getTime()).toBe(LOCK_MS);
	});
});

describe('rank + median + password', () => {
	test('competition rank and percentile', () => {
		expect(rankFrom({ total: 0, higher: 0 })).toEqual({ rank: 1, participants: 1, percentile: 100 });
		expect(rankFrom({ total: 4, higher: 1 })).toEqual({ rank: 2, participants: 5, percentile: 75 });
		expect(rankFrom({ total: 4, higher: 4 })).toEqual({ rank: 5, participants: 5, percentile: 0 });
	});
	test('median', () => {
		expect(median([])).toBeNull();
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 2, 3])).toBe(2.5);
	});
	test('generated password: 8 chars, no look-alikes', () => {
		for (let i = 0; i < 50; i++) expect(generatePassword()).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{8}$/);
	});
});
