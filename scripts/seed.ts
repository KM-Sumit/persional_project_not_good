// Idempotent seed: `bun scripts/seed.ts`. Inserts only what is missing (never overwrites admin edits). Never seeds users.
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/lib/server/db/index';
import {
	academicSessions,
	banners,
	batches,
	chapters,
	courses,
	examCategories,
	exams,
	lessons,
	modules,
	notes,
	questions,
	settings,
	subjects,
	testQuestions,
	tests
} from '../src/lib/server/db/schema';
import { fingerprint } from '../src/lib/features/bank/server/fingerprint';
import { newJoinCode } from '../src/lib/features/cohorts/schema';
import { cacheKeys, invalidate } from '../src/lib/server/cache/index';

const d = db();
const log = (...a: unknown[]) => console.log('[seed]', ...a);

// ---------- taxonomy (legacy migrate.ts) ----------
const TAXONOMY = [
	{ name: 'SSC Exams', slug: 'ssc', exams: [['SSC CGL', 'ssc-cgl'], ['SSC CHSL', 'ssc-chsl'], ['SSC MTS', 'ssc-mts'], ['SSC GD', 'ssc-gd'], ['SSC CPO', 'ssc-cpo']] },
	{ name: 'Railway Exams', slug: 'railway', exams: [['RRB NTPC', 'rrb-ntpc'], ['RRB Group D', 'rrb-group-d'], ['RRB ALP', 'rrb-alp'], ['RRB Technician', 'rrb-technician']] },
	{ name: 'MPPSC', slug: 'mppsc', exams: [['Prelims', 'mppsc-prelims'], ['Mains', 'mppsc-mains'], ['State Forest Service', 'mppsc-state-forest-service']] },
	{ name: 'MP Police', slug: 'mp-police', exams: [['Constable', 'mp-police-constable'], ['Sub-Inspector', 'mp-police-sub-inspector'], ['Jail Prahari', 'mp-police-jail-prahari']] }
] as const;
const SUBJECTS = ['Mathematics', 'Reasoning', 'English', 'General Knowledge', 'General Science', 'Hindi', 'Current Affairs', 'Computer'];

for (const [ci, c] of TAXONOMY.entries()) {
	await d.insert(examCategories).values({ name: c.name, slug: c.slug, sortOrder: ci }).onConflictDoNothing();
	const [cat] = await d.select().from(examCategories).where(eq(examCategories.slug, c.slug));
	for (const [ei, [name, slug]] of c.exams.entries())
		await d.insert(exams).values({ categoryId: cat!.id, name, slug, sortOrder: ei }).onConflictDoNothing();
}
for (const [i, name] of SUBJECTS.entries()) await d.insert(subjects).values({ name, sortOrder: i }).onConflictDoNothing();

const examId = async (slug: string) => (await d.select({ id: exams.id }).from(exams).where(eq(exams.slug, slug)))[0]!.id;
const subjectId = async (name: string) => (await d.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, name)))[0]!.id;
const cgl = await examId('ssc-cgl');
const maths = await subjectId('Mathematics');
const reasoning = await subjectId('Reasoning');
log('taxonomy ok');

// ---------- session + batch ----------
await d.insert(academicSessions).values({ name: '2026-27', startsOn: '2026-04-01', endsOn: '2027-03-31' }).onConflictDoNothing();
const [session] = await d.select().from(academicSessions).where(eq(academicSessions.name, '2026-27'));
if (!(await d.select().from(academicSessions).where(eq(academicSessions.isCurrent, true))).length)
	await d.update(academicSessions).set({ isCurrent: true }).where(eq(academicSessions.id, session!.id));
if (!(await d.select().from(batches).where(and(eq(batches.sessionId, session!.id), eq(batches.name, 'SSC CGL Foundation')))).length) {
	const [b] = await d.insert(batches).values({ sessionId: session!.id, examId: cgl, name: 'SSC CGL Foundation', joinCode: newJoinCode() }).returning();
	log('batch SSC CGL Foundation, join code', b!.joinCode);
}

