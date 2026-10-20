import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../src/lib/server/env';
import {
	banners,
	chapters,
	courses,
	examCategories,
	exams,
	lessons,
	notes,
	questions,
	tests
} from '../src/lib/server/db/schema';

const COURSE_TITLE = 'SSC CGL Quantitative Aptitude';

const lessonSeeds = [
	{
		title: 'Percentages and conversions',
		kind: 'video' as const,
		durationMinutes: 28,
		resourceUrl: 'https://www.youtube.com/watch?v=lnYyJLYFv_w',
		body: `A percent is a fraction with denominator 100. On a timed paper, convert first, then multiply.

- 12.5% = 1/8
- 20% = 1/5
- 25% = 1/4
- 33 1/3% = 1/3`
	},
	{
		title: 'Profit loss and discount',
		kind: 'video' as const,
		durationMinutes: 34,
		resourceUrl: 'https://www.youtube.com/watch?v=bHAZLdD3mDE',
		body: `Profit and loss use **cost price** as the base. Discount uses **marked price**.

Two successive discounts of 20% and 10% are not 30%. Apply the second to what remains after the first.`
	},
	{
		title: 'Ratio and proportion',
		kind: 'video' as const,
		durationMinutes: 33,
		resourceUrl: 'https://www.youtube.com/watch?v=USmi5xPR2OY',
		body: `A ratio a:b means the first share is a/(a+b) of the whole.

When four quantities stay in proportion, a/b = c/d means ad = bc.`
	}
];

const noteSeeds = [
	{
		title: 'Percentage quick sheet',
		description: 'The conversions and the two bases percent questions actually use.',
		subject: 'Mathematics',
		body: `## Conversions

| Fraction | Percent |
| --- | --- |
| 1/2 | 50 |
| 1/3 | 33 1/3 |
| 1/4 | 25 |
| 1/5 | 20 |
| 1/8 | 12.5 |
| 1/10 | 10 |

## Which number is the base

- A percent **of** a number uses that number as the base.
- A percent **change** uses the original value, not the new one.
- If a value becomes 80% of what it was, it fell by **20%**, not by 80%.`
	},
	{
		title: 'Reasoning number series',
		description: 'Name the step between terms before guessing the next one.',
		subject: 'Reasoning',
		body: `Read the gaps before you read the terms. Write the rule in words, apply it once, and only then look at the options.

## What the gap means

- A steady gap is an arithmetic series.
- A gap that itself grows by a constant is a second-level pattern.
- If the terms jump by multiplication, test ×2, ×3, or a multiply followed by a small add.`
	},
	{
		title: 'English subject-verb agreement',
		description: 'Which noun the verb has to match.',
		subject: 'English',
		body: `The verb agrees with the subject, not with a noun that merely sits closer to it.

## Does not turn a singular subject plural

- along with
- as well as
- together with

## Singular on its own

**Each**, **everyone**, and **neither** take a singular verb.

## Or

When two subjects are joined by **or**, the verb follows the subject nearer to it.`
	}
];

const questionSeeds = [
	{
		prompt: 'What is 12% of 150?',
		options: ['18', '15', '12', '21'],
		correctIndex: 0,
		explanation: '12% means 12 per 100. 0.12 × 150 = 18.'
	},
	{
		prompt: 'A pen marked at ₹400 is sold at a discount of 15%. What is the selling price?',
		options: ['₹320', '₹340', '₹360', '₹380'],
		correctIndex: 1,
		explanation: '15% of 400 is 60. The selling price is 400 − 60 = 340.'
	},
	{
		prompt: 'A score rises from 40 to 50. The percentage increase is',
		options: ['10%', '20%', '25%', '50%'],
		correctIndex: 2,
		explanation: 'The rise is 10 on a base of 40. 10/40 = 1/4 = 25%.'
	}
];

const client = postgres(env().DATABASE_URL, { prepare: false, max: 1 });
const database = drizzle(client, { casing: 'snake_case' });

