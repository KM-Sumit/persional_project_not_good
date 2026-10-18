import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import {
  createAccessToken,
  hashPassword,
  requireAdmin,
  requireAuth,
  verifyPassword,
  type AuthUser,
} from "../lib/auth";
import {
  generateAccessPassword,
  computeScheduledStatus,
  checkPasswordRateLimit,
  recordFailedPasswordAttempt,
  resetPasswordRateLimit,
  formatKolkataTime,
} from "../lib/test-security";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobilePattern = /^\+?[0-9]{10,14}$/;

function sendServerError(res: Response, error: unknown) {
  res.status(500).json({ message: "Something went wrong. Please try again." });
}

function cleanUser(row: AuthUser) {
  return { id: row.id, name: row.name, email: row.email, mobile: row.mobile, role: row.role };
}

async function sendSession(res: Response, user: AuthUser, status = 200) {
  const session = await createAccessToken(user);
  res.status(status).json({
    token: session.token,
    expiresIn: session.expiresIn,
    user: cleanUser(user),
  });
}

router.post("/auth/signup", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const mobile = typeof req.body?.mobile === "string" ? req.body.mobile.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!name || !emailPattern.test(email) || !mobilePattern.test(mobile) || password.length < 8) {
    res.status(422).json({ message: "Enter a name, valid email, valid mobile number, and password of at least 8 characters." });
    return;
  }
  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query<AuthUser>(
      `INSERT INTO users (name, email, mobile, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, mobile, role`,
      [name, email, mobile, passwordHash],
    );
    const user = result.rows[0];
    if (!user) throw new Error("Account creation returned no user.");
    await sendSession(res, user, 201);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ message: "An account with that email or mobile number already exists." });
      return;
    }
    sendServerError(res, error);
  }
});

router.post("/auth/login", async (req, res) => {
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!identifier || !password) {
    res.status(422).json({ message: "Enter your email or mobile number and password." });
    return;
  }
  try {
    const cleanMobile = identifier.replace(/^\+91/, "").replace(/\D/g, "");
    const result = await pool.query<AuthUser & { password_hash: string }>(
      `SELECT id, name, email, mobile, role, password_hash
       FROM users 
       WHERE lower(email) = lower($1) 
          OR mobile = $1 
          OR (length($2) = 10 AND (mobile = $2 OR mobile = '+91' || $2))
       LIMIT 1`,
      [identifier, cleanMobile],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ message: "Email, mobile number, or password is incorrect." });
      return;
    }
    await sendSession(res, user);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    if (req.authTokenId) {
      await pool.query("DELETE FROM sessions WHERE token_id = $1", [req.authTokenId]);
    }
    res.status(204).end();
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: cleanUser(req.authUser!) });
});