// ---------- courses ----------
type SeedLesson = { title: string; kind: 'video' | 'reading'; body?: string; youtubeId?: string; durationSec?: number; isPreview?: boolean };
async function seedCourse(c: { slug: string; title: string; summary: string; description: string; coverUrl?: string; chapter: string; lessons: SeedLesson[] }) {
	if ((await d.select({ id: courses.id }).from(courses).where(eq(courses.slug, c.slug))).length) return;
	const { chapter, lessons: ls, ...course } = c;
	const [row] = await d.insert(courses).values({ ...course, examId: cgl, published: true }).returning();
	const [ch] = await d.insert(chapters).values({ courseId: row!.id, title: chapter, sortOrder: 0 }).returning();
	await d.insert(lessons).values(ls.map((l, i) => ({ ...l, body: l.body ?? '', chapterId: ch!.id, sortOrder: i })));
	log('course', c.slug);
}

await seedCourse({
	slug: 'ssc-cgl-quantitative-aptitude',
	title: 'SSC CGL Quantitative Aptitude',
	summary: 'Arithmetic foundations for SSC CGL Tier 1: percentages, profit and loss, ratios.',
	description:
		'Build the arithmetic base that roughly a third of the SSC CGL quant section rests on. Each lesson is short, with worked examples and the shortcuts examiners expect you to know.',
	chapter: 'Arithmetic foundations',
	lessons: [
		{
			title: 'Percentages and conversions',
			kind: 'reading',
			durationSec: 480,
			isPreview: true,
			body: `## What a percentage means

"Per cent" means *per hundred*, so $x\\%$ is the fraction $\\frac{x}{100}$.

## Fraction table to memorise

| Fraction | Percent |
|---|---|
| 1/2 | 50% |
| 1/3 | 33.33% |
| 1/4 | 25% |
| 1/5 | 20% |
| 1/6 | 16.66% |
| 1/8 | 12.5% |
| 1/9 | 11.11% |
| 1/11 | 9.09% |

Knowing these lets you replace slow multiplication with a single division. For example, 12.5% of 640 is $640 \\div 8 = 80$.

## Percentage change

$$\\text{Change \\%} = \\frac{\\text{New} - \\text{Old}}{\\text{Old}} \\times 100$$

Always divide by the **original** value.

## Worked example

A price rises from 250 to 300. The change is 50, and $\\frac{50}{250} \\times 100 = 20\\%$.

> Exam tip: if a value rises by $r\\%$, consumption must fall by $\\frac{r}{100 + r} \\times 100\\%$ to keep spending the same. A 25% rise needs a 20% cut.`
		},
		{
			title: 'Profit, loss and discount',
			kind: 'reading',
			durationSec: 540,
			body: `## The three prices

- **Cost price (CP):** what the seller paid.
- **Marked price (MP):** the price on the tag.
- **Selling price (SP):** what the buyer pays after discount.

## Core formulas

- Profit % $= \\frac{SP - CP}{CP} \\times 100$ (profit and loss are always on CP)
- Discount % $= \\frac{MP - SP}{MP} \\times 100$ (discount is always on MP)

## Multiplier method

Turn every percentage into a multiplier and chain them:

- 20% profit: $\\times 1.2$
- 10% loss: $\\times 0.9$
- 25% discount: $\\times 0.75$

A shopkeeper marks goods 40% above cost and gives a 25% discount:
$1.4 \\times 0.75 = 1.05$, so the profit is **5%**.

## Successive discounts

Two discounts of $a\\%$ and $b\\%$ equal a single discount of
$$a + b - \\frac{ab}{100}$$
So 20% and 10% give $30 - 2 = 28\\%$, not 30%.`
		},
		{
			title: 'Ratio and proportion',
			kind: 'reading',
			durationSec: 480,
			body: `## Ratios compare like quantities

$a : b$ means $\\frac{a}{b}$. Multiply or divide both terms by the same number and the ratio does not change.

## Combining two ratios

If $A : B = 3 : 5$ and $B : C = 4 : 7$, make $B$ equal in both:

- $A : B = 12 : 20$
- $B : C = 20 : 35$

So $A : B : C = 12 : 20 : 35$.

## Dividing an amount in a ratio

To split 1,200 in the ratio $2 : 3 : 5$, the total parts are 10, so one part is 120 and the shares are 240, 360 and 600.

## Proportion

$a : b = c : d$ means $ad = bc$ (product of extremes equals product of means).

1. Fourth proportional of $a, b, c$ is $\\frac{bc}{a}$.
2. Mean proportional of $a$ and $b$ is $\\sqrt{ab}$.`
		}
	]
});

