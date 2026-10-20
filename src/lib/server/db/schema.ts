import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

export const userRole = pgEnum('user_role', ['student', 'admin']);
export const lessonKind = pgEnum('lesson_kind', ['text', 'video', 'pdf']);
export const testType = pgEnum('test_type', ['practice', 'mock', 'pyq', 'scheduled']);
export const testStatus = pgEnum('test_status', ['draft', 'scheduled', 'live', 'completed', 'cancelled']);
export const accessType = pgEnum('access_type', ['free', 'password', 'paid']);
export const attemptStatus = pgEnum('attempt_status', ['in_progress', 'submitted']);
export const objectPurpose = pgEnum('object_purpose', [
	'note_pdf',
	'banner',
	'thumbnail',
	'lesson',
	'avatar',
	'ai_source'
]);

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		googleSub: text('google_sub').notNull(),
		email: text('email').notNull(),
		name: text('name').notNull(),
		avatarKey: text('avatar_key'),
		role: userRole('role').notNull().default('student'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [uniqueIndex('users_google_sub_unique').on(t.googleSub), uniqueIndex('users_email_unique').on(t.email)]
);

export const sessions = pgTable(
	'sessions',
	{
		tokenHash: text('token_hash').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: ts('expires_at').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const objects = pgTable(
	'objects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		key: text('key').notNull(),
		purpose: objectPurpose('purpose').notNull(),
		contentType: text('content_type').notNull(),
		bytes: integer('bytes').notNull(),
		filename: text('filename').notNull().default(''),
		ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('objects_key_unique').on(t.key)]
);

export const banners = pgTable(
	'banners',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),
		subtitle: text('subtitle').notNull().default(''),
		objectId: uuid('object_id').references(() => objects.id, { onDelete: 'set null' }),
		ctaLabel: text('cta_label').notNull().default('Open'),
		href: text('href'),
		enabled: boolean('enabled').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('banners_enabled_order_idx').on(t.enabled, t.sortOrder)]
);

export const courses = pgTable(
	'courses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		instructor: text('instructor').notNull().default('UCI Faculty'),
		exam: text('exam').notNull().default('SSC'),
		lessonCount: integer('lesson_count').notNull().default(0),
		durationMinutes: integer('duration_minutes').notNull().default(0),
		pricePaise: integer('price_paise').notNull().default(0),
		objectId: uuid('object_id').references(() => objects.id, { onDelete: 'set null' }),
		published: boolean('published').notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('courses_published_idx').on(t.published)]
);

export const chapters = pgTable(
	'chapters',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('chapters_course_idx').on(t.courseId, t.sortOrder)]
);

export const lessons = pgTable(
	'lessons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		chapterId: uuid('chapter_id')
			.notNull()
			.references(() => chapters.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		kind: lessonKind('kind').notNull().default('text'),
		durationMinutes: integer('duration_minutes').notNull().default(0),
		objectId: uuid('object_id').references(() => objects.id, { onDelete: 'set null' }),
		/** YouTube / external URL for video lessons (legacy `resource_url`). */
		resourceUrl: text('resource_url').notNull().default(''),
		body: text('body').notNull().default(''),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('lessons_chapter_idx').on(t.chapterId, t.sortOrder)]
);

export const lessonProgress = pgTable(
	'lesson_progress',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		lessonId: uuid('lesson_id')
			.notNull()
			.references(() => lessons.id, { onDelete: 'cascade' }),
		completedAt: ts('completed_at').notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.lessonId] }), index('lesson_progress_user_idx').on(t.userId)]
);

export const notes = pgTable(
	'notes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		body: text('body').notNull().default(''),
		subject: text('subject').notNull(),
		exam: text('exam').notNull(),
		objectId: uuid('object_id').references(() => objects.id, { onDelete: 'set null' }),
		published: boolean('published').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [index('notes_published_idx').on(t.published), index('notes_subject_idx').on(t.subject)]
);

export const examCategories = pgTable(
	'exam_categories',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description').notNull().default(''),
		sortOrder: integer('sort_order').notNull().default(0),
		enabled: boolean('enabled').notNull().default(true)
	},
	(t) => [uniqueIndex('exam_categories_slug_unique').on(t.slug)]
);

