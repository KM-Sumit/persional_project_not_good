import { describe, expect, test } from 'bun:test';
import { nextLesson, parseYouTubeId, progressPercent, resumeLesson, slugify, type CourseOutline } from './schema';

describe('parseYouTubeId', () => {
	const id = 'dQw4w9WgXcQ';
	test.each([
		id,
		`https://www.youtube.com/watch?v=${id}`,
		`https://youtube.com/watch?feature=share&v=${id}&t=42s`,
		`https://m.youtube.com/watch?v=${id}`,
		`youtube.com/watch?v=${id}`,
		`https://youtu.be/${id}`,
		`https://youtu.be/${id}?si=abc&t=10`,
		`https://www.youtube.com/shorts/${id}`,
		`https://www.youtube.com/embed/${id}?rel=0`,
		`https://www.youtube-nocookie.com/embed/${id}`,
		`https://www.youtube.com/live/${id}?feature=share`,
		`https://www.youtube.com/v/${id}`,
		`https://music.youtube.com/watch?v=${id}`,
		`  https://youtu.be/${id}  `
	])('%s', (url) => expect(parseYouTubeId(url)).toBe(id));

	test.each([
		'',
		'not a url',
		'https://vimeo.com/123456789',
		'https://example.com/watch?v=dQw4w9WgXcQ',
		'https://www.youtube.com/watch?v=short',
		'https://www.youtube.com/channel/UC123',
		'https://youtu.be/',
		'javascript:alert(1)'
	])('rejects %s', (url) => expect(parseYouTubeId(url)).toBeNull());
});

test('slugify', () => {
	expect(slugify('SSC CGL: Quant & Reasoning!')).toBe('ssc-cgl-quant-and-reasoning');
	expect(slugify('  Café  Notes  ')).toBe('cafe-notes');
	expect(slugify('हिंदी')).toBe('item');
	expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
});

test('progressPercent', () => {
	expect(progressPercent(0, 0)).toBe(0);
	expect(progressPercent(1, 3)).toBe(33);
	expect(progressPercent(2, 3)).toBe(67);
	expect(progressPercent(3, 3)).toBe(100);
	expect(progressPercent(5, 3)).toBe(100);
});

const L = (id: string) => ({ id, chapterId: 'c', title: id, kind: 'video' as const, youtubeId: null, durationSec: 0, body: '', fileId: null, isPreview: false, sortOrder: 0 });
const outline = { chapters: [{ id: 'c1', title: '', sortOrder: 0, lessons: [L('a'), L('b')] }, { id: 'c2', title: '', sortOrder: 1, lessons: [L('c')] }] } as Pick<CourseOutline, 'chapters'>;

test('nextLesson crosses chapters', () => {
	expect(nextLesson(outline, 'b')?.id).toBe('c');
	expect(nextLesson(outline, 'c')).toBeNull();
});

test('resumeLesson', () => {
	expect(resumeLesson(outline, new Set(), null)?.id).toBe('a');
	expect(resumeLesson(outline, new Set(), 'b')?.id).toBe('b');
	expect(resumeLesson(outline, new Set(['b']), 'b')?.id).toBe('c');
	expect(resumeLesson(outline, new Set(['b', 'c']), 'c')?.id).toBe('a');
	expect(resumeLesson(outline, new Set(['a', 'b', 'c']), 'c')).toBeNull();
});