// Real public videos (verified via YouTube oEmbed): Khan Academy and Mashup Math.
await seedCourse({
	slug: 'percentages-and-ratios-video-course',
	title: 'Percentages and Ratios: Video Lessons',
	summary: 'Three short video lessons on percentages and ratio word problems.',
	description: 'Watch, then practise with the Arithmetic fundamentals test. Your position in each video is saved so you can pick up where you left off.',
	coverUrl: 'https://i.ytimg.com/vi/FaDtge_vkbg/hqdefault.jpg',
	chapter: 'Video lessons',
	lessons: [
		{ title: 'Finding a percentage', kind: 'video', youtubeId: 'FaDtge_vkbg', isPreview: true, body: 'Write the part over the whole, convert to a fraction out of 100, and read off the percentage.' },
		{ title: 'Solving percentage word problems', kind: 'video', youtubeId: 'dJMYNdMjdy4', body: 'Two multi-step examples: identify the base value first, then apply the percentage.' },
		{ title: 'Part to whole ratio word problems', kind: 'video', youtubeId: 'ZJ6y8OVJRw8', body: 'Use a ratio table to scale a part-to-whole ratio up to the actual quantities.' }
	]
});

// ---------- notes ----------
const NOTES = [
	{
		slug: 'percentage-quick-sheet',
		title: 'Percentage quick sheet',
		summary: 'Fraction equivalents, percentage change and the consumption rule on one page.',
		subject: 'Mathematics',
		body: `## Fraction equivalents

| Fraction | % | Fraction | % |
|---|---|---|---|
| 1/2 | 50 | 1/7 | 14.28 |
| 1/3 | 33.33 | 1/8 | 12.5 |
| 1/4 | 25 | 1/9 | 11.11 |
| 1/5 | 20 | 1/11 | 9.09 |
| 1/6 | 16.66 | 1/12 | 8.33 |

## Key formulas

- $x\\%$ of $y$ = $y\\%$ of $x$ (so 8% of 50 = 50% of 8 = 4)
- Successive change of $a\\%$ and $b\\%$: $a + b + \\frac{ab}{100}$ (use negative values for decreases)
- If A is $r\\%$ more than B, then B is $\\frac{r}{100 + r} \\times 100\\%$ less than A

## Consumption rule

If price rises by $r\\%$, cut consumption by $\\frac{r}{100 + r} \\times 100\\%$ to keep expenditure unchanged.

| Price rise | Cut needed |
|---|---|
| 10% | 9.09% |
| 20% | 16.66% |
| 25% | 20% |
| 50% | 33.33% |`
	},
	{
		slug: 'reasoning-number-series',
		title: 'Reasoning: number series',
		summary: 'The six patterns behind almost every SSC number series question.',
		subject: 'Reasoning',
		body: `## Work through these checks in order

1. **Differences.** Write the gaps between terms. If the gaps form a pattern, you are done.
2. **Second differences.** If the gaps are not constant, take the differences of the gaps.
3. **Squares and cubes.** Look for $n^2 \\pm k$ or $n^3 \\pm k$. Example: 3, 8, 15, 24, 35 is $n^2 - 1$.
4. **Products.** $n(n+1)$ gives 2, 6, 12, 20, 30, 42.
5. **Multiply and add.** Terms like $\\times 2 + 1$: 3, 7, 15, 31, 63.
6. **Alternating series.** Two series interleaved; split odd and even positions.

## Squares to know cold

$11^2 = 121$, $12^2 = 144$, $13^2 = 169$, $14^2 = 196$, $15^2 = 225$, $16^2 = 256$, $17^2 = 289$, $18^2 = 324$, $19^2 = 361$, $25^2 = 625$.

> If nothing fits in 30 seconds, mark it and move on. Series questions reward recognition, not grinding.`
	},
	{
		slug: 'english-subject-verb-agreement',
		title: 'English: subject-verb agreement',
		summary: 'Rules that decide most error-spotting questions.',
		subject: 'English',
		body: `## The core rule

A singular subject takes a singular verb; a plural subject takes a plural verb. Find the real subject first and ignore phrases in between.

- The box of apples **is** on the table. (subject: box)
- The quality of the mangoes **was** poor. (subject: quality)

## Rules examiners test

1. **Either/or, neither/nor:** the verb agrees with the nearer subject. *Neither the teacher nor the students **were** present.*
2. **Each, every, everyone, nobody:** always singular. *Each of the boys **has** a book.*
3. **As well as, along with, together with:** the verb follows the first subject. *The captain, along with his players, **was** praised.*
4. **A number of** takes a plural verb; **the number of** takes a singular verb.
5. **Collective nouns** (team, jury, committee) are singular when acting as one unit.
6. **Amounts** of time, money or distance are singular. *Five hundred rupees **is** a fair price.*

## Quick check

Cover the words between the subject and the verb, then read the sentence again.`
	},
	{
		slug: 'general-awareness-revision-method',
		title: 'General awareness: revision method',
		summary: 'A weekly cycle that makes static GK and current affairs stick.',
		subject: 'General Knowledge',
		body: `## Why GK slips

General awareness is recall, not reasoning. Facts read once are mostly forgotten within a week unless you revisit them.

## The weekly cycle

1. **Daily (20 minutes):** read current affairs and write five one-line facts in a notebook.
2. **Day 3:** reread that week's lines without looking at the source.
3. **Day 7:** take a 25-question quiz on the week.
4. **Day 30:** revise the month in one sitting.

## Static GK priorities for SSC

- Indian polity: articles, schedules, amendments
- History: freedom movement timeline
- Geography: rivers, national parks, states and capitals
- Economy: basic terms and recent budgets
- Science: everyday physics, chemistry and biology

## Make it active

Turn every fact into a question. *"Which article abolishes untouchability?"* is easier to remember than *"Article 17 abolishes untouchability."*`
	}
];
for (const n of NOTES) {
	const { subject, ...note } = n;
	const r = await d
		.insert(notes)
		.values({ ...note, examId: cgl, subjectId: await subjectId(subject), published: true })
		.onConflictDoNothing()
		.returning({ id: notes.id });
	if (r.length) log('note', n.slug);
}

