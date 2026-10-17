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
    const result = await pool.query<AuthUser & { password_hash: string }>(
      `SELECT id, name, email, mobile, role, password_hash
       FROM users WHERE lower(email) = lower($1) OR mobile = $1 LIMIT 1`,
      [identifier],
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

router.get("/tests", requireAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;
    const result = await pool.query(
      `SELECT t.id, t.title, t.subject, t.topic, t.question_count AS "questionCount",
              t.duration_minutes AS "durationMinutes", t.difficulty,
              EXISTS (SELECT 1 FROM test_attempts a WHERE a.test_id = t.id AND a.user_id = $1
                AND a.submitted_at IS NOT NULL) AS attempted
       FROM tests t WHERE t.published = true
         AND ($2::text IS NULL OR t.title ILIKE $2 OR t.topic ILIKE $2 OR t.subject ILIKE $2)
       ORDER BY t.created_at DESC`,
      [req.authUser!.id, search],
    );
    res.json({ tests: result.rows });
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
      `SELECT id, title, subject, topic, question_count AS "questionCount",
              duration_minutes AS "durationMinutes", difficulty
       FROM tests WHERE id = $1 AND published = true`,
      [testId],
    );
    const test = testResult.rows[0];
    if (!test) {
      res.status(404).json({ message: "Test not found." });
      return;
    }
    const questionResult = await pool.query(
      `SELECT id, prompt, options, topic, difficulty
       FROM test_questions WHERE test_id = $1 ORDER BY sort_order, id`,
      [testId],
    );
    res.json({ test, questions: questionResult.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post("/tests/:id/start", requireAuth, async (req, res) => {
  const testId = Number(req.params.id);
  if (!Number.isInteger(testId) || testId < 1) {
    res.status(400).json({ message: "Invalid test." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const testResult = await client.query(
      `SELECT id, title, subject, topic, duration_minutes AS "durationMinutes"
       FROM tests WHERE id = $1 AND published = true FOR SHARE`,
      [testId],
    );
    const test = testResult.rows[0];
    if (!test) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Test not found." });
      return;
    }
    const existing = await client.query(
      `SELECT id, started_at AS "startedAt" FROM test_attempts
       WHERE user_id = $1 AND test_id = $2 AND submitted_at IS NULL
       ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [req.authUser!.id, testId],
    );
    let attempt = existing.rows[0];
    if (attempt) {
      const deadline = new Date(attempt.startedAt).getTime() + Number(test.durationMinutes) * 60_000;
      if (deadline <= Date.now()) {
        await client.query(
          "UPDATE test_attempts SET submitted_at = NOW() WHERE id = $1",
          [attempt.id],
        );
        attempt = undefined;
      }
    }
    if (!attempt) {
      const created = await client.query(
        `INSERT INTO test_attempts (user_id, test_id, total_questions)
         SELECT $1, $2, COUNT(*)::int FROM test_questions WHERE test_id = $2
         RETURNING id, started_at AS "startedAt"`,
        [req.authUser!.id, testId],
      );
      attempt = created.rows[0];
    }
    const questionResult = await client.query(
      `SELECT id, prompt, options FROM test_questions WHERE test_id = $1 ORDER BY sort_order, id`,
      [testId],
    );
    await client.query("COMMIT");
    res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      deadline: new Date(new Date(attempt.startedAt).getTime() + Number(test.durationMinutes) * 60_000),
      test,
      questions: questionResult.rows,
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
              a.submitted_at AS "submittedAt", t.duration_minutes AS "durationMinutes"
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
      `SELECT id, correct_index AS "correctIndex" FROM test_questions
       WHERE test_id = $1 ORDER BY sort_order, id`,
      [attempt.testId],
    );
    const deadline = new Date(attempt.startedAt).getTime() + Number(attempt.durationMinutes) * 60_000;
    const isLateSubmission = Date.now() > deadline + 2_000;
    let correct = 0;
    let wrong = 0;
    let attempted = 0;
    for (const question of questionResult.rows as Array<{ id: number; correctIndex: number }>) {
      const value = isLateSubmission ? undefined : rawAnswers[String(question.id)];
      const selected = Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
      const isCorrect = selected === question.correctIndex;
      if (selected !== null) {
        attempted += 1;
        if (isCorrect) correct += 1;
        else wrong += 1;
      }
      await client.query(
        `INSERT INTO test_answers (attempt_id, question_id, selected_option, is_correct)
         VALUES ($1, $2, $3, $4)`,
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
    const score = correct;
    const percentage = total ? Math.round((correct / total) * 100) : 0;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    await client.query(
      `UPDATE test_attempts SET submitted_at = NOW(), score = $1, correct_answers = $2,
       wrong_answers = $3, unattempted = $4, percentage = $5, accuracy = $6,
       time_taken_seconds = $7 WHERE id = $8`,
      [score, correct, wrong, unattempted, percentage, accuracy, timeTaken, attemptId],
    );
    await client.query("COMMIT");
    res.json({ attemptId, score, totalQuestions: total, correct, wrong, unattempted, percentage, accuracy, timeTakenSeconds: timeTaken });
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
              a.score, a.total_questions AS "totalQuestions", a.correct_answers AS correct,
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

    const gptResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      res.status(502).json({ message: `Gemini API error: ${gptResponse.status}. ${errText.slice(0, 200)}` });
      return;
    }

    const gptData = await gptResponse.json() as any;
    const rawContent = gptData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: { title: string; questions: Array<{ prompt: string; options: string[]; correctIndex: number; explanation: string }> };
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ message: "GPT returned invalid JSON. Please try again." });
      return;
    }

    if (!parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      res.status(502).json({ message: "GPT response missing required fields. Please try again." });
      return;
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

// ── NOTES HIERARCHY — Student endpoints ──────────────────────────────────────

router.get("/notes/sections", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, slug, description, icon, display_order AS "displayOrder",
              (SELECT COUNT(*)::int FROM exams WHERE section_id = es.id AND is_active = true) AS "examCount"
       FROM exam_sections es WHERE is_active = true ORDER BY display_order, id`,
    );
    res.json({ sections: r.rows });
  } catch (e) { sendServerError(res, e); }
});

router.get("/notes/sections/:sectionId/exams", requireAuth, async (req, res) => {
  const sectionId = Number(req.params.sectionId);
  if (!Number.isInteger(sectionId) || sectionId < 1) { res.status(400).json({ message: "Invalid section." }); return; }
  try {
    const r = await pool.query(
      `SELECT e.id, e.name, e.slug, e.description, e.icon, e.display_order AS "displayOrder",
              (SELECT COUNT(*)::int FROM exam_subjects WHERE exam_id = e.id AND is_active = true) AS "subjectCount",
              (SELECT COUNT(*)::int FROM exam_notes WHERE exam_id = e.id AND is_published = true) AS "noteCount"
       FROM exams e WHERE e.section_id = $1 AND e.is_active = true ORDER BY e.display_order, e.id`,
      [sectionId],
    );
    res.json({ exams: r.rows });
  } catch (e) { sendServerError(res, e); }
});

router.get("/notes/exams/:examId/subjects", requireAuth, async (req, res) => {
  const examId = Number(req.params.examId);
  if (!Number.isInteger(examId) || examId < 1) { res.status(400).json({ message: "Invalid exam." }); return; }
  try {
    const r = await pool.query(
      `SELECT s.id, s.name, s.slug, s.description, s.display_order AS "displayOrder",
              (SELECT COUNT(*)::int FROM exam_notes WHERE subject_id = s.id AND is_published = true) AS "noteCount"
       FROM exam_subjects s WHERE s.exam_id = $1 AND s.is_active = true ORDER BY s.display_order, s.id`,
      [examId],
    );
    res.json({ subjects: r.rows });
  } catch (e) { sendServerError(res, e); }
});

router.get("/notes/exams/:examId/notes", requireAuth, async (req, res) => {
  const examId = Number(req.params.examId);
  if (!Number.isInteger(examId) || examId < 1) { res.status(400).json({ message: "Invalid exam." }); return; }
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  try {
    const r = await pool.query(
      `SELECT n.id, n.title, n.description, n.pdf_url AS "pdfUrl", n.thumbnail_url AS "thumbnailUrl",
              n.file_size AS "fileSize", n.tags, n.display_order AS "displayOrder",
              n.published_at AS "publishedAt", s.name AS "subjectName"
       FROM exam_notes n
       LEFT JOIN exam_subjects s ON s.id = n.subject_id
       WHERE n.exam_id = $1 AND n.is_published = true
         AND ($2::int IS NULL OR n.subject_id = $2)
       ORDER BY n.display_order, n.published_at DESC`,
      [examId, subjectId],
    );
    res.json({ notes: r.rows });
  } catch (e) { sendServerError(res, e); }
});

router.get("/notes/exam-note/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid note." }); return; }
  try {
    const r = await pool.query(
      `SELECT n.id, n.title, n.description, n.pdf_url AS "pdfUrl", n.thumbnail_url AS "thumbnailUrl",
              n.file_size AS "fileSize", n.tags, n.published_at AS "publishedAt",
              s.name AS "subjectName", e.name AS "examName", es.name AS "sectionName"
       FROM exam_notes n
       JOIN exams e ON e.id = n.exam_id
       JOIN exam_sections es ON es.id = e.section_id
       LEFT JOIN exam_subjects s ON s.id = n.subject_id
       WHERE n.id = $1 AND n.is_published = true`,
      [id],
    );
    if (!r.rows[0]) { res.status(404).json({ message: "Note not found." }); return; }
    res.json({ note: r.rows[0] });
  } catch (e) { sendServerError(res, e); }
});

