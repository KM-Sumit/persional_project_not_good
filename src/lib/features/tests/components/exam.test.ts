import { expect, test } from 'bun:test';
import { clock, countStates, qState } from './exam';

test('qState follows the CBT palette rules', () => {
	expect(qState(undefined, false)).toBe('not-visited');
	expect(qState(undefined, true)).toBe('not-answered');
	expect(qState({ selected: null, marked: false }, true)).toBe('not-answered');
	expect(qState({ selected: 0, marked: false }, true)).toBe('answered');
	expect(qState({ selected: null, marked: true }, true)).toBe('marked');
	expect(qState({ selected: 2, marked: true }, false)).toBe('answered-marked');
	expect(countStates(['answered', 'answered', 'marked']).answered).toBe(2);
});

test('clock', () => {
	expect(clock(125)).toBe('02:05');
	expect(clock(3725)).toBe('1:02:05');
	expect(clock(-5)).toBe('00:00');
});