// ---------- question bank ----------
type Q = { prompt: string; options: string[]; correct: number; explanation: string; topic: string; difficulty?: 'easy' | 'medium' | 'hard' };
const MATHS: Q[] = [
	{ prompt: 'If 20% of a number is 45, what is 35% of the same number?', options: ['72', '78.75', '81', '85.5'], correct: 1, explanation: 'The number is 45 / 0.20 = 225. 35% of 225 = 78.75.', topic: 'Percentages', difficulty: 'easy' },
	{ prompt: 'A shopkeeper marks an article 40% above its cost price and allows a discount of 25%. What is his profit percentage?', options: ['5%', '10%', '12.5%', '15%'], correct: 0, explanation: 'Multiplier = 1.40 x 0.75 = 1.05, so the profit is 5%.', topic: 'Profit and loss' },
	{ prompt: 'If A : B = 3 : 5 and B : C = 4 : 7, then A : B : C is:', options: ['12 : 20 : 35', '3 : 5 : 7', '12 : 15 : 35', '3 : 20 : 35'], correct: 0, explanation: 'Make B common: A : B = 12 : 20 and B : C = 20 : 35, so A : B : C = 12 : 20 : 35.', topic: 'Ratio and proportion', difficulty: 'easy' },
	{ prompt: 'The price of sugar rises by 25%. By what percentage must a family reduce its consumption so that its expenditure on sugar stays the same?', options: ['25%', '20%', '15%', '22.5%'], correct: 1, explanation: 'Reduction = 25 / (100 + 25) x 100 = 20%.', topic: 'Percentages' },
	{ prompt: 'What is the simple interest on Rs 8,000 at 6% per annum for 3 years?', options: ['Rs 1,200', 'Rs 1,440', 'Rs 1,560', 'Rs 1,640'], correct: 1, explanation: 'SI = P x R x T / 100 = 8000 x 6 x 3 / 100 = Rs 1,440.', topic: 'Simple interest', difficulty: 'easy' },
	{ prompt: 'A can finish a piece of work in 12 days and B can finish it in 18 days. In how many days can they finish it working together?', options: ['7.2 days', '7.5 days', '6.8 days', '15 days'], correct: 0, explanation: 'Together they do 1/12 + 1/18 = 5/36 of the work per day, so they need 36/5 = 7.2 days.', topic: 'Time and work' },
	{ prompt: 'A train 240 m long passes a pole in 12 seconds. What is the speed of the train in km/h?', options: ['60 km/h', '66 km/h', '72 km/h', '80 km/h'], correct: 2, explanation: 'Speed = 240 / 12 = 20 m/s = 20 x 18/5 = 72 km/h.', topic: 'Speed, time and distance' },
	{ prompt: 'Two successive discounts of 20% and 10% are equivalent to a single discount of:', options: ['30%', '28%', '27%', '25%'], correct: 1, explanation: 'Single discount = 20 + 10 - (20 x 10)/100 = 28%.', topic: 'Profit and loss' },
	{ prompt: 'What is the compound interest on Rs 10,000 at 10% per annum for 2 years, compounded annually?', options: ['Rs 2,000', 'Rs 2,100', 'Rs 2,200', 'Rs 2,010'], correct: 1, explanation: 'Amount = 10000 x 1.1 x 1.1 = 12,100, so CI = Rs 2,100.', topic: 'Compound interest' },
	{ prompt: 'By selling an article for Rs 720, a man loses 10%. At what price should he sell it to gain 15%?', options: ['Rs 900', 'Rs 920', 'Rs 880', 'Rs 960'], correct: 1, explanation: 'CP = 720 / 0.9 = 800. For a 15% gain, SP = 800 x 1.15 = Rs 920.', topic: 'Profit and loss', difficulty: 'hard' }
];
const REASONING: Q[] = [
	{ prompt: 'Find the next number in the series: 3, 8, 15, 24, 35, ?', options: ['46', '48', '49', '50'], correct: 1, explanation: 'The terms are n^2 - 1 for n = 2, 3, 4, 5, 6. Next: 7^2 - 1 = 48.', topic: 'Number series', difficulty: 'easy' },
	{ prompt: 'Find the next number in the series: 2, 6, 12, 20, 30, ?', options: ['40', '42', '44', '36'], correct: 1, explanation: 'The terms are n(n + 1): 1x2, 2x3, 3x4, 4x5, 5x6. Next: 6x7 = 42.', topic: 'Number series', difficulty: 'easy' },
	{ prompt: 'Find the next letter in the series: A, C, F, J, O, ?', options: ['T', 'U', 'V', 'S'], correct: 1, explanation: 'The gaps are +2, +3, +4, +5, so the next gap is +6. O (15) + 6 = U (21).', topic: 'Letter series' },
	{ prompt: 'If CAT is coded as DBU, how is DOG coded in the same language?', options: ['EPH', 'FQI', 'CNF', 'EOH'], correct: 0, explanation: 'Each letter moves one place forward: D to E, O to P, G to H.', topic: 'Coding-decoding', difficulty: 'easy' },
	{ prompt: 'Which number is the odd one out: 27, 64, 125, 144, 216?', options: ['64', '125', '144', '216'], correct: 2, explanation: '27, 64, 125 and 216 are perfect cubes; 144 is a square, not a cube.', topic: 'Classification', difficulty: 'easy' },
	{ prompt: 'Ravi walks 5 km north, turns right and walks 3 km, then turns right again and walks 5 km. How far and in which direction is he from his starting point?', options: ['3 km East', '3 km West', '5 km North', '8 km East'], correct: 0, explanation: 'North 5, east 3, south 5: the north-south legs cancel, leaving him 3 km east of the start.', topic: 'Direction sense' },
	{ prompt: "Pointing to a man, Neha says, \"He is the son of my grandfather's only son.\" How is the man related to Neha?", options: ['Cousin', 'Brother', 'Uncle', 'Father'], correct: 1, explanation: "Her grandfather's only son is her father, and her father's son is her brother.", topic: 'Blood relations' },
	{ prompt: 'Book : Author :: Statue : ?', options: ['Painter', 'Sculptor', 'Architect', 'Carpenter'], correct: 1, explanation: 'An author creates a book; a sculptor creates a statue.', topic: 'Analogy', difficulty: 'easy' },
	{ prompt: 'In a certain code, MONDAY is written as NPOEBZ. How is FRIDAY written in that code?', options: ['GSJEBZ', 'GSKEBZ', 'ESHCZX', 'GTJEBZ'], correct: 0, explanation: 'Each letter moves one place forward: F-G, R-S, I-J, D-E, A-B, Y-Z.', topic: 'Coding-decoding' },
	{ prompt: 'What is the angle between the hour hand and the minute hand of a clock at 3:30?', options: ['75 degrees', '90 degrees', '60 degrees', '82.5 degrees'], correct: 0, explanation: 'Angle = |30H - 5.5M| = |90 - 165| = 75 degrees.', topic: 'Clocks', difficulty: 'hard' }
];