export const exams = pgTable(
	'exams',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => examCategories.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description').notNull().default(''),
		sortOrder: integer('sort_order').notNull().default(0),
		enabled: boolean('enabled').notNull().default(true)
	},
	(t) => [uniqueIndex('exams_slug_unique').on(t.slug), index('exams_category_idx').on(t.categoryId, t.sortOrder)]
);

export const tests = pgTable(
	'tests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),
		subject: text('subject').notNull(),
		topic: text('topic').notNull().default(''),
		durationMinutes: integer('duration_minutes').notNull().default(20),
		difficulty: text('difficulty').notNull().default('Medium'),
		published: boolean('published').notNull().default(false),
		examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
		testType: testType('test_type').notNull().default('practice'),
		description: text('description').notNull().default(''),
		instructions: text('instructions').notNull().default(''),
		marksPerQuestionMilli: integer('marks_per_question_milli').notNull().default(1000),
		negativeMilli: integer('negative_milli').notNull().default(0),
		status: testStatus('status').notNull().default('draft'),
		scheduledStartAt: ts('scheduled_start_at'),
		scheduledEndAt: ts('scheduled_end_at'),
		accessPasswordHash: text('access_password_hash'),
		accessType: accessType('access_type').notNull().default('free'),
		pricePaise: integer('price_paise').notNull().default(0),
		year: integer('year'),
		shift: text('shift'),
		language: text('language').notNull().default('English'),
		isVerifiedPyq: boolean('is_verified_pyq').notNull().default(false),
		/** Short code a student types to open the paper. Null when entry is a password or a module. */
		joinCode: text('join_code'),
		/** Set when this paper belongs to a course module (a chapter). */
		chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('tests_published_idx').on(t.published),
		index('tests_type_idx').on(t.testType),
		index('tests_exam_idx').on(t.examId),
		uniqueIndex('tests_join_code_unique').on(t.joinCode),
		index('tests_chapter_idx').on(t.chapterId)
	]
);

export const questions = pgTable(
	'questions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		testId: uuid('test_id')
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		prompt: text('prompt').notNull(),
		options: text('options').array().notNull(),
		correctIndex: integer('correct_index').notNull(),
		explanation: text('explanation').notNull().default(''),
		topic: text('topic').notNull().default(''),
		difficulty: text('difficulty').notNull().default('Medium'),
		sortOrder: integer('sort_order').notNull().default(0),
		marksMilli: integer('marks_milli').notNull().default(1000),
		negativeMilli: integer('negative_milli').notNull().default(0)
	},
	(t) => [index('questions_test_idx').on(t.testId, t.sortOrder)]
);

export const attempts = pgTable(
	'attempts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		testId: uuid('test_id')
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		startedAt: ts('started_at').notNull().defaultNow(),
		deadlineAt: ts('deadline_at').notNull(),
		submittedAt: ts('submitted_at'),
		scoreMilli: integer('score_milli'),
		maxMilli: integer('max_milli'),
		correctCount: integer('correct_count'),
		wrongCount: integer('wrong_count'),
		unattemptedCount: integer('unattempted_count'),
		percentageTenths: integer('percentage_tenths'),
		accuracyTenths: integer('accuracy_tenths'),
		timeTakenSeconds: integer('time_taken_seconds'),
		status: attemptStatus('status').notNull().default('in_progress')
	},
	(t) => [index('attempts_user_idx').on(t.userId, t.startedAt), index('attempts_test_idx').on(t.testId, t.status)]
);

export const answers = pgTable(
	'answers',
	{
		attemptId: uuid('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		questionId: uuid('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'cascade' }),
		selectedIndex: integer('selected_index')
	},
	(t) => [primaryKey({ columns: [t.attemptId, t.questionId] })]
);

export const purchases = pgTable(
	'purchases',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		testId: uuid('test_id')
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		amountPaise: integer('amount_paise').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('purchases_user_test_unique').on(t.userId, t.testId)]
);

export const unlocks = pgTable(
	'unlocks',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		testId: uuid('test_id')
			.notNull()
			.references(() => tests.id, { onDelete: 'cascade' }),
		unlockedAt: ts('unlocked_at').notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.testId] })]
);

export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	body: text('body').notNull(),
	sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
	sentAt: ts('sent_at').notNull().defaultNow()
});

export const notificationReads = pgTable(
	'notification_reads',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		notificationId: uuid('notification_id')
			.notNull()
			.references(() => notifications.id, { onDelete: 'cascade' }),
		readAt: ts('read_at').notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.userId, t.notificationId] })]
);
