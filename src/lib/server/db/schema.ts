// UCI data model. Contract for every feature service: change it only through the lead.
// Column names are camelCase here and snake_case in Postgres (drizzle casing: 'snake_case').
// One exam taxonomy (examCategories -> exams) is shared by courses, notes, questions and tests.
// Academic sessions -> batches organise students and content as data grows.
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());
const id = () => uuid().primaryKey().defaultRandom();

// ---------- enums ----------
export const userRole = pgEnum('user_role', ['student', 'teacher', 'admin']);
export const difficulty = pgEnum('difficulty', ['easy', 'medium', 'hard']);
/** practice: self-paced, retakes allowed. mock: full-length exam simulation. pyq: previous-year paper. live: scheduled window, one attempt. */
export const testKind = pgEnum('test_kind', ['practice', 'mock', 'pyq', 'live', 'daily']);
/** open: anyone signed in. password: needs the access password. paid: needs a grant (manual, no gateway yet). */
export const testAccess = pgEnum('test_access', ['open', 'password', 'paid']);
export const testStatus = pgEnum('test_status', ['draft', 'published', 'cancelled', 'archived']);
export const attemptStatus = pgEnum('attempt_status', ['in_progress', 'submitted', 'expired']);
export const lessonKind = pgEnum('lesson_kind', ['video', 'reading', 'pdf']);
export const questionSource = pgEnum('question_source', ['manual', 'import', 'ai_topic', 'ai_pdf']);
export const aiJobStatus = pgEnum('ai_job_status', ['queued', 'running', 'ready', 'failed', 'applied']);
export const leadStatus = pgEnum('lead_status', ['new', 'contacted', 'enrolled', 'closed']);

// ---------- people ----------
export const users = pgTable(
	'users',
	{
		id: id(),
		googleSub: text().unique(),
		email: text().notNull().unique(), // lower-cased
		name: text().notNull().default(''),
		avatarUrl: text(),
		phone: text(),
		city: text(),
		role: userRole().notNull().default('student'),
		targetExamId: uuid().references((): AnyPgColumn => exams.id, { onDelete: 'set null' }),
		onboardedAt: timestamp({ withTimezone: true }),
		sessionVersion: integer().notNull().default(0), // bump to revoke every session
		suspendedAt: timestamp({ withTimezone: true }),
		lastSeenAt: timestamp({ withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.role), index().on(t.createdAt)]
);
export type User = typeof users.$inferSelect;

// ---------- taxonomy ----------
export const examCategories = pgTable('exam_categories', {
	id: id(),
	name: text().notNull(),
	slug: text().notNull().unique(),
	description: text().notNull().default(''),
	sortOrder: integer().notNull().default(0),
	enabled: boolean().notNull().default(true),
	createdAt: createdAt()
});

export const exams = pgTable(
	'exams',
	{
		id: id(),
		categoryId: uuid()
			.notNull()
			.references(() => examCategories.id, { onDelete: 'cascade' }),
		name: text().notNull(),
		slug: text().notNull().unique(),
		description: text().notNull().default(''),
		sortOrder: integer().notNull().default(0),
		enabled: boolean().notNull().default(true),
		createdAt: createdAt()
	},
	(t) => [index().on(t.categoryId)]
);

export const subjects = pgTable('subjects', {
	id: id(),
	name: text().notNull().unique(), // Mathematics, Reasoning, English, General Knowledge...
	sortOrder: integer().notNull().default(0)
});

// ---------- academic sessions + batches ----------
export const academicSessions = pgTable('academic_sessions', {
	id: id(),
	name: text().notNull().unique(), // "2026-27"
	startsOn: text().notNull(), // YYYY-MM-DD
	endsOn: text().notNull(),
	isCurrent: boolean().notNull().default(false),
	createdAt: createdAt()
});

export const batches = pgTable(
	'batches',
	{
		id: id(),
		sessionId: uuid()
			.notNull()
			.references(() => academicSessions.id, { onDelete: 'cascade' }),
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		name: text().notNull(), // "SSC CGL Morning"
		joinCode: text().notNull().unique(), // students join with it
		archived: boolean().notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [index().on(t.sessionId)]
);

export const batchMembers = pgTable(
	'batch_members',
	{
		batchId: uuid()
			.notNull()
			.references(() => batches.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		joinedAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.batchId, t.userId] }), index().on(t.userId)]
);