async function seedModule(name: string, subject: string, qs: Q[]) {
	let [mod] = await d.select().from(modules).where(and(eq(modules.name, name), isNull(modules.ownerId)));
	if (!mod) [mod] = await d.insert(modules).values({ name, subjectId: await subjectId(subject), examId: cgl }).returning();
	const ids: string[] = [];
	for (const q of qs) {
		const fp = fingerprint(q.prompt);
		let [row] = await d.select({ id: questions.id }).from(questions).where(eq(questions.fingerprint, fp)).limit(1);
		if (!row)
			[row] = await d
				.insert(questions)
				.values({
					moduleId: mod!.id,
					prompt: q.prompt,
					options: q.options.map((text) => ({ text })),
					correctIndex: q.correct,
					explanation: q.explanation,
					topic: q.topic,
					difficulty: q.difficulty ?? 'medium',
					fingerprint: fp
				})
				.returning({ id: questions.id });
		ids.push(row!.id);
	}
	return ids;
}
const mathIds = await seedModule('SSC CGL Arithmetic: set 1', 'Mathematics', MATHS);
const reasoningIds = await seedModule('SSC CGL Reasoning: set 1', 'Reasoning', REASONING);
log('bank ok');

// ---------- tests ----------
async function seedTest(t: typeof tests.$inferInsert, questionIds: string[]) {
	if ((await d.select({ id: tests.id }).from(tests).where(eq(tests.title, t.title))).length) return null;
	const [row] = await d.insert(tests).values({ ...t, examId: cgl, sessionId: session!.id, status: 'published' }).returning();
	await d.insert(testQuestions).values(questionIds.map((questionId, i) => ({ testId: row!.id, questionId, sortOrder: i })));
	log('test', t.title);
	return row!;
}
await seedTest(
	{ title: 'Arithmetic fundamentals', description: 'Percentages, profit and loss, ratios, interest, time and work.', kind: 'practice', subjectId: maths, difficulty: 'easy', durationMin: 15 },
	mathIds
);
await seedTest(
	{ title: 'Reasoning warm-up', description: 'Series, coding, analogies, directions and clocks.', kind: 'practice', subjectId: reasoning, difficulty: 'easy', durationMin: 12 },
	reasoningIds
);

