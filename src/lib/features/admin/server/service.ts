import { count, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { attempts, courses, notes, notifications, tests, users } from '$lib/server/db/schema';

export type AdminStats = {
	students: number;
	courses: number;
	notes: number;
	tests: number;
	attempts: number;
};

export type RecentResult = {
	name: string;
	email: string;
	title: string;
	percentageTenths: number;
	accuracyTenths: number;
	scoreMilli: number;
	maxMilli: number;
	submittedAt: number;
};

function tally(rows: { n: number }[]) {
	return Number(rows[0]?.n ?? 0);
}

export async function stats(): Promise<AdminStats> {
	const [students, courseRows, noteRows, testRows, attemptRows] = await Promise.all([
		db().select({ n: count() }).from(users).where(eq(users.role, 'student')),
		db().select({ n: count() }).from(courses).where(eq(courses.published, true)),
		db().select({ n: count() }).from(notes).where(eq(notes.published, true)),
		db().select({ n: count() }).from(tests).where(eq(tests.published, true)),
		db().select({ n: count() }).from(attempts).where(eq(attempts.status, 'submitted'))
	]);
	return {
		students: tally(students),
		courses: tally(courseRows),
		notes: tally(noteRows),
		tests: tally(testRows),
		attempts: tally(attemptRows)
	};
}

export async function recentResults(): Promise<RecentResult[]> {
	const rows = await db()
		.select({
			name: users.name,
			email: users.email,
			title: tests.title,
			percentageTenths: attempts.percentageTenths,
			accuracyTenths: attempts.accuracyTenths,
			scoreMilli: attempts.scoreMilli,
			maxMilli: attempts.maxMilli,
			submittedAt: attempts.submittedAt
		})
		.from(attempts)
		.innerJoin(users, eq(users.id, attempts.userId))
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(eq(attempts.status, 'submitted'))
		.orderBy(desc(attempts.submittedAt))
		.limit(20);
	return rows.map((row) => ({
		name: row.name,
		email: row.email,
		title: row.title,
		percentageTenths: row.percentageTenths ?? 0,
		accuracyTenths: row.accuracyTenths ?? 0,
		scoreMilli: row.scoreMilli ?? 0,
		maxMilli: row.maxMilli ?? 0,
		submittedAt: row.submittedAt?.getTime() ?? 0
	}));
}

export async function sendNotice(adminId: string, title: string, body: string) {
	const [row] = await db()
		.insert(notifications)
		.values({ title, body, sentBy: adminId })
		.returning({ id: notifications.id });
	if (!row) throw new Error('Could not send the notice.');
	return row.id;
}