// ── NOTES HIERARCHY — Admin endpoints ────────────────────────────────────────

// One-time migration endpoint
adminRouter.post("/migrate-notes", async (_req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_sections (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '📚', display_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX IF NOT EXISTS exam_sections_slug_unique ON exam_sections(slug);
      CREATE TABLE IF NOT EXISTS exams (id SERIAL PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES exam_sections(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '📝', display_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX IF NOT EXISTS exams_section_slug_unique ON exams(section_id, slug);
      CREATE TABLE IF NOT EXISTS exam_subjects (id SERIAL PRIMARY KEY, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', display_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX IF NOT EXISTS exam_subjects_exam_slug_unique ON exam_subjects(exam_id, slug);
      CREATE TABLE IF NOT EXISTS exam_notes (id SERIAL PRIMARY KEY, exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES exam_subjects(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', pdf_url TEXT NOT NULL DEFAULT '', thumbnail_url TEXT NOT NULL DEFAULT '', file_size INTEGER, mime_type TEXT NOT NULL DEFAULT 'application/pdf', tags TEXT NOT NULL DEFAULT '', display_order INTEGER NOT NULL DEFAULT 0, is_published BOOLEAN NOT NULL DEFAULT false, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE INDEX IF NOT EXISTS exam_notes_exam_published_idx ON exam_notes(exam_id, is_published);
      CREATE INDEX IF NOT EXISTS exam_notes_subject_idx ON exam_notes(subject_id);
    `);
    res.json({ message: "✅ Notes tables created successfully." });
  } catch (e) { sendServerError(res, e); }
});

// Sections CRUD
adminRouter.get("/notes/sections", async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, name, slug, description, icon, display_order AS "displayOrder", is_active AS "isActive", created_at AS "createdAt" FROM exam_sections ORDER BY display_order, id`);
    res.json({ sections: r.rows });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.post("/notes/sections", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const slug = String(req.body?.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-") || name.toLowerCase().replace(/\s+/g, "-");
  const description = String(req.body?.description ?? "").trim();
  const icon = String(req.body?.icon ?? "📚").trim();
  const displayOrder = Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0;
  if (!name) { res.status(422).json({ message: "Section name is required." }); return; }
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO exam_sections (name, slug, description, icon, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, slug, description, icon, displayOrder],
    );
    res.status(201).json({ id: r.rows[0]!.id, name });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ message: "A section with that slug already exists." }); return; }
    sendServerError(res, e);
  }
});

adminRouter.patch("/notes/sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid section." }); return; }
  const fields: string[] = []; const vals: unknown[] = [];
  if (req.body?.name) { fields.push(`name = $${vals.push(String(req.body.name).trim())}`); }
  if (req.body?.description !== undefined) { fields.push(`description = $${vals.push(String(req.body.description).trim())}`); }
  if (req.body?.icon) { fields.push(`icon = $${vals.push(String(req.body.icon).trim())}`); }
  if (req.body?.displayOrder !== undefined) { fields.push(`display_order = $${vals.push(Number(req.body.displayOrder))}`); }
  if (req.body?.isActive !== undefined) { fields.push(`is_active = $${vals.push(Boolean(req.body.isActive))}`); }
  if (!fields.length) { res.status(422).json({ message: "Nothing to update." }); return; }
  fields.push(`updated_at = NOW()`);
  try {
    const r = await pool.query(`UPDATE exam_sections SET ${fields.join(", ")} WHERE id = $${vals.push(id)} RETURNING id`, vals);
    if (!r.rowCount) { res.status(404).json({ message: "Section not found." }); return; }
    res.json({ updated: true });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.delete("/notes/sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid section." }); return; }
  try {
    const r = await pool.query(`DELETE FROM exam_sections WHERE id = $1 RETURNING id`, [id]);
    if (!r.rowCount) { res.status(404).json({ message: "Section not found." }); return; }
    res.json({ deleted: true });
  } catch (e) { sendServerError(res, e); }
});