async function main() {
	await database.transaction(async (tx) => {
		let [category] = await tx
			.select({ id: examCategories.id })
			.from(examCategories)
			.where(or(eq(examCategories.slug, 'ssc'), eq(examCategories.name, 'SSC')))
			.limit(1);
		if (!category) {
			const [created] = await tx
				.insert(examCategories)
				.values({ name: 'SSC', slug: 'ssc' })
				.returning({ id: examCategories.id });
			category = created;
		}
		if (!category) throw new Error('Could not seed the SSC category.');

		let [exam] = await tx
			.select({ id: exams.id })
			.from(exams)
			.where(or(eq(exams.slug, 'ssc-cgl'), eq(exams.name, 'SSC CGL')))
			.limit(1);
		if (!exam) {
			const [created] = await tx
				.insert(exams)
				.values({ categoryId: category.id, name: 'SSC CGL', slug: 'ssc-cgl' })
				.returning({ id: exams.id });
			exam = created;
		}
		if (!exam) throw new Error('Could not seed SSC CGL.');

		const [existingCourse] = await tx
			.select({ id: courses.id })
			.from(courses)
			.where(eq(courses.title, COURSE_TITLE))
			.limit(1);
		let courseId = existingCourse?.id;
		if (existingCourse) {
			await tx.update(courses).set({ lessonCount: 3 }).where(eq(courses.id, existingCourse.id));
		} else {
			const [course] = await tx
				.insert(courses)
				.values({
					title: COURSE_TITLE,
					description:
						'A short course in the arithmetic SSC CGL actually tests: converting between fractions and percents, then using those conversions on profit, discount, and ratio.',
					instructor: 'UCI Faculty',
					exam: 'SSC CGL',
					lessonCount: 3,
					durationMinutes: 95,
					pricePaise: 0,
					published: true
				})
				.returning({ id: courses.id });
			if (!course) throw new Error('Could not seed the course.');
			courseId = course.id;
			const [chapter] = await tx
				.insert(chapters)
				.values({ courseId: course.id, title: 'Arithmetic foundations', sortOrder: 0 })
				.returning({ id: chapters.id });
			if (!chapter) throw new Error('Could not seed the chapter.');
			await tx.insert(lessons).values(
				lessonSeeds.map((lesson, sortOrder) => ({
					chapterId: chapter.id,
					title: lesson.title,
					kind: lesson.kind,
					durationMinutes: lesson.durationMinutes,
					resourceUrl: lesson.resourceUrl,
					body: lesson.body,
					sortOrder
				}))
			);
		}

		/* Keep existing installs on the LMS path: upgrade seed lessons to video + YouTube. */
		let chapterId: string | null = null;
		if (courseId) {
			const chapterRows = await tx
				.select({ id: chapters.id })
				.from(chapters)
				.where(eq(chapters.courseId, courseId))
				.orderBy(asc(chapters.sortOrder), asc(chapters.id));
			chapterId = chapterRows[0]?.id ?? null;
			for (const chapter of chapterRows) {
				const rows = await tx
					.select({ id: lessons.id, title: lessons.title })
					.from(lessons)
					.where(eq(lessons.chapterId, chapter.id));
				for (const row of rows) {
					const seed = lessonSeeds.find((l) => l.title === row.title);
					if (!seed) continue;
					await tx
						.update(lessons)
						.set({
							kind: seed.kind,
							resourceUrl: seed.resourceUrl,
							body: seed.body,
							durationMinutes: seed.durationMinutes
						})
						.where(eq(lessons.id, row.id));
				}
			}
		}

		for (const note of noteSeeds) {
			const [existing] = await tx
				.select({ id: notes.id })
				.from(notes)
				.where(eq(notes.title, note.title))
				.limit(1);
			if (existing) {
				await tx
					.update(notes)
					.set({
						description: note.description,
						body: note.body,
						subject: note.subject
					})
					.where(eq(notes.id, existing.id));
				continue;
			}
			await tx.insert(notes).values({
				title: note.title,
				description: note.description,
				body: note.body,
				subject: note.subject,
				exam: 'SSC CGL',
				published: true
			});
		}

		const [existingTest] = await tx
			.select({ id: tests.id })
			.from(tests)
			.where(eq(tests.title, 'Percentages practice'))
			.limit(1);
		if (!existingTest) {
			const [test] = await tx
				.insert(tests)
				.values({
					title: 'Percentages practice',
					subject: 'Mathematics',
					topic: 'Percentages',
					durationMinutes: 10,
					difficulty: 'Easy',
					published: true,
					examId: exam.id,
					testType: 'practice',
					description: 'Ten minutes, three questions, and a quarter-mark penalty for a wrong answer.',
					instructions:
						'Choose one option. A correct answer scores 1 mark. A wrong answer costs 0.25 marks. An unanswered question scores nothing. The clock stops at 10 minutes.',
					marksPerQuestionMilli: 1000,
					negativeMilli: 250,
					status: 'live',
					accessType: 'free',
					joinCode: 'PCT80',
					language: 'English'
				})
				.returning({ id: tests.id });
			if (!test) throw new Error('Could not seed the practice test.');
			await tx.insert(questions).values(
				questionSeeds.map((question, sortOrder) => ({
					testId: test.id,
					prompt: question.prompt,
					options: question.options,
					correctIndex: question.correctIndex,
					explanation: question.explanation,
					topic: 'Percentages',
					difficulty: 'Easy',
					sortOrder,
					marksMilli: 1000,
					negativeMilli: 250
				}))
			);
		} else {
			await tx
				.update(tests)
				.set({ joinCode: 'PCT80', accessType: 'free' })
				.where(and(eq(tests.id, existingTest.id), isNull(tests.joinCode)));
		}

		const [existingPassword] = await tx
			.select({ id: tests.id })
			.from(tests)
			.where(eq(tests.title, 'Ratio — password paper'))
			.limit(1);
		if (!existingPassword) {
			const passwordHash = await Bun.password.hash('ratio');
			const [test] = await tx
				.insert(tests)
				.values({
					title: 'Ratio — password paper',
					subject: 'Mathematics',
					topic: 'Ratio',
					durationMinutes: 8,
					difficulty: 'Easy',
					published: true,
					examId: exam.id,
					testType: 'practice',
					description: 'A short ratio paper. Your teacher shares the password separately.',
					instructions:
						'Choose one option. A correct answer scores 1 mark. A wrong answer costs 0.25 marks. An unanswered question scores nothing.',
					marksPerQuestionMilli: 1000,
					negativeMilli: 250,
					status: 'live',
					accessType: 'password',
					accessPasswordHash: passwordHash,
					language: 'English'
				})
				.returning({ id: tests.id });
			if (!test) throw new Error('Could not seed the password test.');
			await tx.insert(questions).values([
				{
					testId: test.id,
					prompt: 'Divide ₹900 in the ratio 2:3. The larger share is',
					options: ['₹360', '₹450', '₹540', '₹600'],
					correctIndex: 2,
					explanation: 'Five parts make 900, so one part is 180. The larger share is 3 × 180 = 540.',
					topic: 'Ratio',
					difficulty: 'Easy',
					sortOrder: 0,
					marksMilli: 1000,
					negativeMilli: 250
				},
				{
					testId: test.id,
					prompt: 'If a:b = 3:4 and b:c = 2:5, then a:c is',
					options: ['3:5', '3:10', '6:20', '3:20'],
					correctIndex: 1,
					explanation: 'Make b the same: a:b = 3:4 = 6:8 and b:c = 2:5 = 8:20. So a:c = 6:20 = 3:10.',
					topic: 'Ratio',
					difficulty: 'Easy',
					sortOrder: 1,
					marksMilli: 1000,
					negativeMilli: 250
				}
			]);
		}

		const [existingModule] = await tx
			.select({ id: tests.id })
			.from(tests)
			.where(eq(tests.title, 'Percentages — previous paper'))
			.limit(1);
		if (!existingModule && chapterId) {
			const [test] = await tx
				.insert(tests)
				.values({
					title: 'Percentages — previous paper',
					subject: 'Mathematics',
					topic: 'Percentages',
					durationMinutes: 10,
					difficulty: 'Easy',
					published: true,
					examId: exam.id,
					testType: 'pyq',
					description: 'A previous-year set attached to the arithmetic module.',
					instructions:
						'Choose one option. A correct answer scores 1 mark. A wrong answer costs 0.25 marks. An unanswered question scores nothing.',
					marksPerQuestionMilli: 1000,
					negativeMilli: 250,
					status: 'live',
					accessType: 'free',
					isVerifiedPyq: true,
					chapterId,
					language: 'English'
				})
				.returning({ id: tests.id });
			if (!test) throw new Error('Could not seed the module test.');
			await tx.insert(questions).values(
				questionSeeds.map((question, sortOrder) => ({
					testId: test.id,
					prompt: question.prompt,
					options: question.options,
					correctIndex: question.correctIndex,
					explanation: question.explanation,
					topic: 'Percentages',
					difficulty: 'Easy',
					sortOrder,
					marksMilli: 1000,
					negativeMilli: 250
				}))
			);
		}

		const [existingBanner] = await tx
			.select({ id: banners.id })
			.from(banners)
			.where(eq(banners.title, 'All India practice tests'))
			.limit(1);
		if (!existingBanner) {
			await tx.insert(banners).values({
				title: 'All India practice tests',
				subtitle: 'Ten-minute sets with negative marking.',
				ctaLabel: 'Start',
				href: '/tests',
				enabled: true,
				sortOrder: 0
			});
		}
	});
}

try {
	await main();
} catch (error) {
	console.error(error);
	await client.end({ timeout: 5 });
	process.exit(1);
}
await client.end({ timeout: 5 });
process.exit(0);