// ---------- files (Cloudflare R2, private) ----------
export const files = pgTable('files', {
	id: id(),
	key: text().notNull().unique(), // R2 object key
	name: text().notNull(),
	mime: text().notNull(),
	size: integer().notNull(),
	ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
	createdAt: createdAt()
});

// ---------- LMS ----------
/** batchId null = visible to every student; otherwise only to that batch's members. */
export const courses = pgTable(
	'courses',
	{
		id: id(),
		slug: text().notNull().unique(),
		title: text().notNull(),
		summary: text().notNull().default(''),
		description: text().notNull().default(''), // markdown
		instructor: text().notNull().default('UCI Faculty'),
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		batchId: uuid().references(() => batches.id, { onDelete: 'set null' }),
		coverFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
		coverUrl: text(), // external cover (e.g. YouTube thumbnail) when no file
		isPaid: boolean().notNull().default(false), // needs a course product or the exam pass
		published: boolean().notNull().default(false),
		sortOrder: integer().notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.published), index().on(t.examId)]
);

export const chapters = pgTable(
	'chapters',
	{
		id: id(),
		courseId: uuid()
			.notNull()
			.references(() => courses.id, { onDelete: 'cascade' }),
		title: text().notNull(),
		sortOrder: integer().notNull().default(0)
	},
	(t) => [index().on(t.courseId)]
);

export const lessons = pgTable(
	'lessons',
	{
		id: id(),
		chapterId: uuid()
			.notNull()
			.references(() => chapters.id, { onDelete: 'cascade' }),
		title: text().notNull(),
		kind: lessonKind().notNull().default('video'),
		youtubeId: text(), // 11-char id parsed from any YouTube URL
		durationSec: integer().notNull().default(0),
		body: text().notNull().default(''), // markdown (reading lessons, or notes under a video)
		fileId: uuid().references(() => files.id, { onDelete: 'set null' }), // pdf lessons / attachments
		isPreview: boolean().notNull().default(false), // watchable from the public course page
		sortOrder: integer().notNull().default(0)
	},
	(t) => [index().on(t.chapterId)]
);

export const lessonProgress = pgTable(
	'lesson_progress',
	{
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		lessonId: uuid()
			.notNull()
			.references(() => lessons.id, { onDelete: 'cascade' }),
		positionSec: integer().notNull().default(0), // resume point
		completedAt: timestamp({ withTimezone: true }),
		updatedAt: updatedAt()
	},
	(t) => [primaryKey({ columns: [t.userId, t.lessonId] }), index().on(t.userId, t.updatedAt)]
);

export const notes = pgTable(
	'notes',
	{
		id: id(),
		slug: text().notNull().unique(),
		title: text().notNull(),
		summary: text().notNull().default(''),
		body: text().notNull().default(''), // markdown
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		subjectId: uuid().references(() => subjects.id, { onDelete: 'set null' }),
		batchId: uuid().references(() => batches.id, { onDelete: 'set null' }),
		fileId: uuid().references(() => files.id, { onDelete: 'set null' }), // optional PDF
		isPaid: boolean().notNull().default(false), // needs the exam pass
		published: boolean().notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.published), index().on(t.examId), index().on(t.subjectId)]
);

export const noteBookmarks = pgTable(
	'note_bookmarks',
	{
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		noteId: uuid()
			.notNull()
			.references(() => notes.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.userId, t.noteId] })]
);

// ---------- question bank ----------
/** A teacher's module: a named pool of questions (e.g. "Percentages - set 1"). Tests can be built from modules. */
export const modules = pgTable(
	'modules',
	{
		id: id(),
		name: text().notNull(),
		subjectId: uuid().references(() => subjects.id, { onDelete: 'set null' }),
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.subjectId), index().on(t.examId)]
);

export type QuestionOption = { text: string };
export const questions = pgTable(
	'questions',
	{
		id: id(),
		moduleId: uuid().references(() => modules.id, { onDelete: 'set null' }),
		prompt: text().notNull(), // markdown (KaTeX allowed)
		options: jsonb().$type<QuestionOption[]>().notNull(), // 2..6 options
		promptHi: text(), // Hindi version (teacher-written or AI-translated, reviewed)
		optionsHi: jsonb().$type<QuestionOption[]>(),
		explanationHi: text(),
		correctIndex: integer().notNull(),
		explanation: text().notNull().default(''),
		topic: text().notNull().default(''),
		difficulty: difficulty().notNull().default('medium'),
		imageFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
		source: questionSource().notNull().default('manual'),
		fingerprint: text().notNull(), // normalised prompt hash: duplicate guard
		createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.moduleId), index().on(t.fingerprint), index().on(t.topic)]
);

