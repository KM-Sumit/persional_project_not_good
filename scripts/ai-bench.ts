// Live benchmark of every Gemini text model the key can list, on two tasks: (a) 10 questions on a topic,
// (b) 10 questions from a sample PDF text. Plus one OpenRouter fallback call. Prints a markdown table.
// Usage: bun scripts/ai-bench.ts [--models a,b] [--pdf path/to/file.pdf] [--openrouter-only]
// The key goes only in the x-goog-api-key header, never in a URL, and is never printed.
import { readPdf } from '../src/lib/server/ai/pdf';
import { generate, geminiProvider, openRouterProvider, type PdfSource, type Provider } from '../src/lib/server/ai/generate';
import { generateInput, type GenerateInput } from '../src/lib/features/ai/schema';
import { env } from '../src/lib/server/env';

const SAMPLE = `Fundamental Rights in the Constitution of India

Part III of the Constitution of India (Articles 12 to 35) lists the Fundamental Rights. They were inspired by the Bill of Rights of the United States Constitution and are justiciable: a citizen can move the Supreme Court directly under Article 32, or a High Court under Article 226, when they are violated. Dr B. R. Ambedkar called Article 32 "the heart and soul of the Constitution".

Originally the Constitution gave seven Fundamental Rights. The 44th Constitutional Amendment Act, 1978 removed the Right to Property (Article 31) from Part III and made it a legal right under Article 300A. Six Fundamental Rights remain today.

Right to Equality (Articles 14 to 18). Article 14 guarantees equality before the law and equal protection of the laws to every person within the territory of India. Article 15 prohibits discrimination on grounds of religion, race, caste, sex or place of birth. Article 16 provides equality of opportunity in matters of public employment. Article 17 abolishes untouchability and forbids its practice in any form. Article 18 abolishes titles, except military and academic distinctions.

Right to Freedom (Articles 19 to 22). Article 19 originally guaranteed seven freedoms to citizens; after the removal of the freedom to acquire property six remain: speech and expression, assembly without arms, forming associations or unions, moving freely throughout India, residing and settling in any part of India, and practising any profession or carrying on any occupation, trade or business. Article 20 gives protection in respect of conviction for offences, including protection against double jeopardy and self-incrimination. Article 21 states that no person shall be deprived of life or personal liberty except according to procedure established by law. Article 21A, inserted by the 86th Amendment Act, 2002, makes free and compulsory education a Fundamental Right for children aged six to fourteen years. Article 22 gives protection against arrest and detention in certain cases; an arrested person must be produced before the nearest magistrate within 24 hours.

Right against Exploitation (Articles 23 and 24). Article 23 prohibits traffic in human beings, begar and other forms of forced labour. Article 24 prohibits the employment of children below the age of fourteen years in factories, mines and other hazardous occupations.

Right to Freedom of Religion (Articles 25 to 28). Article 25 guarantees freedom of conscience and the free profession, practice and propagation of religion. Article 26 gives every religious denomination the freedom to manage its religious affairs. Article 27 says no person shall be compelled to pay taxes for the promotion of any particular religion. Article 28 deals with freedom from religious instruction in educational institutions wholly maintained out of State funds.

Cultural and Educational Rights (Articles 29 and 30). Article 29 protects the interests of minorities to conserve their distinct language, script or culture. Article 30 gives all minorities, whether based on religion or language, the right to establish and administer educational institutions of their choice.

Right to Constitutional Remedies (Article 32). The Supreme Court can issue five kinds of writs: habeas corpus, mandamus, prohibition, certiorari and quo warranto. Habeas corpus literally means "to have the body" and protects against illegal detention. Mandamus means "we command" and directs a public official to perform a duty. Prohibition is issued by a higher court to a lower court to stop proceedings beyond its jurisdiction. Certiorari quashes an order already passed by a lower court or tribunal. Quo warranto asks "by what authority" a person holds a public office.

Suspension during Emergency. Under Article 358, the freedoms of Article 19 are automatically suspended when a National Emergency is declared on the ground of war or external aggression. Under Article 359, the President can suspend the right to move courts for the enforcement of other Fundamental Rights, except Articles 20 and 21, which cannot be suspended even during an emergency after the 44th Amendment.

Some Fundamental Rights are available only to citizens of India, such as Articles 15, 16, 19, 29 and 30. Others, such as Articles 14, 20, 21, 22 and 25, are available to all persons, including foreigners.`;

const TEXT_MODEL = /^(gemini|gemma)/;
const SKIP = /tts|image|banana|lyria|robotics|computer-use|deep-research|transcribe|omni|customtools|embedding|aqa/;

async function listModels(): Promise<string[]> {
	const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
		headers: { 'x-goog-api-key': env().GEMINI_API_KEY ?? '' }
	});
	if (!res.ok) throw new Error(`models list ${res.status}`);
	const j = (await res.json()) as { models: { name: string; supportedGenerationMethods?: string[] }[] };
	return j.models
		.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
		.map((m) => m.name.replace(/^models\//, ''))
		.filter((n) => TEXT_MODEL.test(n) && !SKIP.test(n));
}

const arg = (k: string) => {
	const i = process.argv.indexOf(k);
	return i > 0 ? process.argv[i + 1] : undefined;
};

const topic = generateInput.parse({ mode: 'topic', topic: 'Indian National Movement 1905-1947', subject: 'History', examName: 'SSC CGL', count: 10 }) as GenerateInput;
const pdfIn = generateInput.parse({ mode: 'pdf', bytes: new Uint8Array(1), subject: 'Polity', examName: 'MPPSC', count: 10 }) as GenerateInput;

async function pdfSource(): Promise<PdfSource> {
	const path = arg('--pdf');
	if (!path) return { bytes: new Uint8Array(), pages: 1, text: SAMPLE };
	const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
	return { bytes, ...(await readPdf(bytes)) };
}

async function run(label: string, p: Provider, input: GenerateInput, pdf?: PdfSource) {
	const t0 = performance.now();
	try {
		const r = await generate(input, pdf, [p]);
		const ms = Math.round(performance.now() - t0);
		const answerSpread = [0, 1, 2, 3].map((i) => r.questions.filter((q) => q.correctIndex === i).length).join('/');
		console.log(`| ${p.model} | ${label} | ${(ms / 1000).toFixed(1)}s | ${r.questions.length}/10 | ${r.dropped} | ${r.inputTokens} | ${r.outputTokens} | ${answerSpread} |`);
		for (const q of [0, 5, 9].map((i) => r.questions[i]).filter(Boolean)) console.error(`  [${p.model}/${label}] ${q.difficulty} ${q.prompt} -> ${q.options[q.correctIndex]} (${q.topic})`);
		return r;
	} catch (e) {
		console.log(`| ${p.model} | ${label} | fail | 0/10 | - | - | - | ${(e as Error).message.replace(/\|/g, '/').slice(0, 160)} |`);
	}
}

const pdf = await pdfSource();
console.log('| model | task | latency | valid | dropped | in tok | out tok | correct-index spread / error |');
console.log('|---|---|---|---|---|---|---|---|');
if (!process.argv.includes('--openrouter-only')) {
	const models = arg('--models')?.split(',') ?? (await listModels());
	for (const m of models) {
		const p = geminiProvider(m);
		await run('topic', p, topic);
		await run('pdf', p, pdfIn, pdf);
	}
}
if (env().OPENROUTER_API_KEY) await run('topic', openRouterProvider(), topic);
