import { expect, test } from 'bun:test';
import { navDirection } from './motion';

const tabs = ['/teacher', '/teacher/quizzes', '/teacher/insights', '/account'];
test('navDirection', () => {
	expect(navDirection('/teacher', '/teacher/insights', tabs)).toBe('tab-right');
	expect(navDirection('/account', '/teacher', tabs)).toBe('tab-left');
	expect(navDirection('/teacher/quizzes', '/teacher/quizzes/5', tabs)).toBe('forward');
	expect(navDirection('/teacher/quizzes/5', '/teacher/quizzes', tabs)).toBe('back');
	expect(navDirection('/teacher/quizzes/5/live', '/teacher/quizzes/5', tabs)).toBe('back');
	expect(navDirection('/a', '/b', tabs, { pop: -1 })).toBe('back');
	expect(navDirection('/a', '/b', tabs, { back: true })).toBe('back');
});