// ---------- tests ----------
export const tests = pgTable(
	'tests',
	{
		id: id(),
		title: text().notNull(),
		description: text().notNull().default(''),
		instructions: text().notNull().default(''), // markdown; default rules shown when empty
		kind: testKind().notNull().default('practice'),
		access: testAccess().notNull().default('open'),
		status: testStatus().notNull().default('draft'),
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		subjectId: uuid().references(() => subjects.id, { onDelete: 'set null' }),
		sessionId: uuid().references(() => academicSessions.id, { onDelete: 'set null' }), // admin grouping
		batchId: uuid().references(() => batches.id, { onDelete: 'set null' }), // null = every student
		difficulty: difficulty().notNull().default('medium'),
		durationMin: integer().notNull().default(30),
		marksPerQuestion: real().notNull().default(1),
		negativeMarks: real().notNull().default(0),
		passwordHash: text(), // access=password
		priceInr: integer(), // access=paid, display only; access via testGrants
		startsAt: timestamp({ withTimezone: true }), // live window (kind=live); optional opening time otherwise
		endsAt: timestamp({ withTimezone: true }),
		maxAttempts: integer(), // null = unlimited (practice); live forces 1
		shuffleQuestions: boolean().notNull().default(false),
		showSolutions: boolean().notNull().default(true),
		year: integer(), // pyq
		shift: text(), // pyq
		language: text().notNull().default('English'),
		sourceInfo: text().notNull().default(''), // pyq authority
		verifiedPyq: boolean().notNull().default(false),
		createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index().on(t.status, t.kind),
		index().on(t.examId),
		index().on(t.sessionId),
		index().on(t.startsAt)
	]
);

export const testQuestions = pgTable(
	'test_questions',
	{
		testId: uuid()
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		questionId: uuid()
			.notNull()
			.references(() => questions.id, { onDelete: 'restrict' }),
		sortOrder: integer().notNull().default(0),
		marks: real(), // null = test default
		negativeMarks: real()
	},
	(t) => [primaryKey({ columns: [t.testId, t.questionId] }), index().on(t.testId, t.sortOrder)]
);

export const testGrants = pgTable(
	'test_grants',
	{
		testId: uuid()
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		grantedById: uuid().references(() => users.id, { onDelete: 'set null' }),
		note: text().notNull().default(''),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.testId, t.userId] })]
);

/** Password brute-force lockout per (test, user). */
export const testAccessFailures = pgTable(
	'test_access_failures',
	{
		testId: uuid()
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		failures: integer().notNull().default(0),
		lockedUntil: timestamp({ withTimezone: true }),
		updatedAt: updatedAt()
	},
	(t) => [primaryKey({ columns: [t.testId, t.userId] })]
);

export const attempts = pgTable(
	'attempts',
	{
		id: id(),
		testId: uuid()
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		number: integer().notNull().default(1), // 1st, 2nd... try
		status: attemptStatus().notNull().default('in_progress'),
		questionOrder: jsonb().$type<string[]>().notNull(), // question ids as served
		startedAt: createdAt(),
		deadlineAt: timestamp({ withTimezone: true }).notNull(), // min(start + duration, test.endsAt)
		submittedAt: timestamp({ withTimezone: true }),
		score: real(),
		maxScore: real(),
		correct: integer(),
		wrong: integer(),
		skipped: integer(),
		timeTakenSec: integer()
	},
	(t) => [
		index().on(t.userId, t.startedAt),
		index().on(t.testId, t.status, t.score),
		uniqueIndex().on(t.testId, t.userId, t.number)
	]
);

/** Autosaved per answer; grading reads what is here at the deadline. */
export const attemptAnswers = pgTable(
	'attempt_answers',
	{
		attemptId: uuid()
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		questionId: uuid()
			.notNull()
			.references(() => questions.id, { onDelete: 'cascade' }),
		selected: integer(), // null = cleared
		marked: boolean().notNull().default(false), // mark for review
		timeSpentSec: integer().notNull().default(0),
		isCorrect: boolean(), // set at grading
		updatedAt: updatedAt()
	},
	(t) => [primaryKey({ columns: [t.attemptId, t.questionId] })]
);