// Exams CRUD
adminRouter.get("/notes/exams", async (req, res) => {
  const sectionId = req.query.sectionId ? Number(req.query.sectionId) : null;
  try {
    const r = await pool.query(
      `SELECT e.id, e.section_id AS "sectionId", es.name AS "sectionName", e.name, e.slug, e.description, e.icon, e.display_order AS "displayOrder", e.is_active AS "isActive"
       FROM exams e JOIN exam_sections es ON es.id = e.section_id
       WHERE ($1::int IS NULL OR e.section_id = $1) ORDER BY e.display_order, e.id`,
      [sectionId],
    );
    res.json({ exams: r.rows });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.post("/notes/exams", async (req, res) => {
  const sectionId = Number(req.body?.sectionId);
  const name = String(req.body?.name ?? "").trim();
  const slug = String(req.body?.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-") || name.toLowerCase().replace(/\s+/g, "-");
  const description = String(req.body?.description ?? "").trim();
  const icon = String(req.body?.icon ?? "📝").trim();
  const displayOrder = Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0;
  if (!sectionId || !name) { res.status(422).json({ message: "Section and exam name are required." }); return; }
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO exams (section_id, name, slug, description, icon, display_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [sectionId, name, slug, description, icon, displayOrder],
    );
    res.status(201).json({ id: r.rows[0]!.id, name });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ message: "An exam with that slug already exists in this section." }); return; }
    if (e.code === "23503") { res.status(404).json({ message: "Section not found." }); return; }
    sendServerError(res, e);
  }
});

