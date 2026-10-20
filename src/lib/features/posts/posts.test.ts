import { describe, expect, test } from 'bun:test';
import { daysBefore, istDate, lastDays, streakFrom } from './format';
import { plainText } from './server/text';

describe('dates', () => {
	test('IST rolls over at 18:30 UTC', () => {
		expect(istDate(new Date('2026-10-20T18:29:00Z'))).toBe('2026-10-20');
		expect(istDate(new Date('2026-10-20T18:31:00Z'))).toBe('2026-10-21');
	});
	test('daysBefore crosses months and the strip is oldest first', () => {
		expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
		const s = lastDays('2026-10-21', 14);
		expect(s.length).toBe(14);
		expect(s[0]).toBe('2026-10-08');
		expect(s[13]).toBe('2026-10-21');
	});
});

describe('streak', () => {
	const t = '2026-10-21';
	test('counts back from today', () => expect(streakFrom(['2026-10-21', '2026-10-20', '2026-10-19', '2026-10-17'], t)).toBe(3));
	test('alive through yesterday when today is not done', () => expect(streakFrom(['2026-10-20', '2026-10-19'], t)).toBe(2));
	test('broken by a missed day', () => expect(streakFrom(['2026-10-19'], t)).toBe(0));
	test('empty', () => expect(streakFrom([], t)).toBe(0));
});

describe('plainText', () => {
	test('strips markdown and clamps', () => {
		expect(plainText('## Head\n\n- **RBI** cut the [repo rate](http://x.y) to `6%`\n\n> quote', 1000)).toBe('Head RBI cut the repo rate to 6% quote');
		expect(plainText('a'.repeat(50), 10).length).toBe(10);
	});
});
