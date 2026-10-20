// Post form -> service input, shared by /admin/posts/new and /admin/posts/[id].
import { str } from '../courses/options.server';

export const postFields = (fd: FormData) => ({
	kind: str(fd, 'kind') || 'current_affairs',
	title: str(fd, 'title'),
	body: str(fd, 'body').replace(/\r\n/g, '\n'),
	examId: str(fd, 'examId'),
	fileId: str(fd, 'fileId'),
	publishedOn: str(fd, 'publishedOn'),
	published: fd.get('published') === 'on'
});