adminRouter.patch("/notes/exams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid exam." }); return; }
  const fields: string[] = []; const vals: unknown[] = [];
  if (req.body?.name) { fields.push(`name = $${vals.push(String(req.body.name).trim())}`); }
  if (req.body?.description !== undefined) { fields.push(`description = $${vals.push(String(req.body.description).trim())}`); }
  if (req.body?.icon) { fields.push(`icon = $${vals.push(String(req.body.icon).trim())}`); }
  if (req.body?.displayOrder !== undefined) { fields.push(`display_order = $${vals.push(Number(req.body.displayOrder))}`); }
  if (req.body?.isActive !== undefined) { fields.push(`is_active = $${vals.push(Boolean(req.body.isActive))}`); }
  if (!fields.length) { res.status(422).json({ message: "Nothing to update." }); return; }
  fields.push(`updated_at = NOW()`);
  try {
    const r = await pool.query(`UPDATE exams SET ${fields.join(", ")} WHERE id = $${vals.push(id)} RETURNING id`, vals);
    if (!r.rowCount) { res.status(404).json({ message: "Exam not found." }); return; }
    res.json({ updated: true });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.delete("/notes/exams/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid exam." }); return; }
  try {
    const r = await pool.query(`DELETE FROM exams WHERE id = $1 RETURNING id`, [id]);
    if (!r.rowCount) { res.status(404).json({ message: "Exam not found." }); return; }
    res.json({ deleted: true });
  } catch (e) { sendServerError(res, e); }
});

