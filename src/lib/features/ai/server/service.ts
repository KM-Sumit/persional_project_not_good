// AI generation jobs. createJob stores an ai_jobs row and runs the generation in the background of this process
// (no queue): queued -> running -> ready | failed; the bank marks a job applied after copying its questions.
import { and, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { aiJobs } from '#lib/server/db/schema';
import { env } from '#lib/server/env';
import { DomainError } from '#lib/server/http';
import { MAX_SCANNED_PAGES } from '#lib/server/ai/input';
import { readPdf } from '#lib/server/ai/pdf';
import { aiEnabled, fingerprint, generate, type GenerateResult, type PdfSource } from '#lib/server/ai/generate';
import { signedUrl } from '../../files/server/service';
import { generateInput, type AiJobDto, type GenerateInputRaw, type GeneratedQuestion } from '../schema';

export { fingerprint };

/** A job still "running" after this long was cut off by a restart: report it as failed. */
const STALE_MS = 15 * 60_000;

type Row = typeof aiJobs.$inferSelect;
type Output = { questions: GeneratedQuestion[]; requested: number; dropped: number };
export type Deps = { generate?: typeof generate; loadFile?: (fileId: string) => Promise<Uint8Array> };

async function loadFile(fileId: string): Promise<Uint8Array> {
	const f = await signedUrl(fileId);
	if (f.mime !== 'application/pdf') throw new DomainError(422, 'That file is not a PDF.');
	const res = await fetch(f.url, { signal: AbortSignal.timeout(60_000) });
	if (!res.ok) throw new DomainError(503, 'Could not read the uploaded PDF.');
	return new Uint8Array(await res.arrayBuffer());
}

function toDto(r: Row): AiJobDto {
	const out = (r.output ?? {}) as Partial<Output>;
	const stale = r.status === 'running' && Date.now() - r.updatedAt.getTime() > STALE_MS;
	return {
		id: r.id,
		status: stale ? 'failed' : r.status,
		source: r.source as AiJobDto['source'],
		input: r.input,
		questions: out.questions ?? [],
		requested: out.requested ?? Number(r.input.count ?? 0),
		dropped: out.dropped ?? 0,
		provider: r.provider,
		model: r.model,
		inputTokens: r.inputTokens,
		outputTokens: r.outputTokens,
		error: stale ? 'Interrupted by a server restart. Try again.' : r.error,
		createdAt: r.createdAt.toISOString(),
		updatedAt: r.updatedAt.toISOString()
	};
}

/** Validates, stores the job and starts generating. Returns at once; poll getJob for the result. */
export async function createJob(raw: GenerateInputRaw, userId: string, deps: Deps = {}): Promise<AiJobDto> {
	const parsed = generateInput.safeParse(raw);
	if (!parsed.success) throw new DomainError(400, parsed.error.issues[0]?.message ?? 'Invalid request.');
	const input = { ...parsed.data, count: Math.min(parsed.data.count, env().AI_MAX_QUESTIONS) };
	if (!deps.generate && !aiEnabled()) throw new DomainError(503, 'AI is not configured.');

	const { bytes, ...stored } = input as typeof input & { bytes?: Uint8Array };
	const [row] = await db()
		.insert(aiJobs)
		.values({
			source: input.mode === 'topic' ? 'ai_topic' : 'ai_pdf',
			input: bytes ? { ...stored, byteSize: bytes.byteLength } : stored,
			createdById: userId
		})
		.returning();

	void run(row.id, async () => {
		if (input.mode === 'topic') return (deps.generate ?? generate)(input);
		const pdfBytes = bytes ?? (await (deps.loadFile ?? loadFile)(input.fileId!));
		const info = await readPdf(pdfBytes, { from: input.pageFrom, to: input.pageTo });
		if (!info.pages) throw new Error('Could not read this PDF (broken or password-protected).');
		// ponytail: scans go whole (no PDF cutter installed); add pdf-lib to send only the chosen pages
		if (info.text == null && info.pages > MAX_SCANNED_PAGES)
			throw new Error(`This PDF is scanned (no text layer) and has ${info.pages} pages; split it to ${MAX_SCANNED_PAGES} pages or fewer.`);
		const pdf: PdfSource = { bytes: pdfBytes, ...info };
		return (deps.generate ?? generate)(input, pdf);
	});
	return toDto(row);
}

async function run(id: string, work: () => Promise<GenerateResult>) {
	const set = (v: Partial<typeof aiJobs.$inferInsert>) => db().update(aiJobs).set(v).where(eq(aiJobs.id, id));
	try {
		await set({ status: 'running' });
		const r = await work();
		const output: Output = { questions: r.questions, requested: r.requested, dropped: r.dropped };
		await set({ status: 'ready', output, provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
	} catch (e) {
		await set({ status: 'failed', error: ((e as Error).message ?? String(e)).slice(0, 1000) }).catch(() => {});
	}
}

export async function getJob(id: string): Promise<AiJobDto> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError(404, 'Job not found.');
	const [row] = await db().select().from(aiJobs).where(eq(aiJobs.id, id)).limit(1);
	if (!row) throw new DomainError(404, 'Job not found.');
	return toDto(row);
}

/** The user's latest jobs, newest first. */
export async function listJobs(userId: string, limit = 50): Promise<AiJobDto[]> {
	const rows = await db().select().from(aiJobs).where(eq(aiJobs.createdById, userId)).orderBy(desc(aiJobs.createdAt)).limit(limit);
	return rows.map(toDto);
}

/** Called by the bank after it copied the questions into a module. Only a ready job can be applied (once). */
export async function markApplied(id: string): Promise<AiJobDto> {
	const job = await getJob(id);
	const [row] = await db()
		.update(aiJobs)
		.set({ status: 'applied' })
		.where(and(eq(aiJobs.id, id), eq(aiJobs.status, 'ready')))
		.returning();
	if (!row) throw new DomainError(409, job.status === 'applied' ? 'This job was already applied.' : 'Only a finished job can be applied.');
	return toDto(row);
}
