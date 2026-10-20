import { describe, expect, test } from 'bun:test';
import { formatMarks, scoreAttempt } from './score';

describe('scoreAttempt', () => {
	test('applies negative marking and leaves blanks unscored', () => {
		const score = scoreAttempt([
			{ marksMilli: 1000, negativeMilli: 250, correctIndex: 1, selected: 1 },
			{ marksMilli: 1000, negativeMilli: 250, correctIndex: 0, selected: 0 },
			{ marksMilli: 1000, negativeMilli: 250, correctIndex: 2, selected: 1 },
			{ marksMilli: 1000, negativeMilli: 250, correctIndex: 3, selected: null }
		]);
		expect(score.awarded).toBe(1750);
		expect(score.max).toBe(4000);
		expect(score.correct).toBe(2);
		expect(score.wrong).toBe(1);
		expect(score.unattempted).toBe(1);
		expect(score.percentageTenths).toBe(438);
		expect(score.accuracyTenths).toBe(667);
	});

	test('formats milli-marks without floating storage', () => {
		expect(formatMarks(1750)).toBe('1.75');
		expect(formatMarks(-250)).toBe('-0.25');
	});
});