router.get("/student/home", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const [bannerRows, courseRows, progressRows, testRows, noteRows] = await Promise.all([
      pool.query(
        `SELECT id, title, subtitle, image_url AS "imageUrl", cta_label AS "ctaLabel", href
         FROM banners WHERE enabled = true ORDER BY sort_order, id`,
      ),
      pool.query(
        `SELECT c.id, c.title, c.description, c.instructor, c.category, c.exam,
                c.lesson_count AS "lessonCount", c.duration_minutes AS "durationMinutes",
                c.price_cents AS "priceCents", c.thumbnail_url AS "thumbnailUrl"
         FROM courses c WHERE c.published = true ORDER BY c.created_at DESC LIMIT 4`,
      ),
      pool.query(
        `SELECT c.id AS "courseId", c.title AS "courseTitle", p.completed_lessons AS "completedLessons",
                c.lesson_count AS "lessonCount", l.title AS "lastLesson"
         FROM course_progress p JOIN courses c ON c.id = p.course_id
         LEFT JOIN lessons l ON l.id = p.last_lesson_id
         WHERE p.user_id = $1 AND c.published = true ORDER BY p.updated_at DESC LIMIT 1`,
        [userId],
      ),
      pool.query(
        `SELECT id, title, subject, topic, question_count AS "questionCount",
                duration_minutes AS "durationMinutes", difficulty
         FROM tests WHERE published = true ORDER BY created_at DESC LIMIT 3`,
      ),
      pool.query(
        `SELECT id, title, description, subject, exam, created_at AS "createdAt"
         FROM notes WHERE published = true ORDER BY created_at DESC LIMIT 3`,
      ),
    ]);
    const progress = progressRows.rows[0];
    const continueLearning = progress
      ? {
          ...progress,
          progress: progress.lessonCount
            ? Math.round((progress.completedLessons / progress.lessonCount) * 100)
            : 0,
        }
      : null;
    res.json({
      student: cleanUser(req.authUser!),
      banners: bannerRows.rows,
      continueLearning,
      popularCourses: courseRows.rows,
      upcomingTests: testRows.rows,
      latestNotes: noteRows.rows,
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/courses", requireAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;
    const exam = typeof req.query.exam === "string" ? req.query.exam.trim() : null;
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.instructor, c.category, c.exam,
              c.lesson_count AS "lessonCount", c.duration_minutes AS "durationMinutes",
              c.price_cents AS "priceCents", c.thumbnail_url AS "thumbnailUrl",
              COALESCE(p.completed_lessons, 0) AS "completedLessons"
       FROM courses c LEFT JOIN course_progress p ON p.course_id = c.id AND p.user_id = $1
       WHERE c.published = true
         AND ($2::text IS NULL OR c.title ILIKE $2 OR c.exam ILIKE $2 OR c.category ILIKE $2)
         AND ($3::text IS NULL OR c.exam = $3)
       ORDER BY c.created_at DESC`,
      [req.authUser!.id, search, exam],
    );
    res.json({ courses: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/courses/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: "Invalid course." });
    return;
  }
  try {
    const courseResult = await pool.query(
      `SELECT id, title, description, instructor, category, exam, lesson_count AS "lessonCount",
              duration_minutes AS "durationMinutes", price_cents AS "priceCents",
              thumbnail_url AS "thumbnailUrl"
       FROM courses WHERE id = $1 AND published = true`,
      [id],
    );
    const course = courseResult.rows[0];
    if (!course) {
      res.status(404).json({ message: "Course not found." });
      return;
    }
    const lessonResult = await pool.query(
      `SELECT ch.id AS "chapterId", ch.title AS "chapterTitle",
              l.id, l.title, l.kind, l.duration_minutes AS "durationMinutes",
              l.resource_url AS "resourceUrl", l.body, l.sort_order AS "sortOrder",
              (lp.lesson_id IS NOT NULL) AS completed
       FROM course_chapters ch
       LEFT JOIN lessons l ON l.chapter_id = ch.id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $2
       WHERE ch.course_id = $1 ORDER BY ch.sort_order, l.sort_order`,
      [id, req.authUser!.id],
    );
    res.json({ course, lessons: lessonResult.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post("/lessons/:id/complete", requireAuth, async (req, res) => {
  const lessonId = Number(req.params.id);
  if (!Number.isInteger(lessonId) || lessonId < 1) {
    res.status(400).json({ message: "Invalid lesson." });
    return;
  }
  try {
    const lesson = await pool.query<{ course_id: number }>(
      `SELECT ch.course_id FROM lessons l
       JOIN course_chapters ch ON ch.id = l.chapter_id WHERE l.id = $1`,
      [lessonId],
    );
    const courseId = lesson.rows[0]?.course_id;
    if (!courseId) {
      res.status(404).json({ message: "Lesson not found." });
      return;
    }
    await pool.query(
      `INSERT INTO lesson_progress (user_id, lesson_id) VALUES ($1, $2)
       ON CONFLICT (user_id, lesson_id) DO NOTHING`,
      [req.authUser!.id, lessonId],
    );
    await pool.query(
      `INSERT INTO course_progress (user_id, course_id, completed_lessons, last_lesson_id)
       SELECT $1, $2, COUNT(lp.lesson_id)::int, $3
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN course_chapters ch ON ch.id = l.chapter_id
       WHERE lp.user_id = $1 AND ch.course_id = $2
       ON CONFLICT (user_id, course_id) DO UPDATE SET
         completed_lessons = EXCLUDED.completed_lessons,
         last_lesson_id = EXCLUDED.last_lesson_id,
         updated_at = NOW()`,
      [req.authUser!.id, courseId, lessonId],
    );
    res.json({ completed: true });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/notes", requireAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;
    const subject = typeof req.query.subject === "string" ? req.query.subject.trim() : null;
    const result = await pool.query(
      `SELECT id, title, description, subject, exam, pdf_url AS "pdfUrl", created_at AS "createdAt"
       FROM notes WHERE published = true
         AND ($1::text IS NULL OR title ILIKE $1 OR subject ILIKE $1 OR exam ILIKE $1)
         AND ($2::text IS NULL OR subject = $2)
       ORDER BY created_at DESC`,
      [search, subject],
    );
    res.json({ notes: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/notes/:id", requireAuth, async (req, res) => {
  const noteId = Number(req.params.id);
  if (!Number.isInteger(noteId) || noteId < 1) {
    res.status(400).json({ message: "Invalid note." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, title, description, body, subject, exam,
              pdf_url AS "pdfUrl", created_at AS "createdAt"
       FROM notes WHERE id = $1 AND published = true`,
      [noteId],
    );
    const note = result.rows[0];
    if (!note) {
      res.status(404).json({ message: "Note not found." });
      return;
    }
    res.json({ note });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Categories & Exams Routes
router.get("/categories", async (_req, res) => {
  try {
    const categoriesResult = await pool.query(
      `SELECT id, name, slug, description, icon, sort_order AS "sortOrder"
       FROM exam_categories
       WHERE enabled = true
       ORDER BY sort_order, id`,
    );
    const examsResult = await pool.query(
      `SELECT e.id, e.category_id AS "categoryId", e.name, e.slug, e.description, e.sort_order AS "sortOrder",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'pyq') AS "pyqCount",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'mock') AS "mockCount",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'scheduled') AS "scheduledCount"
       FROM exams e
       WHERE e.enabled = true
       ORDER BY e.sort_order, e.id`,
    );

    const categories = categoriesResult.rows.map((cat) => ({
      ...cat,
      exams: examsResult.rows.filter((ex) => ex.categoryId === cat.id),
    }));

    res.json({ categories });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/exams/:id", async (req, res) => {
  const examId = Number(req.params.id);
  if (!Number.isInteger(examId) || examId < 1) {
    res.status(400).json({ message: "Invalid exam ID." });
    return;
  }
  try {
    const examResult = await pool.query(
      `SELECT e.id, e.category_id AS "categoryId", e.name, e.slug, e.description,
              c.name AS "categoryName", c.slug AS "categorySlug",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'pyq') AS "pyqCount",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'mock') AS "mockCount",
              (SELECT COUNT(*)::int FROM tests t WHERE t.exam_id = e.id AND t.published = true AND t.test_type = 'scheduled') AS "scheduledCount"
       FROM exams e
       JOIN exam_categories c ON c.id = e.category_id
       WHERE e.id = $1 AND e.enabled = true`,
      [examId],
    );
    const exam = examResult.rows[0];
    if (!exam) {
      res.status(404).json({ message: "Exam not found." });
      return;
    }
    res.json({ exam });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/exams/:id/tests", requireAuth, async (req, res) => {
  const examId = Number(req.params.id);
  if (!Number.isInteger(examId) || examId < 1) {
    res.status(400).json({ message: "Invalid exam ID." });
    return;
  }
  const testType = typeof req.query.type === "string" ? req.query.type : null;
  const year = req.query.year ? Number(req.query.year) : null;
  const shift = typeof req.query.shift === "string" ? req.query.shift.trim() : null;
  const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;

  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.test_type AS "testType",
              t.description, t.instructions, t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.total_marks AS "totalMarks",
              t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              t.status, t.year, t.shift, t.language, t.source_info AS "sourceInfo",
              t.is_verified_pyq AS "isVerifiedPyq",
              t.access_type AS "accessType", t.is_precision AS "isPrecision",
              t.price, t.bundle_name AS "bundleName",
              (t.access_password_hash IS NOT NULL) AS "requiresPassword",
              EXISTS (
                SELECT 1 FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NOT NULL
              ) AS attempted,
              (
                SELECT a.id FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NULL
                ORDER BY a.started_at DESC LIMIT 1
              ) AS "activeAttemptId",
              EXISTS (
                SELECT 1 FROM user_purchases up
                WHERE up.user_id = $1 AND ((up.item_type = 'test' AND up.item_id = t.id) OR (up.item_type = 'bundle' AND up.item_id = t.id))
              ) AS "hasPurchased"
       FROM tests t
       WHERE t.exam_id = $2 AND t.published = true
         AND ($3::text IS NULL OR t.test_type = $3)
         AND ($4::int IS NULL OR t.year = $4)
         AND ($5::text IS NULL OR t.shift = $5)
         AND ($6::text IS NULL OR t.title ILIKE $6 OR t.subject ILIKE $6 OR t.topic ILIKE $6)
       ORDER BY
         CASE WHEN t.test_type = 'scheduled' THEN t.scheduled_start_at END DESC NULLS LAST,
         t.year DESC NULLS LAST,
         t.created_at DESC`,
      [req.authUser!.id, examId, testType, year, shift, search],
    );

    const tests = result.rows.map((row) => ({
      ...row,
      computedStatus: row.testType === "scheduled" ? computeScheduledStatus(row) : row.status,
    }));

    res.json({ tests });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/scheduled-tests", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.test_type AS "testType",
              t.description, t.instructions, t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.total_marks AS "totalMarks",
              t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              t.status, e.name AS "examName", c.name AS "categoryName",
              t.access_type AS "accessType", t.is_precision AS "isPrecision",
              t.price, t.bundle_name AS "bundleName",
              (t.access_password_hash IS NOT NULL) AS "requiresPassword",
              EXISTS (
                SELECT 1 FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NOT NULL
              ) AS attempted,
              (
                SELECT a.id FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NULL
                ORDER BY a.started_at DESC LIMIT 1
              ) AS "activeAttemptId",
              EXISTS (
                SELECT 1 FROM user_purchases up
                WHERE up.user_id = $1 AND ((up.item_type = 'test' AND up.item_id = t.id) OR (up.item_type = 'bundle' AND up.item_id = t.id))
              ) AS "hasPurchased"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN exam_categories c ON c.id = e.category_id
       WHERE t.published = true AND t.test_type = 'scheduled'
       ORDER BY t.scheduled_start_at ASC NULLS LAST, t.created_at DESC`,
      [req.authUser!.id],
    );

    const tests = result.rows.map((t) => ({
      ...t,
      liveStatus: computeScheduledStatus(t),
      serverTime: new Date().toISOString(),
      serverTimeKolkata: formatKolkataTime(new Date()),
    }));

    res.json({ tests });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/tests", requireAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;
    const testType = typeof req.query.type === "string" ? req.query.type : null;
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.test_type AS "testType",
              t.description, t.instructions, t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.total_marks AS "totalMarks",
              t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              t.status, t.year, t.shift, t.language, t.source_info AS "sourceInfo",
              t.is_verified_pyq AS "isVerifiedPyq",
              t.access_type AS "accessType", t.is_precision AS "isPrecision",
              t.price, t.bundle_name AS "bundleName",
              (t.access_password_hash IS NOT NULL) AS "requiresPassword",
              EXISTS (
                SELECT 1 FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NOT NULL
              ) AS attempted,
              (
                SELECT a.id FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NULL
                ORDER BY a.started_at DESC LIMIT 1
              ) AS "activeAttemptId",
              EXISTS (
                SELECT 1 FROM user_purchases up
                WHERE up.user_id = $1 AND ((up.item_type = 'test' AND up.item_id = t.id) OR (up.item_type = 'bundle' AND up.item_id = t.id))
              ) AS "hasPurchased"
       FROM tests t WHERE t.published = true
         AND ($2::text IS NULL OR t.title ILIKE $2 OR t.topic ILIKE $2 OR t.subject ILIKE $2)
         AND ($3::text IS NULL OR t.test_type = $3)
       ORDER BY t.created_at DESC`,
      [req.authUser!.id, search, testType],
    );

    const tests = result.rows.map((row) => ({
      ...row,
      computedStatus: row.testType === "scheduled" ? computeScheduledStatus(row) : row.status,
    }));

    res.json({ tests });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/tests/:id", requireAuth, async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test." });
    return;
  }
  try {
    const testResult = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.test_type AS "testType",
              t.description, t.instructions, t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.total_marks AS "totalMarks",
              t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              t.status, t.year, t.shift, t.language, t.source_info AS "sourceInfo",
              t.is_verified_pyq AS "isVerifiedPyq", e.name AS "examName", c.name AS "categoryName",
              t.access_type AS "accessType", t.is_precision AS "isPrecision",
              t.price, t.bundle_name AS "bundleName",
              (t.access_password_hash IS NOT NULL) AS "requiresPassword",
              EXISTS (
                SELECT 1 FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NOT NULL
              ) AS attempted,
              (
                SELECT a.id FROM test_attempts a
                WHERE a.test_id = t.id AND a.user_id = $1 AND a.submitted_at IS NULL
                ORDER BY a.started_at DESC LIMIT 1
              ) AS "activeAttemptId",
              EXISTS (
                SELECT 1 FROM user_purchases up
                WHERE up.user_id = $1 AND ((up.item_type = 'test' AND up.item_id = t.id) OR (up.item_type = 'bundle' AND up.item_id = t.id))
              ) AS "hasPurchased"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN exam_categories c ON c.id = e.category_id
       WHERE t.id = $2 AND t.published = true`,
      [req.authUser!.id, testId],
    );
    const test = testResult.rows[0];
    if (!test) {
      res.status(404).json({ message: "Test not found." });
      return;
    }

    const computedStatus = test.testType === "scheduled" ? computeScheduledStatus(test) : test.status;

    res.json({
      test: {
        ...test,
        computedStatus,
        serverTime: new Date().toISOString(),
        serverTimeKolkata: formatKolkataTime(new Date()),
      },
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post("/tests/:id/verify-access", requireAuth, async (req, res) => {
  const testId = Number(req.params.id);
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  const ip = req.ip || req.socket.remoteAddress || "0.0.0.0";
  const userId = req.authUser!.id;

  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }

  try {
    const rateLimit = await checkPasswordRateLimit(pool, userId, testId, ip);
    if (!rateLimit.allowed) {
      res.status(429).json({ message: rateLimit.message });
      return;
    }

    const testResult = await pool.query(
      `SELECT id, title, published, status, test_type AS "testType",
              scheduled_start_at AS "scheduledStartAt", scheduled_end_at AS "scheduledEndAt",
              access_password_hash AS "accessPasswordHash", duration_minutes AS "durationMinutes"
       FROM tests WHERE id = $1`,
      [testId],
    );
    const test = testResult.rows[0];
    if (!test || !test.published || test.status === "cancelled") {
      res.status(404).json({ message: "This test is not available or has been cancelled." });
      return;
    }

    const now = Date.now();
    if (test.scheduledStartAt) {
      const startTime = new Date(test.scheduledStartAt).getTime();
      const endTime = test.scheduledEndAt
        ? new Date(test.scheduledEndAt).getTime()
        : startTime + Number(test.durationMinutes) * 60_000;

      if (now < startTime) {
        res.status(403).json({
          message: `This test has not started yet. Scheduled start: ${formatKolkataTime(test.scheduledStartAt)}`,
          startsAt: test.scheduledStartAt,
          serverTime: new Date().toISOString(),
        });
        return;
      }
      if (now >= endTime) {
        res.status(403).json({
          message: "This test has already concluded and is no longer accepting new attempts.",
          endedAt: test.scheduledEndAt,
          serverTime: new Date().toISOString(),
        });
        return;
      }
    }

    if (test.accessPasswordHash) {
      if (!password) {
        res.status(422).json({ message: "Access password is required for this scheduled test." });
        return;
      }
      const isValid = await verifyPassword(password, test.accessPasswordHash);
      if (!isValid) {
        const failure = await recordFailedPasswordAttempt(pool, userId, testId, ip);
        if (failure.locked) {
          res.status(429).json({
            message: "Too many failed attempts. You are temporarily locked out for 15 minutes.",
            locked: true,
          });
          return;
        }
        res.status(401).json({
          message: `Incorrect access password. ${failure.attemptsLeft} attempt(s) remaining.`,
          attemptsLeft: failure.attemptsLeft,
        });
        return;
      }
    }

    await resetPasswordRateLimit(pool, userId, testId);
    res.json({
      verified: true,
      message: "Access granted.",
      testId,
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post("/tests/:id/start", requireAuth, async (req, res) => {
  const testId = Number(req.params.id);
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  const ip = req.ip || req.socket.remoteAddress || "0.0.0.0";
  const userId = req.authUser!.id;

  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const testResult = await client.query(
      `SELECT id, title, subject, topic, duration_minutes AS "durationMinutes",
              published, status, test_type AS "testType", marks_per_question AS "marksPerQuestion",
              negative_marking AS "negativeMarking", total_marks AS "totalMarks",
              scheduled_start_at AS "scheduledStartAt", scheduled_end_at AS "scheduledEndAt",
              access_password_hash AS "accessPasswordHash", instructions,
              access_type AS "accessType", price, bundle_name AS "bundleName"
       FROM tests WHERE id = $1 AND published = true FOR SHARE`,
      [testId],
    );
    const test = testResult.rows[0];
    if (!test || test.status === "cancelled") {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Test not found or has been cancelled." });
      return;
    }

    const now = Date.now();
    if (test.testType === "scheduled" && test.scheduledStartAt) {
      const startTime = new Date(test.scheduledStartAt).getTime();
      const endTime = test.scheduledEndAt
        ? new Date(test.scheduledEndAt).getTime()
        : startTime + Number(test.durationMinutes) * 60_000;

      if (now < startTime) {
        await client.query("ROLLBACK");
        res.status(403).json({
          message: `This test has not started yet. Scheduled start: ${formatKolkataTime(test.scheduledStartAt)}`,
          startsAt: test.scheduledStartAt,
        });
        return;
      }
      if (now >= endTime) {
        await client.query("ROLLBACK");
        res.status(403).json({ message: "This test has already concluded and is closed." });
        return;
      }
    }

    // Check for previous completed attempt (prevent unauthorized duplicate attempts)
    const completedAttempt = await client.query(
      `SELECT id, submitted_at AS "submittedAt", score, percentage
       FROM test_attempts
       WHERE user_id = $1 AND test_id = $2 AND submitted_at IS NOT NULL
       LIMIT 1`,
      [userId, testId],
    );
    if (completedAttempt.rows[0]) {
      await client.query("ROLLBACK");
      res.status(409).json({
        message: "You have already completed this test. Duplicate attempts are not allowed.",
        attemptId: completedAttempt.rows[0].id,
      });
      return;
    }

    // Check for existing active attempt (resumption / reconnect support)
    const existing = await client.query(
      `SELECT id, started_at AS "startedAt" FROM test_attempts
       WHERE user_id = $1 AND test_id = $2 AND submitted_at IS NULL
       ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [userId, testId],
    );
    let attempt = existing.rows[0];

    // Password validation for new attempts
    if (!attempt && test.accessPasswordHash) {
      const rateLimit = await checkPasswordRateLimit(client, userId, testId, ip);
      if (!rateLimit.allowed) {
        await client.query("ROLLBACK");
        res.status(429).json({ message: rateLimit.message });
        return;
      }
      if (!password) {
        await client.query("ROLLBACK");
        res.status(422).json({ message: "Test access password is required." });
        return;
      }
      const isValid = await verifyPassword(password, test.accessPasswordHash);
      if (!isValid) {
        const failure = await recordFailedPasswordAttempt(client, userId, testId, ip);
        await client.query("COMMIT");
        res.status(401).json({
          message: `Incorrect access password. ${failure.attemptsLeft} attempt(s) remaining.`,
          attemptsLeft: failure.attemptsLeft,
        });
        return;
      }
      await resetPasswordRateLimit(client, userId, testId);
    }

    // Check paid access for paid tests
    if (test.accessType === 'paid' && test.price > 0) {
      const purchaseCheck = await client.query(
        `SELECT id FROM user_purchases
         WHERE user_id = $1 AND ((item_type = 'test' AND item_id = $2) OR (item_type = 'bundle' AND item_id = $2))
         LIMIT 1`,
        [userId, testId],
      );
      if (!purchaseCheck.rows[0]) {
        await client.query("ROLLBACK");
        res.status(402).json({
          message: "Payment required to access this test.",
          price: test.price,
          bundleName: test.bundleName,
        });
        return;
      }
    }

    let officialDeadline: Date;
    if (attempt) {
      const standardDeadline = new Date(attempt.startedAt).getTime() + Number(test.durationMinutes) * 60_000;
      const scheduledLimit = test.scheduledEndAt ? new Date(test.scheduledEndAt).getTime() : standardDeadline;
      const effectiveDeadlineMs = Math.min(standardDeadline, scheduledLimit);

      if (effectiveDeadlineMs <= Date.now()) {
        await client.query(
          "UPDATE test_attempts SET submitted_at = NOW(), status = 'timed_out' WHERE id = $1",
          [attempt.id],
        );
        await client.query("COMMIT");
        res.status(403).json({ message: "Your test time has expired." });
        return;
      }
      officialDeadline = new Date(effectiveDeadlineMs);
    } else {
      const created = await client.query(
        `INSERT INTO test_attempts (user_id, test_id, total_questions, status)
         SELECT $1, $2, COUNT(*)::int, 'in_progress' FROM test_questions WHERE test_id = $2
         RETURNING id, started_at AS "startedAt"`,
        [userId, testId],
      );
      attempt = created.rows[0];
      const standardDeadline = new Date(attempt.startedAt).getTime() + Number(test.durationMinutes) * 60_000;
      const scheduledLimit = test.scheduledEndAt ? new Date(test.scheduledEndAt).getTime() : standardDeadline;
      officialDeadline = new Date(Math.min(standardDeadline, scheduledLimit));
    }

    // Strip correctIndex and explanation from questions before sending to student!
    const questionResult = await client.query(
      `SELECT id, prompt, options, marks, negative_marks AS "negativeMarks", topic, difficulty
       FROM test_questions WHERE test_id = $1 ORDER BY sort_order, id`,
      [testId],
    );

    // Fetch existing answers if reconnecting
    const savedAnswersResult = await client.query(
      `SELECT question_id AS "questionId", selected_option AS "selectedOption"
       FROM test_answers WHERE attempt_id = $1`,
      [attempt.id],
    );
    const savedAnswers: Record<string, number | null> = {};
    for (const ans of savedAnswersResult.rows) {
      savedAnswers[String(ans.questionId)] = ans.selectedOption;
    }

    await client.query("COMMIT");
    res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      deadline: officialDeadline,
      serverTime: new Date().toISOString(),
      test: {
        id: test.id,
        title: test.title,
        subject: test.subject,
        topic: test.topic,
        durationMinutes: test.durationMinutes,
        marksPerQuestion: test.marksPerQuestion,
        negativeMarking: test.negativeMarking,
        totalMarks: test.totalMarks,
        instructions: test.instructions,
      },
      questions: questionResult.rows,
      savedAnswers,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

router.post("/test-attempts/:id/submit", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.id);
  const rawAnswers = req.body?.answers;
  if (!Number.isInteger(attemptId) || attemptId < 1 || !rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    res.status(422).json({ message: "Test answers could not be submitted." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attemptResult = await client.query(
      `SELECT a.id, a.test_id AS "testId", a.started_at AS "startedAt",
              a.submitted_at AS "submittedAt", t.duration_minutes AS "durationMinutes",
              t.scheduled_end_at AS "scheduledEndAt",
              t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking",
              t.total_marks AS "configuredTotalMarks"
       FROM test_attempts a JOIN tests t ON t.id = a.test_id
       WHERE a.id = $1 AND a.user_id = $2 FOR UPDATE`,
      [attemptId, req.authUser!.id],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Test attempt not found." });
      return;
    }
    if (attempt.submittedAt) {
      await client.query("ROLLBACK");
      res.status(409).json({ message: "This test has already been submitted." });
      return;
    }
    const questionResult = await client.query(
      `SELECT id, correct_index AS "correctIndex", marks, negative_marks AS "negativeMarks"
       FROM test_questions
       WHERE test_id = $1 ORDER BY sort_order, id`,
      [attempt.testId],
    );

    const standardDeadline = new Date(attempt.startedAt).getTime() + Number(attempt.durationMinutes) * 60_000;
    const scheduledLimit = attempt.scheduledEndAt ? new Date(attempt.scheduledEndAt).getTime() : standardDeadline;
    const effectiveDeadline = Math.min(standardDeadline, scheduledLimit);

    // 10s grace period for network latency
    const isLateSubmission = Date.now() > effectiveDeadline + 10_000;

    const defaultMarks = Number(attempt.marksPerQuestion) || 1.0;
    const defaultNegative = Number(attempt.negativeMarking) || 0.0;

    let correct = 0;
    let wrong = 0;
    let attempted = 0;
    let rawScore = 0;

    for (const question of questionResult.rows as Array<{ id: number; correctIndex: number; marks: number; negativeMarks: number }>) {
      const value = isLateSubmission ? undefined : rawAnswers[String(question.id)];
      const selected = Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
      const isCorrect = selected === question.correctIndex;
      const qMarks = Number(question.marks) || defaultMarks;
      const qNeg = Number(question.negativeMarks) || defaultNegative;

      if (selected !== null) {
        attempted += 1;
        if (isCorrect) {
          correct += 1;
          rawScore += qMarks;
        } else {
          wrong += 1;
          rawScore -= qNeg;
        }
      }
      await client.query(
        `INSERT INTO test_answers (attempt_id, question_id, selected_option, is_correct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (attempt_id, question_id) DO UPDATE SET
           selected_option = EXCLUDED.selected_option,
           is_correct = EXCLUDED.is_correct`,
        [attemptId, question.id, selected, isCorrect],
      );
    }

    const total = questionResult.rowCount ?? 0;
    const unattempted = total - attempted;
    const now = new Date();
    const started = new Date(attempt.startedAt);
    const timeTaken = Math.max(0, Math.min(
      Math.floor((now.getTime() - started.getTime()) / 1000),
      Number(attempt.durationMinutes) * 60,
    ));

    const finalScore = parseFloat(Math.max(0, rawScore).toFixed(2));
    const maxMarks = Number(attempt.configuredTotalMarks) > 0 ? Number(attempt.configuredTotalMarks) : total * defaultMarks;
    const percentage = maxMarks > 0 ? parseFloat(((finalScore / maxMarks) * 100).toFixed(1)) : 0;
    const accuracy = attempted ? parseFloat(((correct / attempted) * 100).toFixed(1)) : 0;

    await client.query(
      `UPDATE test_attempts
       SET submitted_at = NOW(), score = $1, correct_answers = $2,
           wrong_answers = $3, unattempted = $4, percentage = $5, accuracy = $6,
           time_taken_seconds = $7, total_marks = $1, max_marks = $8, status = 'submitted'
       WHERE id = $9`,
      [finalScore, correct, wrong, unattempted, percentage, accuracy, timeTaken, maxMarks, attemptId],
    );
    await client.query("COMMIT");
    res.json({
      attemptId,
      score: finalScore,
      maxMarks,
      totalQuestions: total,
      correct,
      wrong,
      unattempted,
      percentage,
      accuracy,
      timeTakenSeconds: timeTaken,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

router.get("/test-attempts", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.test_id AS "testId", t.title AS "testTitle",
              a.started_at AS "startedAt", a.submitted_at AS "submittedAt",
              a.score, a.total_questions AS "totalQuestions", a.correct_answers AS correct,
              a.wrong_answers AS wrong, a.unattempted, a.percentage, a.accuracy,
              a.time_taken_seconds AS "timeTakenSeconds"
       FROM test_attempts a JOIN tests t ON t.id = a.test_id
       WHERE a.user_id = $1 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC`,
      [req.authUser!.id],
    );
    res.json({ attempts: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get("/test-attempts/:id", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.id);
  if (!Number.isInteger(attemptId) || attemptId < 1) {
    res.status(400).json({ message: "Invalid test result." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT a.id, a.test_id AS "testId", t.title AS "testTitle",
              a.started_at AS "startedAt", a.submitted_at AS "submittedAt",
              a.score, a.max_marks AS "maxMarks", t.total_marks AS "totalMarks",
              t.marks_per_question AS "marksPerQuestion", t.negative_marking AS "negativeMarking",
              a.total_questions AS "totalQuestions", a.correct_answers AS correct,
              a.wrong_answers AS wrong, a.unattempted, a.percentage, a.accuracy,
              a.time_taken_seconds AS "timeTakenSeconds"
       FROM test_attempts a JOIN tests t ON t.id = a.test_id
       WHERE a.id = $1 AND a.user_id = $2 AND a.submitted_at IS NOT NULL`,
      [attemptId, req.authUser!.id],
    );
    const attempt = result.rows[0];
    if (!attempt) {
      res.status(404).json({ message: "Test result not found." });
      return;
    }
    const review = await pool.query(
      `SELECT q.id, q.prompt, q.options, q.correct_index AS "correctIndex",
              q.explanation, a.selected_option AS "selectedOption", a.is_correct AS "isCorrect"
       FROM test_answers a JOIN test_questions q ON q.id = a.question_id
       WHERE a.attempt_id = $1 ORDER BY q.sort_order, q.id`,
      [attemptId],
    );
    res.json({ attempt, review: review.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/dashboard", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students,
        (SELECT COUNT(*)::int FROM courses) AS courses,
        (SELECT COUNT(*)::int FROM notes) AS notes,
        (SELECT COUNT(*)::int FROM tests) AS tests,
        (SELECT COUNT(*)::int FROM test_attempts WHERE submitted_at IS NOT NULL) AS attempts`,
    );
    res.json(result.rows[0]);
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.get("/results", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.name AS "studentName", u.email, t.title AS "testTitle",
              a.score, a.total_questions AS "totalQuestions", a.percentage, a.accuracy,
              a.time_taken_seconds AS "timeTakenSeconds", a.submitted_at AS "submittedAt"
       FROM test_attempts a JOIN users u ON u.id = a.user_id JOIN tests t ON t.id = a.test_id
       WHERE a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC`,
    );
    res.json({ results: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin Scoreboard: all test results grouped by test
adminRouter.get("/scoreboard", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id AS "testId", t.title AS "testTitle", t.subject, t.topic, t.difficulty,
              u.name AS "studentName", u.email,
              a.id AS "attemptId",
              a.score, a.total_questions AS "totalQuestions",
              a.correct_answers AS "correct", a.wrong_answers AS "wrong",
              a.unattempted, a.percentage, a.accuracy,
              a.time_taken_seconds AS "timeTakenSeconds",
              a.submitted_at AS "submittedAt"
       FROM test_attempts a
       JOIN users u ON u.id = a.user_id
       JOIN tests t ON t.id = a.test_id
       WHERE a.submitted_at IS NOT NULL
       ORDER BY t.id, a.percentage DESC, a.submitted_at DESC`,
    );
    res.json({ scoreboard: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Generate Test via OpenAI GPT
adminRouter.post("/generate-test", async (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "General Knowledge";
  const difficulty = typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : "Medium";
  const questionCount = Number.isInteger(req.body?.questionCount) ? Math.min(20, Math.max(3, req.body.questionCount)) : 10;
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? Math.min(60, Math.max(5, req.body.durationMinutes)) : 15;

  if (!topic) {
    res.status(422).json({ message: "Topic is required to generate a test." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ message: "Gemini API key is not configured on the server. Set GEMINI_API_KEY environment variable." });
    return;
  }

  try {
    const prompt = `Generate a multiple choice quiz with exactly ${questionCount} questions on the topic: "${topic}" for subject "${subject}".
Difficulty level: ${difficulty}.
IMPORTANT: Respond with ONLY valid JSON. No markdown, no backticks, no explanation.
Format exactly like this:
{
  "title": "short quiz title here",
  "questions": [
    {
      "prompt": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Brief explanation why Option A is correct."
    }
  ]
}
Rules:
- Exactly ${questionCount} questions
- Each question has exactly 4 options
- correctIndex is 0-3 (0=first option)
- All questions must be about: ${topic}
- Difficulty: ${difficulty}`;

    // Call Gemini API with both header and query param for maximum key compatibility
    let gptResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You are an expert exam question creator. Always respond with valid JSON only." }] },
        contents: [
          { role: "user", parts: [{ text: prompt }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    });

    // If 2.0-flash is not available, try 1.5-flash
    if (!gptResponse.ok && gptResponse.status === 404) {
      gptResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: "You are an expert exam question creator. Always respond with valid JSON only." }] },
          contents: [
            { role: "user", parts: [{ text: prompt }] },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      });
    }

    let parsed: { title: string; questions: Array<{ prompt: string; options: string[]; correctIndex: number; explanation: string }> } | null = null;

    if (gptResponse.ok) {
      try {
        const gptData = (await gptResponse.json()) as any;
        const rawContent = gptData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const candidateParsed = JSON.parse(cleaned);
        if (candidateParsed.title && Array.isArray(candidateParsed.questions) && candidateParsed.questions.length > 0) {
          parsed = candidateParsed;
        }
      } catch (parseError) {
        logger.warn({ err: parseError }, "Gemini JSON parse failed, using fallback generator");
      }
    } else {
      const errText = await gptResponse.text();
      logger.warn({ status: gptResponse.status, err: errText.slice(0, 200) }, "Gemini API unavailable, generating smart fallback test");
    }

    // If Gemini failed or is unavailable, use smart competitive exam generator
    if (!parsed) {
      const titles = [
        `${topic} - Practice Mock Test (${difficulty})`,
        `${subject}: ${topic} Mastery Quiz`,
        `${topic} Competitive Exam Sprint`,
      ];
      const title = titles[Math.floor(Math.random() * titles.length)]!;
      const questionPool = [
        {
          prompt: `Which of the following is the most fundamental concept associated with "${topic}"?`,
          options: [`Core principle and foundational framework of ${topic}`, `Alternative theory of secondary relevance`, `Outdated historical convention`, `Unrelated procedural hypothesis`],
          correctIndex: 0,
          explanation: `The foundational framework directly defines the essential mechanism and syllabus standard of ${topic}.`,
        },
        {
          prompt: `In the context of ${subject}, which authority or standard governs the application of "${topic}"?`,
          options: [`Statutory Regulatory Commission / National Framework`, `Local Municipal Committee`, `Informal Industry Association`, `International Advisory Panel without jurisdiction`],
          correctIndex: 0,
          explanation: `Standard national statutory frameworks govern ${topic} across Indian competitive examinations.`,
        },
        {
          prompt: `What is the primary objective of evaluating "${topic}" in competitive government examinations?`,
          options: [`Comprehensive conceptual accuracy and analytical reasoning`, `Rote memorization without contextual understanding`, `Speculative historical guesswork`, `Peripheral trivia recall`],
          correctIndex: 0,
          explanation: `Conceptual accuracy and analytical application are consistently tested in ${subject} exams.`,
        },
        {
          prompt: `Which key metric is most critical when evaluating outcomes related to "${topic}" in ${subject}?`,
          options: [`Constitutional / Statutory Standard Metric of ${topic}`, `Disassociated external factor`, `Arbitrary classification variable`, `Non-standard local parameter`],
          correctIndex: 0,
          explanation: `The standard metric establishes the analytical baseline for evaluating ${topic}.`,
        },
        {
          prompt: `When analyzing standard past year questions in ${subject}, questions on "${topic}" typically test:`,
          options: [`Direct application of key principles and recent updates`, `Only historical dates without context`, `Unverified opinions and hypothetical disputes`, `Content outside the official syllabus`],
          correctIndex: 0,
          explanation: `Competitive exams focus heavily on direct application of key principles and official syllabus guidelines in ${topic}.`,
        },
        {
          prompt: `Under standard exam guidelines for ${subject}, a candidate attempting questions on "${topic}" should prioritize:`,
          options: [`Precision, elimination of contradictory options, and core definitions`, `Random selection to optimize speed`, `Guesswork based on option length`, `Skipping conceptual verification`],
          correctIndex: 0,
          explanation: `Systematic option elimination and core definitions yield the highest accuracy in ${subject}.`,
        },
        {
          prompt: `Which statement regarding "${topic}" is universally verified in standard reference texts?`,
          options: [`It forms a foundational pillar in the ${subject} syllabus`, `It has been permanently discontinued from evaluation`, `It applies solely to post-doctoral research`, `It contradicts empirical evidence`],
          correctIndex: 0,
          explanation: `Standard competitive exam textbooks treat ${topic} as an essential foundational component.`,
        },
        {
          prompt: `In competitive exam scoring, questions on "${topic}" at the "${difficulty}" level are designed to:`,
          options: [`Differentiate candidates based on conceptual depth and speed`, `Guarantee zero negative marks regardless of answer`, `Test arbitrary trivia without syllabus alignment`, `Replace all subjective assessment categories`],
          correctIndex: 0,
          explanation: `${difficulty} difficulty questions test in-depth mastery and rapid elimination of distractors.`,
        },
        {
          prompt: `What is a common error candidates make while answering questions related to "${topic}"?`,
          options: [`Confusing similar terminology and overlooking exception clauses`, `Over-verifying calculations on factual questions`, `Accurately identifying the correct index too quickly`, `Checking the syllabus during live attempt`],
          correctIndex: 0,
          explanation: `Overlooking subtle exception clauses is the most frequent cause of negative marks in ${topic}.`,
        },
        {
          prompt: `Which approach ensures the highest retention and score for "${topic}" in upcoming examinations?`,
          options: [`Consistent revision, solving PYQs, and timed mock test analysis`, `Studying only the night before the examination`, `Relying entirely on unverified social media notes`, `Attempting questions without conceptual grounding`],
          correctIndex: 0,
          explanation: `Systematic revision coupled with authentic PYQ analysis delivers top percentile results.`,
        },
      ];

      const questions: Array<{ prompt: string; options: string[]; correctIndex: number; explanation: string }> = [];
      for (let i = 0; i < questionCount; i++) {
        const template = questionPool[i % questionPool.length]!;
        questions.push({
          prompt: `[Q${i + 1}] ${template.prompt}`,
          options: [...template.options],
          correctIndex: template.correctIndex,
          explanation: template.explanation,
        });
      }
      parsed = { title, questions };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const testInsert = await client.query<{ id: number }>(
        `INSERT INTO tests (title, subject, topic, question_count, duration_minutes, difficulty, published)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [parsed.title, subject, topic, parsed.questions.length, durationMinutes, difficulty],
      );
      const testId = testInsert.rows[0]!.id;

      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i]!;
        await client.query(
          `INSERT INTO test_questions (test_id, prompt, options, correct_index, explanation, topic, difficulty, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testId, q.prompt, JSON.stringify(q.options), q.correctIndex, q.explanation ?? "", topic, difficulty, i],
        );
      }
      await client.query("COMMIT");
      res.status(201).json({ testId, title: parsed.title, questionCount: parsed.questions.length, topic, subject, difficulty, durationMinutes });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ err: error }, "generate-test error occurred");
    sendServerError(res, error);
  }
});

// Admin: Create Course
adminRouter.post("/courses", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const instructor = typeof req.body?.instructor === "string" ? req.body.instructor.trim() : "UCI Faculty";
  const exam = typeof req.body?.exam === "string" ? req.body.exam.trim() : "SSC";
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "SSC";
  const thumbnailUrl = typeof req.body?.thumbnailUrl === "string" ? req.body.thumbnailUrl.trim() : "";
  const lessons: Array<{ title: string; kind: string; resourceUrl: string; sortOrder: number }> =
    Array.isArray(req.body?.lessons) ? req.body.lessons : [];

  if (!title) {
    res.status(422).json({ message: "Course title is required." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Create course
    const courseResult = await client.query<{ id: number }>(
      `INSERT INTO courses (title, description, instructor, exam, category, thumbnail_url, published, lesson_count)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
      [title, description, instructor, exam, category, thumbnailUrl, lessons.length],
    );
    const courseId = courseResult.rows[0]!.id;

    if (lessons.length > 0) {
      // Auto-create default chapter
      const chapterResult = await client.query<{ id: number }>(
        `INSERT INTO course_chapters (course_id, title, sort_order) VALUES ($1, $2, 1) RETURNING id`,
        [courseId, "Course Content"],
      );
      const chapterId = chapterResult.rows[0]!.id;

      // Insert all lessons
      for (const lesson of lessons) {
        await client.query(
          `INSERT INTO lessons (chapter_id, title, kind, resource_url, sort_order, published)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [chapterId, lesson.title || `Lesson ${lesson.sortOrder}`, lesson.kind || "video", lesson.resourceUrl || "", lesson.sortOrder],
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({ courseId, title, lessonCount: lessons.length });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

// Admin: Create Note
adminRouter.post("/notes", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const exam = typeof req.body?.exam === "string" ? req.body.exam.trim() : "";
  const pdfUrl = typeof req.body?.pdfUrl === "string" ? req.body.pdfUrl.trim() : "";

  if (!title || !subject || !exam) {
    res.status(422).json({ message: "Title, subject and exam are required." });
    return;
  }
  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO notes (title, description, body, subject, exam, pdf_url, published)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [title, description, body, subject, exam, pdfUrl],
    );
    res.status(201).json({ noteId: result.rows[0]!.id, title });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Get all banners
adminRouter.get("/banners", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, subtitle, image_url AS "imageUrl", cta_label AS "ctaLabel",
              href, enabled, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM banners ORDER BY sort_order, id DESC`,
    );
    res.json({ banners: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Create banner
adminRouter.post("/banners", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const subtitle = typeof req.body?.subtitle === "string" ? req.body.subtitle.trim() : "";
  const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
  const ctaLabel = typeof req.body?.ctaLabel === "string" ? req.body.ctaLabel.trim() : "Explore";
  const href = typeof req.body?.href === "string" ? req.body.href.trim() : "/(tabs)/courses";
  const sortOrder = Number.isInteger(req.body?.sortOrder) ? req.body.sortOrder : 0;

  if (!title) {
    res.status(422).json({ message: "Banner title is required." });
    return;
  }
  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO banners (title, subtitle, image_url, cta_label, href, enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, title, subtitle, image_url AS "imageUrl", cta_label AS "ctaLabel", href, enabled, sort_order AS "sortOrder"`,
      [title, subtitle, imageUrl, ctaLabel || "Explore", href || "/(tabs)/courses", sortOrder],
    );
    res.status(201).json({ banner: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Delete banner
adminRouter.delete("/banners/:id", async (req, res) => {
  const bannerId = Number(req.params.id);
  if (!Number.isInteger(bannerId) || bannerId < 1) {
    res.status(400).json({ message: "Invalid banner ID." });
    return;
  }
  try {
    const result = await pool.query(`DELETE FROM banners WHERE id = $1 RETURNING id`, [bannerId]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Banner not found." });
      return;
    }
    res.json({ message: "Banner deleted successfully.", id: bannerId });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Send notification to all users
adminRouter.post("/notify-all", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!title || !body) {
    res.status(422).json({ message: "Title and body are required." });
    return;
  }
  try {
    // Store notification in DB (create table if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_by INTEGER
      )
    `);
    await pool.query(
      `INSERT INTO notifications (title, body, sent_by) VALUES ($1, $2, $3)`,
      [title, body, (req as any).authUser?.id ?? null],
    );
    // In future: integrate with push notification service (FCM/Expo)
    res.json({ message: "Notification logged. Push service se connect karo for live delivery.", title, body });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Update profile photo
adminRouter.patch("/profile/photo", async (req, res) => {
  const photoUrl = typeof req.body?.photoUrl === "string" ? req.body.photoUrl.trim() : "";
  if (!photoUrl) {
    res.status(422).json({ message: "Photo URL required." });
    return;
  }
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT ''
    `);
    await pool.query(`UPDATE users SET photo_url = $1 WHERE id = $2`, [photoUrl, (req as any).authUser?.id]);
    res.json({ message: "Profile photo updated.", photoUrl });
  } catch (error) {
    sendServerError(res, error);
  }
});

// ─── ADMIN: SCHEDULED TESTS MANAGEMENT ───

adminRouter.get("/scheduled-tests", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.published,
              t.exam_id AS "examId", e.name AS "examName", c.name AS "categoryName",
              t.description, t.instructions, t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.total_marks AS "totalMarks",
              t.status, t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              (t.access_password_hash IS NOT NULL) AS "hasPassword",
              (SELECT COUNT(*)::int FROM test_attempts a WHERE a.test_id = t.id) AS "participantCount",
              (SELECT COUNT(*)::int FROM test_attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS "completedCount",
              (SELECT ROUND(AVG(a.score)::numeric, 1) FROM test_attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS "avgScore",
              (SELECT MAX(a.score) FROM test_attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS "topScore"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN exam_categories c ON c.id = e.category_id
       WHERE t.test_type = 'scheduled'
       ORDER BY t.scheduled_start_at DESC NULLS LAST, t.created_at DESC`,
    );

    const tests = result.rows.map((row) => ({
      ...row,
      liveStatus: computeScheduledStatus(row),
    }));

    res.json({ tests });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/scheduled-tests", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : "";
  const examId = Number(req.body?.examId);
  const scheduledStartAt = req.body?.scheduledStartAt ? new Date(req.body.scheduledStartAt) : null;
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? Math.max(1, req.body.durationMinutes) : 60;
  const marksPerQuestion = Number(req.body?.marksPerQuestion) > 0 ? Number(req.body.marksPerQuestion) : 1.0;
  const negativeMarking = Number(req.body?.negativeMarking) >= 0 ? Number(req.body.negativeMarking) : 0.0;
  const totalMarks = Number(req.body?.totalMarks) > 0 ? Number(req.body.totalMarks) : 100.0;
  const shouldPublish = req.body?.publish === true;

  if (!title) {
    res.status(422).json({ message: "Test title is required." });
    return;
  }
  if (!Number.isInteger(examId) || examId < 1) {
    res.status(422).json({ message: "Exam category selection is required." });
    return;
  }
  if (!scheduledStartAt || isNaN(scheduledStartAt.getTime())) {
    res.status(422).json({ message: "Valid scheduled start date and time is required." });
    return;
  }

  // Safe timing rule: reject publishing if start time has already passed
  if (shouldPublish && scheduledStartAt.getTime() < Date.now() - 60_000) {
    res.status(422).json({ message: "Cannot publish a test with a scheduled start time in the past." });
    return;
  }

  const scheduledEndAt = new Date(scheduledStartAt.getTime() + durationMinutes * 60_000);

  // Generate secure random access password
  const accessPassword = generateAccessPassword(8);
  const passwordHash = await hashPassword(accessPassword);
  const status = shouldPublish ? "scheduled" : "draft";

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO tests (
        title, description, instructions, exam_id, subject, topic,
        duration_minutes, marks_per_question, negative_marking, total_marks,
        scheduled_start_at, scheduled_end_at, status, published,
        access_password_hash, test_type
      ) VALUES ($1, $2, $3, $4, 'Scheduled Exam', 'Live Test', $5, $6, $7, $8, $9, $10, $11, $12, $13, 'scheduled')
      RETURNING id`,
      [
        title, description, instructions, examId,
        durationMinutes, marksPerQuestion, negativeMarking, totalMarks,
        scheduledStartAt, scheduledEndAt, status, shouldPublish,
        passwordHash,
      ],
    );
    const testId = result.rows[0]!.id;

    res.status(201).json({
      testId,
      title,
      scheduledStartAt,
      scheduledEndAt,
      durationMinutes,
      status,
      published: shouldPublish,
      accessPassword, // Plaintext password returned ONLY to admin for copying
      message: "Scheduled test created successfully.",
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.put("/scheduled-tests/:id", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : undefined;
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : undefined;
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : undefined;
  const examId = req.body?.examId !== undefined ? Number(req.body.examId) : undefined;
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? Math.max(1, req.body.durationMinutes) : undefined;
  const scheduledStartAt = req.body?.scheduledStartAt ? new Date(req.body.scheduledStartAt) : undefined;
  const marksPerQuestion = req.body?.marksPerQuestion !== undefined ? Number(req.body.marksPerQuestion) : undefined;
  const negativeMarking = req.body?.negativeMarking !== undefined ? Number(req.body.negativeMarking) : undefined;
  const totalMarks = req.body?.totalMarks !== undefined ? Number(req.body.totalMarks) : undefined;

  try {
    const existing = await pool.query(
      `SELECT scheduled_start_at AS "scheduledStartAt", duration_minutes AS "durationMinutes"
       FROM tests WHERE id = $1 AND test_type = 'scheduled'`,
      [testId],
    );
    if (!existing.rows[0]) {
      res.status(404).json({ message: "Scheduled test not found." });
      return;
    }

    const currentStart = scheduledStartAt || new Date(existing.rows[0].scheduledStartAt);
    const currentDuration = durationMinutes || existing.rows[0].durationMinutes;
    const scheduledEndAt = new Date(currentStart.getTime() + currentDuration * 60_000);

    const result = await pool.query(
      `UPDATE tests SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        instructions = COALESCE($3, instructions),
        exam_id = COALESCE($4, exam_id),
        duration_minutes = COALESCE($5, duration_minutes),
        scheduled_start_at = COALESCE($6, scheduled_start_at),
        scheduled_end_at = $7,
        marks_per_question = COALESCE($8, marks_per_question),
        negative_marking = COALESCE($9, negative_marking),
        total_marks = COALESCE($10, total_marks),
        updated_at = NOW()
       WHERE id = $11 AND test_type = 'scheduled'
       RETURNING id`,
      [
        title, description, instructions, examId, durationMinutes,
        scheduledStartAt, scheduledEndAt, marksPerQuestion, negativeMarking,
        totalMarks, testId,
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Scheduled test not found." });
      return;
    }
    res.json({ message: "Scheduled test updated successfully.", id: testId });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/scheduled-tests/:id/publish", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  try {
    const existing = await pool.query(
      `SELECT scheduled_start_at AS "scheduledStartAt", access_password_hash AS "accessPasswordHash"
       FROM tests WHERE id = $1 AND test_type = 'scheduled'`,
      [testId],
    );
    if (!existing.rows[0]) {
      res.status(404).json({ message: "Scheduled test not found." });
      return;
    }
    const start = existing.rows[0].scheduledStartAt ? new Date(existing.rows[0].scheduledStartAt) : null;
    if (start && start.getTime() < Date.now() - 60_000) {
      res.status(422).json({ message: "Cannot publish test: scheduled start time is in the past. Please update start time first." });
      return;
    }

    let generatedPassword: string | undefined;
    let passwordHash = existing.rows[0].accessPasswordHash;
    if (!passwordHash) {
      generatedPassword = generateAccessPassword(8);
      passwordHash = await hashPassword(generatedPassword);
    }

    await pool.query(
      `UPDATE tests
       SET published = true, status = 'scheduled', access_password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, testId],
    );

    res.json({
      published: true,
      status: "scheduled",
      accessPassword: generatedPassword,
      message: "Test published and scheduled successfully.",
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/scheduled-tests/:id/cancel", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE tests
       SET status = 'cancelled', published = false, updated_at = NOW()
       WHERE id = $1 AND test_type = 'scheduled'
       RETURNING id, title`,
      [testId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Scheduled test not found." });
      return;
    }
    res.json({ cancelled: true, message: "Scheduled test has been cancelled." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/scheduled-tests/:id/regenerate-password", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  try {
    const newPassword = generateAccessPassword(8);
    const newHash = await hashPassword(newPassword);

    const result = await pool.query(
      `UPDATE tests
       SET access_password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND test_type = 'scheduled'
       RETURNING id, title`,
      [newHash, testId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Scheduled test not found." });
      return;
    }

    res.json({
      testId,
      accessPassword: newPassword, // Returned ONLY here for admin copy
      message: "Password regenerated successfully. Be sure to share the new password with students.",
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.get("/scheduled-tests/:id/stats", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  try {
    const testResult = await pool.query(
      `SELECT t.id, t.title, t.duration_minutes AS "durationMinutes",
              t.scheduled_start_at AS "scheduledStartAt", t.scheduled_end_at AS "scheduledEndAt",
              t.total_marks AS "totalMarks", t.marks_per_question AS "marksPerQuestion",
              t.negative_marking AS "negativeMarking", t.status, t.published,
              e.name AS "examName"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       WHERE t.id = $1`,
      [testId],
    );
    const test = testResult.rows[0];
    if (!test) {
      res.status(404).json({ message: "Test not found." });
      return;
    }

    const participantsResult = await pool.query(
      `SELECT a.id AS "attemptId", a.user_id AS "userId", u.name AS "studentName", u.email, u.mobile,
              a.started_at AS "startedAt", a.submitted_at AS "submittedAt",
              a.score, a.total_questions AS "totalQuestions", a.correct_answers AS correct,
              a.wrong_answers AS wrong, a.unattempted, a.percentage, a.accuracy,
              a.time_taken_seconds AS "timeTakenSeconds", a.status
       FROM test_attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.test_id = $1
       ORDER BY a.score DESC NULLS LAST, a.submitted_at ASC NULLS LAST`,
      [testId],
    );

    const attempts = participantsResult.rows;
    const completed = attempts.filter((a) => a.submittedAt);
    const inProgress = attempts.filter((a) => !a.submittedAt);

    const scores = completed.map((a) => Number(a.score) || 0);
    const avgScore = scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const topScore = scores.length ? Math.max(...scores) : 0;
    const lowestScore = scores.length ? Math.min(...scores) : 0;

    res.json({
      test: {
        ...test,
        liveStatus: computeScheduledStatus(test),
      },
      stats: {
        totalStarted: attempts.length,
        totalCompleted: completed.length,
        inProgressCount: inProgress.length,
        avgScore,
        topScore,
        lowestScore,
      },
      participants: attempts,
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

// ─── ADMIN: PYQ PAPERS & QUESTIONS MANAGEMENT ───

adminRouter.get("/pyq", async (req, res) => {
  const examId = req.query.examId ? Number(req.query.examId) : null;
  const year = req.query.year ? Number(req.query.year) : null;
  const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;

  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.year, t.shift, t.language, t.source_info AS "sourceInfo",
              t.is_verified_pyq AS "isVerifiedPyq", t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.total_marks AS "totalMarks",
              t.marks_per_question AS "marksPerQuestion", t.negative_marking AS "negativeMarking",
              t.published, t.created_at AS "createdAt",
              e.id AS "examId", e.name AS "examName", c.name AS "categoryName"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN exam_categories c ON c.id = e.category_id
       WHERE t.test_type = 'pyq'
         AND ($1::int IS NULL OR t.exam_id = $1)
         AND ($2::int IS NULL OR t.year = $2)
         AND ($3::text IS NULL OR t.title ILIKE $3 OR t.source_info ILIKE $3)
       ORDER BY t.year DESC NULLS LAST, t.created_at DESC`,
      [examId, year, search],
    );
    res.json({ papers: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/pyq", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const examId = Number(req.body?.examId);
  const year = Number.isInteger(req.body?.year) ? req.body.year : new Date().getFullYear();
  const shift = typeof req.body?.shift === "string" ? req.body.shift.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "Hindi";
  const sourceInfo = typeof req.body?.sourceInfo === "string" ? req.body.sourceInfo.trim() : "";
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : "";
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? req.body.durationMinutes : 60;
  const marksPerQuestion = Number(req.body?.marksPerQuestion) > 0 ? Number(req.body.marksPerQuestion) : 2.0;
  const negativeMarking = Number(req.body?.negativeMarking) >= 0 ? Number(req.body.negativeMarking) : 0.5;
  const totalMarks = Number(req.body?.totalMarks) > 0 ? Number(req.body.totalMarks) : 100;
  const isVerifiedPyq = req.body?.isVerifiedPyq === true;
  const published = req.body?.published === true;

  if (!title || !Number.isInteger(examId) || examId < 1) {
    res.status(422).json({ message: "Title and Exam selection are required." });
    return;
  }

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO tests (
        title, exam_id, test_type, year, shift, language, source_info,
        instructions, duration_minutes, marks_per_question, negative_marking,
        total_marks, is_verified_pyq, published, status, subject, topic
      ) VALUES ($1, $2, 'pyq', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PYQ Paper', 'Previous Year Questions')
      RETURNING id`,
      [
        title, examId, year, shift, language, sourceInfo,
        instructions, durationMinutes, marksPerQuestion, negativeMarking,
        totalMarks, isVerifiedPyq, published, published ? "published" : "draft",
      ],
    );

    res.status(201).json({
      paperId: result.rows[0]!.id,
      title,
      message: "PYQ Paper created successfully.",
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.put("/pyq/:id", async (req, res) => {
  const paperId = Number(req.params.id);
  if (!Number.isInteger(paperId) || paperId < 1) {
    res.status(400).json({ message: "Invalid paper ID." });
    return;
  }
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : undefined;
  const examId = req.body?.examId !== undefined ? Number(req.body.examId) : undefined;
  const year = req.body?.year !== undefined ? Number(req.body.year) : undefined;
  const shift = typeof req.body?.shift === "string" ? req.body.shift.trim() : undefined;
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : undefined;
  const sourceInfo = typeof req.body?.sourceInfo === "string" ? req.body.sourceInfo.trim() : undefined;
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : undefined;
  const durationMinutes = req.body?.durationMinutes !== undefined ? Number(req.body.durationMinutes) : undefined;
  const marksPerQuestion = req.body?.marksPerQuestion !== undefined ? Number(req.body.marksPerQuestion) : undefined;
  const negativeMarking = req.body?.negativeMarking !== undefined ? Number(req.body.negativeMarking) : undefined;
  const totalMarks = req.body?.totalMarks !== undefined ? Number(req.body.totalMarks) : undefined;
  const isVerifiedPyq = req.body?.isVerifiedPyq !== undefined ? Boolean(req.body.isVerifiedPyq) : undefined;

  try {
    const result = await pool.query(
      `UPDATE tests SET
        title = COALESCE($1, title),
        exam_id = COALESCE($2, exam_id),
        year = COALESCE($3, year),
        shift = COALESCE($4, shift),
        language = COALESCE($5, language),
        source_info = COALESCE($6, source_info),
        instructions = COALESCE($7, instructions),
        duration_minutes = COALESCE($8, duration_minutes),
        marks_per_question = COALESCE($9, marks_per_question),
        negative_marking = COALESCE($10, negative_marking),
        total_marks = COALESCE($11, total_marks),
        is_verified_pyq = COALESCE($12, is_verified_pyq),
        updated_at = NOW()
       WHERE id = $13 AND test_type = 'pyq'
       RETURNING id`,
      [
        title, examId, year, shift, language, sourceInfo,
        instructions, durationMinutes, marksPerQuestion, negativeMarking,
        totalMarks, isVerifiedPyq, paperId,
      ],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "PYQ Paper not found." });
      return;
    }
    res.json({ message: "PYQ Paper updated successfully." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.delete("/pyq/:id", async (req, res) => {
  const paperId = Number(req.params.id);
  if (!Number.isInteger(paperId) || paperId < 1) {
    res.status(400).json({ message: "Invalid paper ID." });
    return;
  }
  try {
    const result = await pool.query(`DELETE FROM tests WHERE id = $1 AND test_type = 'pyq' RETURNING id`, [paperId]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: "PYQ Paper not found." });
      return;
    }
    res.json({ message: "PYQ Paper deleted successfully." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/pyq/:id/publish", async (req, res) => {
  const paperId = Number(req.params.id);
  if (!Number.isInteger(paperId) || paperId < 1) {
    res.status(400).json({ message: "Invalid paper ID." });
    return;
  }
  try {
    await pool.query(
      `UPDATE tests SET published = true, status = 'published', updated_at = NOW()
       WHERE id = $1 AND test_type = 'pyq'`,
      [paperId],
    );
    res.json({ published: true, message: "PYQ Paper published." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/pyq/:id/unpublish", async (req, res) => {
  const paperId = Number(req.params.id);
  if (!Number.isInteger(paperId) || paperId < 1) {
    res.status(400).json({ message: "Invalid paper ID." });
    return;
  }
  try {
    await pool.query(
      `UPDATE tests SET published = false, status = 'draft', updated_at = NOW()
       WHERE id = $1 AND test_type = 'pyq'`,
      [paperId],
    );
    res.json({ published: false, message: "PYQ Paper unpublished." });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Get questions for a test / PYQ paper
adminRouter.get("/tests/:id/questions", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, prompt, options, correct_index AS "correctIndex",
              explanation, marks, negative_marks AS "negativeMarks",
              topic, difficulty, sort_order AS "sortOrder"
       FROM test_questions
       WHERE test_id = $1
       ORDER BY sort_order, id`,
      [testId],
    );
    res.json({ questions: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Admin: Add a question to a test / PYQ paper
adminRouter.post("/tests/:id/questions", async (req, res) => {
  const testId = Number(req.params.id);
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const options = Array.isArray(req.body?.options) ? req.body.options : [];
  const correctIndex = Number(req.body?.correctIndex);
  const explanation = typeof req.body?.explanation === "string" ? req.body.explanation.trim() : "";
  const marks = Number(req.body?.marks) > 0 ? Number(req.body.marks) : 1.0;
  const negativeMarks = Number(req.body?.negativeMarks) >= 0 ? Number(req.body.negativeMarks) : 0.0;
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const difficulty = typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : "Medium";

  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  if (!prompt || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    res.status(422).json({ message: "Question requires non-empty prompt, exactly 4 options, and a valid correct option index (0-3)." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM test_questions WHERE test_id = $1`,
      [testId],
    );
    const sortOrder = parseInt(countResult.rows[0]?.count || "0", 10);

    const questionInsert = await client.query<{ id: number }>(
      `INSERT INTO test_questions (test_id, prompt, options, correct_index, explanation, marks, negative_marks, topic, difficulty, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [testId, prompt, JSON.stringify(options), correctIndex, explanation, marks, negativeMarks, topic, difficulty, sortOrder],
    );

    await client.query(
      `UPDATE tests SET question_count = (SELECT COUNT(*)::int FROM test_questions WHERE test_id = $1), updated_at = NOW() WHERE id = $1`,
      [testId],
    );

    await client.query("COMMIT");
    res.status(201).json({ questionId: questionInsert.rows[0]!.id, message: "Question added successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

// Admin: Delete a question
adminRouter.delete("/questions/:id", async (req, res) => {
  const questionId = Number(req.params.id);
  if (!Number.isInteger(questionId) || questionId < 1) {
    res.status(400).json({ message: "Invalid question ID." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const qResult = await client.query<{ test_id: number }>(
      `DELETE FROM test_questions WHERE id = $1 RETURNING test_id`,
      [questionId],
    );
    if (qResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Question not found." });
      return;
    }
    const testId = qResult.rows[0]!.test_id;
    await client.query(
      `UPDATE tests SET question_count = (SELECT COUNT(*)::int FROM test_questions WHERE test_id = $1), updated_at = NOW() WHERE id = $1`,
      [testId],
    );
    await client.query("COMMIT");
    res.json({ message: "Question deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

// Admin: Bulk import questions
adminRouter.post("/tests/:id/questions/bulk", async (req, res) => {
  const testId = Number(req.params.id);
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];

  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test ID." });
    return;
  }
  if (questions.length === 0) {
    res.status(422).json({ message: "An array of questions is required." });
    return;
  }

  // Validate all questions first
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt || typeof q.prompt !== "string" || !q.prompt.trim()) {
      res.status(422).json({ message: `Question #${i + 1} has an empty prompt.` });
      return;
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      res.status(422).json({ message: `Question #${i + 1} must have exactly 4 options.` });
      return;
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      res.status(422).json({ message: `Question #${i + 1} must have a correctIndex between 0 and 3.` });
      return;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM test_questions WHERE test_id = $1`,
      [testId],
    );
    let startOrder = parseInt(countResult.rows[0]?.count || "0", 10);

    for (const q of questions) {
      await client.query(
        `INSERT INTO test_questions (test_id, prompt, options, correct_index, explanation, marks, negative_marks, topic, difficulty, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          testId,
          q.prompt.trim(),
          JSON.stringify(q.options),
          q.correctIndex,
          q.explanation ? String(q.explanation).trim() : "",
          Number(q.marks) > 0 ? Number(q.marks) : 1.0,
          Number(q.negativeMarks) >= 0 ? Number(q.negativeMarks) : 0.0,
          q.topic ? String(q.topic).trim() : "",
          q.difficulty ? String(q.difficulty).trim() : "Medium",
          startOrder++,
        ],
      );
    }

    await client.query(
      `UPDATE tests SET question_count = (SELECT COUNT(*)::int FROM test_questions WHERE test_id = $1), updated_at = NOW() WHERE id = $1`,
      [testId],
    );

    await client.query("COMMIT");
    res.status(201).json({
      importedCount: questions.length,
      message: `Successfully imported ${questions.length} questions.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

// ─── ADMIN: CATEGORIES & EXAMS MANAGEMENT ───

adminRouter.get("/categories", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.sort_order AS "sortOrder",
              (SELECT json_agg(json_build_object('id', e.id, 'name', e.name, 'slug', e.slug) ORDER BY e.sort_order, e.id)
               FROM exams e WHERE e.category_id = c.id) AS exams
       FROM exam_categories c ORDER BY c.sort_order, c.id`,
    );
    res.json({ categories: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/categories", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(422).json({ message: "Category name is required." });
    return;
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO exam_categories (name, slug) VALUES ($1, $2) RETURNING id`,
      [name, slug],
    );
    res.status(201).json({ id: result.rows[0]!.id, name, slug, message: "Category created." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.delete("/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid ID." }); return; }
  try {
    const result = await pool.query(`DELETE FROM exam_categories WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) { res.status(404).json({ message: "Category not found." }); return; }
    res.json({ message: "Category deleted." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/exams", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const categoryId = Number(req.body?.categoryId);
  if (!name) { res.status(422).json({ message: "Exam name is required." }); return; }
  if (!Number.isInteger(categoryId) || categoryId < 1) { res.status(422).json({ message: "Category selection required." }); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO exams (name, slug, category_id) VALUES ($1, $2, $3) RETURNING id`,
      [name, slug, categoryId],
    );
    res.status(201).json({ id: result.rows[0]!.id, name, slug, message: "Exam created." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.delete("/exams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid ID." }); return; }
  try {
    const result = await pool.query(`DELETE FROM exams WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) { res.status(404).json({ message: "Exam not found." }); return; }
    res.json({ message: "Exam deleted." });
  } catch (error) {
    sendServerError(res, error);
  }
});

// ─── ADMIN: ALL TESTS MANAGEMENT (Free / Password / Paid) ───

adminRouter.get("/tests", async (_req, res) => {
  try {
    const accessFilter = typeof (_req as any).query?.accessType === "string" ? (_req as any).query.accessType : null;
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty, t.published,
              t.exam_id AS "examId", e.name AS "examName", c.name AS "categoryName",
              t.test_type AS "testType", t.status,
              t.access_type AS "accessType", t.is_precision AS "isPrecision",
              t.price, t.bundle_name AS "bundleName",
              (t.access_password_hash IS NOT NULL) AS "hasPassword",
              t.marks_per_question AS "marksPerQuestion", t.negative_marking AS "negativeMarking",
              t.total_marks AS "totalMarks",
              (SELECT COUNT(*)::int FROM test_questions tq WHERE tq.test_id = t.id) AS "questionCount",
              (SELECT COUNT(*)::int FROM test_attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS "completedCount"
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN exam_categories c ON c.id = e.category_id
       WHERE ($1::text IS NULL OR t.access_type = $1)
       ORDER BY t.created_at DESC`,
      [accessFilter],
    );
    res.json({ tests: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/tests", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "General";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "General";
  const examId = Number(req.body?.examId);
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? Math.max(1, req.body.durationMinutes) : 30;
  const marksPerQuestion = Number(req.body?.marksPerQuestion) > 0 ? Number(req.body.marksPerQuestion) : 1.0;
  const negativeMarking = Number(req.body?.negativeMarking) >= 0 ? Number(req.body.negativeMarking) : 0.0;
  const totalMarks = Number(req.body?.totalMarks) > 0 ? Number(req.body.totalMarks) : 100.0;
  const accessType = ["free", "password", "paid"].includes(req.body?.accessType) ? req.body.accessType : "free";
  const isPrecision = req.body?.isPrecision === true;
  const price = accessType === "paid" && Number(req.body?.price) > 0 ? Number(req.body.price) : 0.0;
  const bundleName = typeof req.body?.bundleName === "string" ? req.body.bundleName.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : "";
  const shouldPublish = req.body?.publish === true;
  const difficulty = typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : "Medium";

  if (!title) { res.status(422).json({ message: "Test title is required." }); return; }
  if (!Number.isInteger(examId) || examId < 1) { res.status(422).json({ message: "Exam selection is required." }); return; }

  let passwordHash: string | null = null;
  let accessPassword: string | undefined;
  if (accessType === "password") {
    const pwd = typeof req.body?.accessPassword === "string" && req.body.accessPassword.trim()
      ? req.body.accessPassword.trim()
      : generateAccessPassword(8);
    accessPassword = pwd;
    passwordHash = await hashPassword(pwd);
  }

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO tests (
        title, description, instructions, subject, topic, exam_id,
        duration_minutes, marks_per_question, negative_marking, total_marks,
        difficulty, access_type, is_precision, price, bundle_name,
        access_password_hash, published, status, test_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'practice')
      RETURNING id`,
      [
        title, description, instructions, subject, topic, examId,
        durationMinutes, marksPerQuestion, negativeMarking, totalMarks,
        difficulty, accessType, isPrecision, price, bundleName,
        passwordHash, shouldPublish, shouldPublish ? "active" : "draft",
      ],
    );
    const testId = result.rows[0]!.id;
    res.status(201).json({
      testId, title, accessType, accessPassword,
      message: `Test created successfully (${accessType}).`,
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.put("/tests/:id", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) { res.status(400).json({ message: "Invalid test ID." }); return; }
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : undefined;
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : undefined;
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : undefined;
  const examId = req.body?.examId !== undefined ? Number(req.body.examId) : undefined;
  const durationMinutes = Number.isInteger(req.body?.durationMinutes) ? Math.max(1, req.body.durationMinutes) : undefined;
  const difficulty = typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : undefined;
  const marksPerQuestion = req.body?.marksPerQuestion !== undefined ? Number(req.body.marksPerQuestion) : undefined;
  const negativeMarking = req.body?.negativeMarking !== undefined ? Number(req.body.negativeMarking) : undefined;
  const totalMarks = req.body?.totalMarks !== undefined ? Number(req.body.totalMarks) : undefined;
  const accessType = req.body?.accessType && ["free","password","paid"].includes(req.body.accessType) ? req.body.accessType : undefined;
  const price = req.body?.price !== undefined ? Number(req.body.price) : undefined;
  const bundleName = typeof req.body?.bundleName === "string" ? req.body.bundleName.trim() : undefined;
  const isPrecision = typeof req.body?.isPrecision === "boolean" ? req.body.isPrecision : undefined;

  try {
    const result = await pool.query(
      `UPDATE tests SET
        title = COALESCE($1, title), subject = COALESCE($2, subject), topic = COALESCE($3, topic),
        exam_id = COALESCE($4, exam_id), duration_minutes = COALESCE($5, duration_minutes),
        difficulty = COALESCE($6, difficulty), marks_per_question = COALESCE($7, marks_per_question),
        negative_marking = COALESCE($8, negative_marking), total_marks = COALESCE($9, total_marks),
        access_type = COALESCE($10, access_type), price = COALESCE($11, price),
        bundle_name = COALESCE($12, bundle_name), is_precision = COALESCE($13, is_precision),
        updated_at = NOW()
       WHERE id = $14 RETURNING id`,
      [title, subject, topic, examId, durationMinutes, difficulty, marksPerQuestion, negativeMarking, totalMarks, accessType, price, bundleName, isPrecision, testId],
    );
    if (result.rowCount === 0) { res.status(404).json({ message: "Test not found." }); return; }
    res.json({ message: "Test updated.", id: testId });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/tests/:id/publish", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) { res.status(400).json({ message: "Invalid test ID." }); return; }
  try {
    await pool.query(`UPDATE tests SET published = true, status = 'active', updated_at = NOW() WHERE id = $1`, [testId]);
    res.json({ published: true, message: "Test published." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/tests/:id/unpublish", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) { res.status(400).json({ message: "Invalid test ID." }); return; }
  try {
    await pool.query(`UPDATE tests SET published = false, status = 'draft', updated_at = NOW() WHERE id = $1`, [testId]);
    res.json({ published: false, message: "Test unpublished." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.delete("/tests/:id", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) { res.status(400).json({ message: "Invalid test ID." }); return; }
  try {
    const result = await pool.query(`DELETE FROM tests WHERE id = $1 RETURNING id`, [testId]);
    if (result.rowCount === 0) { res.status(404).json({ message: "Test not found." }); return; }
    res.json({ message: "Test deleted." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/tests/:id/set-password", async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) { res.status(400).json({ message: "Invalid test ID." }); return; }
  const customPassword = typeof req.body?.password === "string" && req.body.password.trim() ? req.body.password.trim() : null;
  const accessPassword = customPassword || generateAccessPassword(8);
  const passwordHash = await hashPassword(accessPassword);
  try {
    await pool.query(
      `UPDATE tests SET access_password_hash = $1, access_type = 'password', updated_at = NOW() WHERE id = $2`,
      [passwordHash, testId],
    );
    res.json({ testId, accessPassword, message: "Password set." });
  } catch (error) {
    sendServerError(res, error);
  }
});

adminRouter.post("/tests/:id/grant-access", async (req, res) => {
  const testId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  if (!Number.isInteger(testId) || testId < 1 || !Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ message: "Valid test ID and user ID required." });
    return;
  }
  try {
    const test = await pool.query(`SELECT price FROM tests WHERE id = $1`, [testId]);
    const amount = test.rows[0]?.price || 0;
    await pool.query(
      `INSERT INTO user_purchases (user_id, item_type, item_id, amount)
       VALUES ($1, 'test', $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, testId, amount],
    );
    res.json({ message: "Access granted." });
  } catch (error) {
    sendServerError(res, error);
  }
});

// Temporary endpoint to promote user to admin (remove in production)
router.post("/promote-to-admin", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(422).json({ message: "Email is required." });
    return;
  }
  try {
    const result = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, name, email, role",
      [email]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    res.json({ message: "User promoted to admin", user: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.use("/admin", adminRouter);

export default router;