// Tomorrow 10:00 IST (UTC+5:30, no DST).
const istTomorrow = new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
const startsAt = new Date(`${istTomorrow}T10:00:00+05:30`);
const password = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const live = await seedTest(
	{
		title: 'SSC CGL Live Mock: Quant and Reasoning',
		description: 'Scheduled mock under exam conditions. One attempt, 2 marks per question, 0.5 negative.',
		kind: 'live',
		access: 'password',
		difficulty: 'medium',
		durationMin: 30,
		marksPerQuestion: 2,
		negativeMarks: 0.5,
		startsAt,
		endsAt: new Date(startsAt.getTime() + 60 * 60_000),
		maxAttempts: 1,
		passwordHash: await Bun.password.hash(password)
	},
	[...mathIds, ...reasoningIds]
);
if (live) log(`live test opens ${startsAt.toISOString()}; access password (shown once): ${password}`);

// ---------- banners ----------
const BANNERS = [
	{ title: 'SSC CGL Foundation Batch: admissions open', subtitle: 'Arithmetic, reasoning and English from the basics, with weekly tests.', ctaLabel: 'View courses', href: '/app/learn' },
	{ title: 'All India Live Mock Test Series', subtitle: 'Scheduled mocks with rank, percentile and full solutions.', ctaLabel: 'See tests', href: '/app/tests' },
	{ title: 'Free revision notes and formula sheets', subtitle: 'Quick sheets for maths, reasoning, English and GK.', ctaLabel: 'Read notes', href: '/app/notes' }
];
for (const [i, b] of BANNERS.entries())
	if (!(await d.select({ id: banners.id }).from(banners).where(eq(banners.title, b.title))).length)
		await d.insert(banners).values({ ...b, sortOrder: i });

// ---------- settings placeholders (keys from features/site/schema.ts) ----------
const SETTINGS: Record<string, unknown> = {
	heroHeadline: 'Crack SSC, Railway, MPPSC and MP Police exams with UCI',
	heroSubline: 'Structured courses, revision notes and live mock tests with ranks and full solutions.',
};
for (const [key, value] of Object.entries(SETTINGS)) await d.insert(settings).values({ key, value }).onConflictDoNothing();

// Drop cached reads so the app sees the seed immediately.
await invalidate(cacheKeys.taxonomy, cacheKeys.sessions, cacheKeys.banners, cacheKeys.site, cacheKeys.catalog, cacheKeys.notesIndex, cacheKeys.testsIndex);
log('done');
process.exit(0);