// Subjects CRUD
adminRouter.get("/notes/subjects", async (req, res) => {
  const examId = req.query.examId ? Number(req.query.examId) : null;
  try {
    const r = await pool.query(
      `SELECT s.id, s.exam_id AS "examId", e.name AS "examName", s.name, s.slug, s.description, s.display_order AS "displayOrder", s.is_active AS "isActive"
       FROM exam_subjects s JOIN exams e ON e.id = s.exam_id
       WHERE ($1::int IS NULL OR s.exam_id = $1) ORDER BY s.display_order, s.id`,
      [examId],
    );
    res.json({ subjects: r.rows });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.post("/notes/subjects", async (req, res) => {
  const examId = Number(req.body?.examId);
  const name = String(req.body?.name ?? "").trim();
  const slug = String(req.body?.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-") || name.toLowerCase().replace(/\s+/g, "-");
  const description = String(req.body?.description ?? "").trim();
  const displayOrder = Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0;
  if (!examId || !name) { res.status(422).json({ message: "Exam and subject name are required." }); return; }
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO exam_subjects (exam_id, name, slug, description, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [examId, name, slug, description, displayOrder],
    );
    res.status(201).json({ id: r.rows[0]!.id, name });
  } catch (e: any) {
    if (e.code === "23505") { res.status(409).json({ message: "A subject with that slug already exists in this exam." }); return; }
    if (e.code === "23503") { res.status(404).json({ message: "Exam not found." }); return; }
    sendServerError(res, e);
  }
});

adminRouter.patch("/notes/subjects/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid subject." }); return; }
  const fields: string[] = []; const vals: unknown[] = [];
  if (req.body?.name) { fields.push(`name = $${vals.push(String(req.body.name).trim())}`); }
  if (req.body?.description !== undefined) { fields.push(`description = $${vals.push(String(req.body.description).trim())}`); }
  if (req.body?.displayOrder !== undefined) { fields.push(`display_order = $${vals.push(Number(req.body.displayOrder))}`); }
  if (req.body?.isActive !== undefined) { fields.push(`is_active = $${vals.push(Boolean(req.body.isActive))}`); }
  if (!fields.length) { res.status(422).json({ message: "Nothing to update." }); return; }
  fields.push(`updated_at = NOW()`);
  try {
    const r = await pool.query(`UPDATE exam_subjects SET ${fields.join(", ")} WHERE id = $${vals.push(id)} RETURNING id`, vals);
    if (!r.rowCount) { res.status(404).json({ message: "Subject not found." }); return; }
    res.json({ updated: true });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.delete("/notes/subjects/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid subject." }); return; }
  try {
    const r = await pool.query(`DELETE FROM exam_subjects WHERE id = $1 RETURNING id`, [id]);
    if (!r.rowCount) { res.status(404).json({ message: "Subject not found." }); return; }
    res.json({ deleted: true });
  } catch (e) { sendServerError(res, e); }
});