// ---------- AI ----------
/** One AI generation run (topic or PDF). Output lands here as a draft; a teacher reviews, then applies it to a module/test. */
export const aiJobs = pgTable(
	'ai_jobs',
	{
		id: id(),
		status: aiJobStatus().notNull().default('queued'),
		source: questionSource().notNull(), // ai_topic | ai_pdf
		input: jsonb().$type<Record<string, unknown>>().notNull(), // topic, subject, difficulty, count, fileId, pages...
		output: jsonb().$type<unknown>(), // validated questions
		provider: text(), // gemini | openrouter
		model: text(),
		inputTokens: integer(),
		outputTokens: integer(),
		error: text(),
		createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.createdById, t.createdAt)]
);

// ---------- engagement ----------
/** Home carousel. href is an in-app path. */
export const banners = pgTable('banners', {
	id: id(),
	title: text().notNull(),
	subtitle: text().notNull().default(''),
	ctaLabel: text().notNull().default('Explore'),
	href: text().notNull().default('/app'),
	imageFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
	imageUrl: text(),
	enabled: boolean().notNull().default(true),
	sortOrder: integer().notNull().default(0),
	createdAt: createdAt()
});

/** In-app inbox. batchId null = everyone. */
export const notifications = pgTable(
	'notifications',
	{
		id: id(),
		title: text().notNull(),
		body: text().notNull().default(''),
		href: text(),
		batchId: uuid().references(() => batches.id, { onDelete: 'cascade' }),
		sentById: uuid().references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index().on(t.createdAt)]
);

export const notificationReads = pgTable(
	'notification_reads',
	{
		notificationId: uuid()
			.notNull()
			.references(() => notifications.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		readAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.notificationId, t.userId] })]
);

// ---------- public site (admin-editable) ----------
export const toppers = pgTable('toppers', {
	id: id(),
	name: text().notNull(),
	exam: text().notNull(), // "SSC CGL 2025"
	result: text().notNull(), // "AIR 112" / "Selected"
	photoFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
	quote: text().notNull().default(''),
	sortOrder: integer().notNull().default(0),
	published: boolean().notNull().default(true)
});

export const faculty = pgTable('faculty', {
	id: id(),
	name: text().notNull(),
	subject: text().notNull(),
	bio: text().notNull().default(''),
	photoFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
	sortOrder: integer().notNull().default(0),
	published: boolean().notNull().default(true)
});

/** Admission enquiries from the public site. */
export const leads = pgTable(
	'leads',
	{
		id: id(),
		name: text().notNull(),
		phone: text().notNull(),
		examInterest: text().notNull().default(''),
		message: text().notNull().default(''),
		status: leadStatus().notNull().default('new'),
		createdAt: createdAt()
	},
	(t) => [index().on(t.status, t.createdAt)]
);

/** Key/value site settings (contact phone, WhatsApp, address, socials, intro copy). */
export const settings = pgTable('settings', {
	key: text().primaryKey(),
	value: jsonb().$type<unknown>().notNull(),
	updatedAt: updatedAt()
});

/** Who changed what, for admin accountability. */
export const auditLog = pgTable(
	'audit_log',
	{
		id: id(),
		actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
		action: text().notNull(), // "test.publish"
		target: text().notNull().default(''),
		meta: jsonb().$type<Record<string, unknown>>(),
		createdAt: createdAt()
	},
	(t) => [index().on(t.createdAt)]
);

// ---------- billing (Razorpay) ----------
export const productKind = pgEnum('product_kind', ['exam_pass', 'course', 'test']);
export const paymentStatus = pgEnum('payment_status', ['created', 'paid', 'failed', 'refunded']);

/** Something a student can buy. exam_pass unlocks every paid test/course/note of examId; course/test unlock one item. */
export const products = pgTable(
	'products',
	{
		id: id(),
		kind: productKind().notNull(),
		title: text().notNull(),
		description: text().notNull().default(''), // markdown: what is included
		priceInr: integer().notNull(), // whole rupees
		mrpInr: integer(), // strike-through price
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		courseId: uuid().references(() => courses.id, { onDelete: 'cascade' }),
		testId: uuid().references(() => tests.id, { onDelete: 'cascade' }),
		validityDays: integer(), // null = until validUntil or forever
		validUntil: timestamp({ withTimezone: true }), // e.g. exam date
		active: boolean().notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index().on(t.kind, t.active), index().on(t.examId)]
);

