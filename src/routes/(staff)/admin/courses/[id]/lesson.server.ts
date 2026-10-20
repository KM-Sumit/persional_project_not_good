// Lesson form -> service input. A video without a typed title takes its YouTube title.
import { DomainError } from '#lib/server/http';
import { parseYouTubeId } from '#lib/features/courses/schema';
import { str } from '../options.server';
import { ytInfo } from '../youtube.server';

export async function lessonFields(fd: FormData) {
	const kind = (['video', 'reading', 'pdf'] as const).find((k) => k === fd.get('kind')) ?? 'video';
	const youtube = kind === 'video' ? str(fd, 'youtube').trim() : '';
	const youtubeId = youtube ? parseYouTubeId(youtube) : null;
	if (kind === 'video' && !youtubeId) throw new DomainError(422, 'Paste a YouTube link for this video lesson.');
	let title = str(fd, 'title').trim();
	if (!title && youtubeId) title = (await ytInfo(youtubeId))?.title ?? '';
	if (!title) throw new DomainError(422, 'Give the lesson a title.');
	const minutes = Number(str(fd, 'durationMin') || 0);
	return {
		title,
		kind,
		youtube: youtubeId ?? undefined,
		youtubeId,
		durationSec: Number.isFinite(minutes) ? Math.round(Math.max(0, minutes) * 60) : 0,
		body: str(fd, 'body'),
		fileId: kind === 'pdf' ? str(fd, 'fileId') : '',
		isPreview: fd.get('isPreview') === 'on'
	};
}