// Exam Notes CRUD
adminRouter.get("/notes/exam-notes", async (req, res) => {
  const examId = req.query.examId ? Number(req.query.examId) : null;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  try {
    const r = await pool.query(
      `SELECT n.id, n.exam_id AS "examId", e.name AS "examName", n.subject_id AS "subjectId", s.name AS "subjectName",
              n.title, n.description, n.pdf_url AS "pdfUrl", n.thumbnail_url AS "thumbnailUrl",
              n.file_size AS "fileSize", n.tags, n.display_order AS "displayOrder",
              n.is_published AS "isPublished", n.published_at AS "publishedAt", n.created_at AS "createdAt"
       FROM exam_notes n JOIN exams e ON e.id = n.exam_id LEFT JOIN exam_subjects s ON s.id = n.subject_id
       WHERE ($1::int IS NULL OR n.exam_id = $1) AND ($2::int IS NULL OR n.subject_id = $2)
       ORDER BY n.display_order, n.created_at DESC`,
      [examId, subjectId],
    );
    res.json({ notes: r.rows });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.post("/notes/exam-notes", async (req, res) => {
  const examId = Number(req.body?.examId);
  const subjectId = req.body?.subjectId ? Number(req.body.subjectId) : null;
  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const pdfUrl = String(req.body?.pdfUrl ?? "").trim();
  const thumbnailUrl = String(req.body?.thumbnailUrl ?? "").trim();
  const tags = String(req.body?.tags ?? "").trim();
  const displayOrder = Number.isInteger(req.body?.displayOrder) ? req.body.displayOrder : 0;
  const isPublished = Boolean(req.body?.isPublished);
  if (!examId || !title) { res.status(422).json({ message: "Exam and title are required." }); return; }
  if (!pdfUrl) { res.status(422).json({ message: "PDF URL is required." }); return; }
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO exam_notes (exam_id, subject_id, title, description, pdf_url, thumbnail_url, tags, display_order, is_published, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [examId, subjectId, title, description, pdfUrl, thumbnailUrl, tags, displayOrder, isPublished, isPublished ? new Date() : null],
    );
    res.status(201).json({ id: r.rows[0]!.id, title });
  } catch (e: any) {
    if (e.code === "23503") { res.status(404).json({ message: "Exam or subject not found." }); return; }
    sendServerError(res, e);
  }
});

adminRouter.patch("/notes/exam-notes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid note." }); return; }
  const fields: string[] = []; const vals: unknown[] = [];
  if (req.body?.title) { fields.push(`title = $${vals.push(String(req.body.title).trim())}`); }
  if (req.body?.description !== undefined) { fields.push(`description = $${vals.push(String(req.body.description).trim())}`); }
  if (req.body?.pdfUrl !== undefined) { fields.push(`pdf_url = $${vals.push(String(req.body.pdfUrl).trim())}`); }
  if (req.body?.thumbnailUrl !== undefined) { fields.push(`thumbnail_url = $${vals.push(String(req.body.thumbnailUrl).trim())}`); }
  if (req.body?.tags !== undefined) { fields.push(`tags = $${vals.push(String(req.body.tags).trim())}`); }
  if (req.body?.displayOrder !== undefined) { fields.push(`display_order = $${vals.push(Number(req.body.displayOrder))}`); }
  if (req.body?.subjectId !== undefined) { fields.push(`subject_id = $${vals.push(req.body.subjectId ? Number(req.body.subjectId) : null)}`); }
  if (req.body?.isPublished !== undefined) {
    const pub = Boolean(req.body.isPublished);
    fields.push(`is_published = $${vals.push(pub)}`);
    fields.push(`published_at = $${vals.push(pub ? new Date() : null)}`);
  }
  if (!fields.length) { res.status(422).json({ message: "Nothing to update." }); return; }
  fields.push(`updated_at = NOW()`);
  try {
    const r = await pool.query(`UPDATE exam_notes SET ${fields.join(", ")} WHERE id = $${vals.push(id)} RETURNING id`, vals);
    if (!r.rowCount) { res.status(404).json({ message: "Note not found." }); return; }
    res.json({ updated: true });
  } catch (e) { sendServerError(res, e); }
});

adminRouter.delete("/notes/exam-notes/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ message: "Invalid note." }); return; }
  try {
    const r = await pool.query(`DELETE FROM exam_notes WHERE id = $1 RETURNING id`, [id]);
    if (!r.rowCount) { res.status(404).json({ message: "Note not found." }); return; }
    res.json({ deleted: true });
  } catch (e) { sendServerError(res, e); }
});

router.use("/admin", adminRouter);

export default router;