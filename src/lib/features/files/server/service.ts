import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { banners, chapters, courses, faculty, files, lessons, notes, posts, toppers } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { checkUpload, fileUrl, type FileDto, type FileKind } from '../schema';
import { r2Enabled } from '#lib/server/env';
import { deleteObject, putObject, signedGetUrl } from './r2';

export async function upload(file: File, ownerId: string | null, kind: FileKind): Promise<FileDto> {
	if (!r2Enabled()) throw new DomainError(503, 'Storage is not configured');
	const buf = await file.arrayBuffer();
	const bytes = new Uint8Array(buf);
	const r = checkUpload(kind, bytes.byteLength, bytes.subarray(0, 16));
	if ('error' in r) throw new DomainError(422, r.error);
	const id = crypto.randomUUID();
	const key = `${kind}/${new Date().toISOString().slice(0, 7)}/${id}.${r.ext}`;
	const name = (file.name || `upload.${r.ext}`).slice(0, 200);
	await putObject(key, buf, r.mime);
	try {
		await db().insert(files).values({ id, key, name, mime: r.mime, size: bytes.byteLength, ownerId });
	} catch (e) {
		await deleteObject(key).catch(() => {}); // no orphan object without a row
		throw e;
	}
	return { id, name, url: fileUrl(id) };
}

async function find(fileId: string) {
	if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new DomainError(404, 'File not found.');
	const [row] = await db().select().from(files).where(eq(files.id, fileId)).limit(1);
	if (!row) throw new DomainError(404, 'File not found.');
	return row;
}

/** Short-lived signed URL plus whether the file may be fetched without signing in. */
export async function signedUrl(fileId: string): Promise<{ url: string; public: boolean; mime: string }> {
	const row = await find(fileId);
	return { url: await signedGetUrl(row.key), public: await isPublic(row.id), mime: row.mime };
}

/** Files shown on the public site (toppers, faculty, banners, course covers, published post PDFs) need no session. */
export async function isPublic(fileId: string): Promise<boolean> {
	const r = await db().execute(sql`select exists(
		select 1 from ${toppers} where ${toppers.photoFileId} = ${fileId}
		union all select 1 from ${faculty} where ${faculty.photoFileId} = ${fileId}
		union all select 1 from ${banners} where ${banners.imageFileId} = ${fileId}
		union all select 1 from ${courses} where ${courses.coverFileId} = ${fileId}
		union all select 1 from ${posts} where ${posts.fileId} = ${fileId} and ${posts.published}
	) as p`);
	return Boolean((r as unknown as { p: boolean }[])[0]?.p);
}

/** Paid content a file belongs to (a paid note's PDF, a paid course's non-preview lesson file). Empty = not paywalled. */
export async function paidRefs(fileId: string): Promise<{ noteIds: string[]; courseIds: string[] }> {
	const [n, l] = await Promise.all([
		db().select({ id: notes.id }).from(notes).where(and(eq(notes.fileId, fileId), eq(notes.isPaid, true))),
		db()
			.select({ id: courses.id })
			.from(lessons)
			.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
			.innerJoin(courses, eq(courses.id, chapters.courseId))
			.where(and(eq(lessons.fileId, fileId), eq(courses.isPaid, true), eq(lessons.isPreview, false)))
	]);
	return { noteIds: n.map((r) => r.id), courseIds: l.map((r) => r.id) };
}

export async function remove(fileId: string) {
	const row = await find(fileId);
	await deleteObject(row.key);
	await db().delete(files).where(eq(files.id, row.id));
}
