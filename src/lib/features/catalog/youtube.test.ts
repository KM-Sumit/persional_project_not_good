import { describe, expect, test } from 'bun:test';
import { youtubeEmbedSrc, youtubeId } from './youtube';

describe('youtubeId', () => {
	test('watch URL', () => {
		expect(youtubeId('https://www.youtube.com/watch?v=lnYyJLYFv_w')).toBe('lnYyJLYFv_w');
	});
	test('youtu.be', () => {
		expect(youtubeId('https://youtu.be/lnYyJLYFv_w')).toBe('lnYyJLYFv_w');
	});
	test('embed', () => {
		expect(youtubeId('https://www.youtube.com/embed/lnYyJLYFv_w')).toBe('lnYyJLYFv_w');
	});
	test('nocookie embed src', () => {
		expect(youtubeEmbedSrc('https://youtu.be/lnYyJLYFv_w')).toBe(
			'https://www.youtube-nocookie.com/embed/lnYyJLYFv_w?rel=0&modestbranding=1&playsinline=1'
		);
	});
});
