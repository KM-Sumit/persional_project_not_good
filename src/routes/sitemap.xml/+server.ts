import { publicCatalog } from '#lib/features/courses/server/service';
import { listPublished, syllabusExams } from '#lib/features/posts/server/service';
import { examHub } from '#lib/features/site/server/browse';
import { LEGAL_SLUGS } from '#lib/features/site/components/legal';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const [hub, courses, ca, jobs, syl] = await Promise.all([
		examHub(),
		publicCatalog(),
		listPublished('current_affairs', 200),
		listPublished('job_alert', 200),
		syllabusExams()
	]);
	const has = (id: string) => Object.values(hub.counts[id] ?? {}).some(Boolean);
	const paths: [string, string?][] = [
		['/'], ['/exams'], ['/courses'], ['/results'], ['/faculty'], ['/about'], ['/contact'], ['/current-affairs'], ['/jobs'], ['/syllabus'],
		...LEGAL_SLUGS.map((s): [string] => [`/legal/${s}`]),
		...hub.categories.flatMap((c) => [[`/exams/${c.slug}`] as [string], ...c.exams.filter((e) => has(e.id)).map((e): [string] => [`/exams/${c.slug}/${e.slug}`])]),
		...courses.map((c): [string, string] => [`/courses/${c.slug}`, c.updatedAt.slice(0, 10)]),
		...ca.map((p): [string, string] => [`/current-affairs/${p.slug}`, p.publishedOn]),
		...jobs.map((p): [string, string] => [`/jobs/${p.slug}`, p.publishedOn]),
		...syl.map((e): [string] => [`/syllabus/${e.slug}`])
	];
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
		.map(([p, mod]) => `<url><loc>${url.origin}${p}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`)
		.join('\n')}\n</urlset>`;
	return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
