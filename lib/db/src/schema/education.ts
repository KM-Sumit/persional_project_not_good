import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("student"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_mobile_unique").on(table.mobile),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenId: text("token_id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const banners = pgTable(
  "banners",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default("Explore"),
    href: text("href"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("banners_enabled_order_idx").on(table.enabled, table.sortOrder)],
);

export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    instructor: text("instructor").notNull().default("UCI Faculty"),
    category: text("category").notNull().default("SSC"),
    exam: text("exam").notNull().default("SSC"),
    lessonCount: integer("lesson_count").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    priceCents: integer("price_cents").notNull().default(0),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("courses_published_idx").on(table.published),
    index("courses_exam_idx").on(table.exam),
  ],
);

export const courseChapters = pgTable(
  "course_chapters",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("course_chapters_course_order_idx").on(table.courseId, table.sortOrder)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: serial("id").primaryKey(),
    chapterId: integer("chapter_id")
      .notNull()
      .references(() => courseChapters.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("text"),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    resourceUrl: text("resource_url").notNull().default(""),
    body: text("body").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("lessons_chapter_order_idx").on(table.chapterId, table.sortOrder)],
);

export const courseProgress = pgTable(
  "course_progress",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completedLessons: integer("completed_lessons").notNull().default(0),
    lastLessonId: integer("last_lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.courseId] }),
    index("course_progress_user_idx").on(table.userId),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.lessonId] }),
    index("lesson_progress_user_idx").on(table.userId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    body: text("body").notNull().default(""),
    subject: text("subject").notNull(),
    exam: text("exam").notNull(),
    pdfUrl: text("pdf_url").notNull().default(""),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("notes_published_idx").on(table.published),
    index("notes_subject_idx").on(table.subject),
  ],
);

export const examCategories = pgTable(
  "exam_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("award"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("exam_categories_slug_unique").on(table.slug),
    index("exam_categories_enabled_order_idx").on(table.enabled, table.sortOrder),
  ],
);

export const exams = pgTable(
  "exams",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => examCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("exams_slug_unique").on(table.slug),
    index("exams_category_idx").on(table.categoryId, table.sortOrder),
  ],
);

export const tests = pgTable(
  "tests",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    topic: text("topic").notNull(),
    questionCount: integer("question_count").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(20),
    difficulty: text("difficulty").notNull().default("Medium"),
    published: boolean("published").notNull().default(false),
    examId: integer("exam_id").references(() => exams.id, { onDelete: "set null" }),
    testType: text("test_type").notNull().default("practice"), // 'practice' | 'mock' | 'pyq' | 'scheduled'
    description: text("description").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    marksPerQuestion: real("marks_per_question").notNull().default(1.0),
    negativeMarking: real("negative_marking").notNull().default(0.0),
    totalMarks: real("total_marks").notNull().default(0.0),
    status: text("status").notNull().default("draft"), // 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled'
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
    accessPasswordHash: text("access_password_hash"),
    accessType: text("access_type").notNull().default("free"), // 'free' | 'password' | 'paid'
    isPrecision: boolean("is_precision").notNull().default(false),
    price: real("price").notNull().default(0.0),
    bundleName: text("bundle_name").notNull().default(""),
    year: integer("year"),
    shift: text("shift"),
    language: text("language").notNull().default("Hindi"),
    sourceInfo: text("source_info").notNull().default(""),
    isVerifiedPyq: boolean("is_verified_pyq").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("tests_published_idx").on(table.published),
    index("tests_exam_id_idx").on(table.examId),
    index("tests_test_type_idx").on(table.testType),
    index("tests_access_type_idx").on(table.accessType),
    index("tests_scheduled_start_idx").on(table.scheduledStartAt),
    index("tests_status_idx").on(table.status),
  ],
);

export const userPurchases = pgTable(
  "user_purchases",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull().default("test"), // 'test' | 'bundle' | 'exam'
    itemId: integer("item_id").notNull(),
    amount: real("amount").notNull().default(0.0),
    createdAt: createdAt(),
  },
  (table) => [
    index("user_purchases_user_item_idx").on(table.userId, table.itemType, table.itemId),
  ],
);

export const testQuestions = pgTable(
  "test_questions",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation").notNull().default(""),
    topic: text("topic").notNull().default(""),
    difficulty: text("difficulty").notNull().default("Medium"),
    sortOrder: integer("sort_order").notNull().default(0),
    marks: real("marks").notNull().default(1.0),
    negativeMarks: real("negative_marks").notNull().default(0.0),
    createdAt: createdAt(),
  },
  (table) => [index("test_questions_test_order_idx").on(table.testId, table.sortOrder)],
);

export const testAttempts = pgTable(
  "test_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    score: real("score"),
    totalQuestions: integer("total_questions").notNull(),
    correctAnswers: integer("correct_answers"),
    wrongAnswers: integer("wrong_answers"),
    unattempted: integer("unattempted"),
    percentage: real("percentage"),
    accuracy: real("accuracy"),
    timeTakenSeconds: integer("time_taken_seconds"),
    totalMarks: real("total_marks"),
    maxMarks: real("max_marks"),
    status: text("status").notNull().default("in_progress"),
  },
  (table) => [
    index("test_attempts_user_idx").on(table.userId, table.startedAt),
    index("test_attempts_test_idx").on(table.testId),
    index("test_attempts_status_idx").on(table.status),
  ],
);

export const testAnswers = pgTable(
  "test_answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => testAttempts.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => testQuestions.id, { onDelete: "cascade" }),
    selectedOption: integer("selected_option"),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (table) => [
    uniqueIndex("test_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
  ],
);

export const testAccessAttempts = pgTable(
  "test_access_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    testId: integer("test_id").references(() => tests.id, { onDelete: "cascade" }),
    ip: text("ip").notNull().default(""),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("test_access_attempts_user_test_idx").on(table.userId, table.testId),
    index("test_access_attempts_ip_test_idx").on(table.ip, table.testId),
  ],
);