export const payments = pgTable(
	'payments',
	{
		id: id(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		productId: uuid()
			.notNull()
			.references(() => products.id, { onDelete: 'restrict' }),
		amountPaise: integer().notNull(),
		couponId: uuid().references(() => coupons.id, { onDelete: 'set null' }),
		status: paymentStatus().notNull().default('created'),
		razorpayOrderId: text().notNull().unique(),
		razorpayPaymentId: text().unique(),
		receipt: text().notNull().unique(), // UCI-2026-000123
		error: text(),
		paidAt: timestamp({ withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [index().on(t.userId, t.createdAt), index().on(t.status, t.createdAt)]
);

/** What a user may access. One row per (user, product); paid or granted by staff. */
export const entitlements = pgTable(
	'entitlements',
	{
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		productId: uuid()
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		paymentId: uuid().references(() => payments.id, { onDelete: 'set null' }),
		grantedById: uuid().references(() => users.id, { onDelete: 'set null' }), // manual grant
		expiresAt: timestamp({ withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.userId, t.productId] }), index().on(t.productId)]
);

// ---------- wave 3: parity with Appx-style coaching apps (Army Study, Winners Institute) ----------
export const liveStatus = pgEnum('live_status', ['scheduled', 'live', 'ended', 'cancelled']);
export const doubtStatus = pgEnum('doubt_status', ['open', 'answered', 'closed']);
export const postKind = pgEnum('post_kind', ['current_affairs', 'job_alert', 'syllabus', 'announcement']);

/** Live class on YouTube Live. When it ends, `lessonId` can point at the recording added to a course. */
export const liveClasses = pgTable(
	'live_classes',
	{
		id: id(),
		title: text().notNull(),
		description: text().notNull().default(''),
		youtubeId: text(), // live stream / premiere id
		courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
		batchId: uuid().references(() => batches.id, { onDelete: 'set null' }), // null = everyone
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		teacher: text().notNull().default('UCI Faculty'),
		startsAt: timestamp({ withTimezone: true }).notNull(),
		durationMin: integer().notNull().default(60),
		status: liveStatus().notNull().default('scheduled'),
		lessonId: uuid().references(() => lessons.id, { onDelete: 'set null' }),
		isPaid: boolean().notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [index().on(t.startsAt), index().on(t.batchId)]
);

/** Dated posts: daily current affairs, job alerts, syllabus pages. Markdown body, optional PDF. */
export const posts = pgTable(
	'posts',
	{
		id: id(),
		kind: postKind().notNull(),
		slug: text().notNull().unique(),
		title: text().notNull(),
		body: text().notNull().default(''),
		examId: uuid().references(() => exams.id, { onDelete: 'set null' }),
		fileId: uuid().references(() => files.id, { onDelete: 'set null' }),
		quizTestId: uuid().references(() => tests.id, { onDelete: 'set null' }), // e.g. today's current-affairs quiz
		publishedOn: text().notNull(), // YYYY-MM-DD (IST)
		published: boolean().notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [index().on(t.kind, t.publishedOn), index().on(t.examId)]
);

export const coupons = pgTable('coupons', {
	id: id(),
	code: text().notNull().unique(), // upper-case
	percentOff: integer(), // one of percentOff / amountOffInr
	amountOffInr: integer(),
	productId: uuid().references(() => products.id, { onDelete: 'cascade' }), // null = any product
	maxUses: integer(),
	used: integer().notNull().default(0),
	validUntil: timestamp({ withTimezone: true }),
	active: boolean().notNull().default(true),
	createdAt: createdAt()
});

/** Student doubts on a lesson, question or free text. AI may draft; a teacher answers. */
export const doubts = pgTable(
	'doubts',
	{
		id: id(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		lessonId: uuid().references(() => lessons.id, { onDelete: 'set null' }),
		questionId: uuid().references(() => questions.id, { onDelete: 'set null' }),
		body: text().notNull(),
		imageFileId: uuid().references(() => files.id, { onDelete: 'set null' }),
		aiDraft: text(),
		answer: text(),
		answeredById: uuid().references(() => users.id, { onDelete: 'set null' }),
		status: doubtStatus().notNull().default('open'),
		createdAt: createdAt(),
		answeredAt: timestamp({ withTimezone: true })
	},
	(t) => [index().on(t.status, t.createdAt), index().on(t.userId)]
);

/** Web Push subscriptions (one per device). */
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		endpoint: text().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		p256dh: text().notNull(),
		auth: text().notNull(),
		createdAt: createdAt()
	},
	(t) => [index().on(t.userId)]
);
