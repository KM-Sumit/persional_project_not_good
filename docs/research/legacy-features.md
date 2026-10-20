# Legacy UCI app: feature inventory for the SvelteKit rebuild

Source: `legacy/` (Replit-built prototype, pnpm monorepo).
- `artifacts/uci-education`: Expo 57 / React Native / Expo Router app that runs on web, Android and iOS.
- `artifacts/api-server`: Express 5 REST API with raw `pg` SQL. Almost everything lives in `src/routes/education.ts`, about 2.5k lines.
- `lib/db`: Drizzle schema in `src/schema/education.ts`.
- `lib/api-spec`: OpenAPI 3 spec. It is partial and stale: it covers only auth/home/courses/notes/tests/attempts and admin dashboard/results.
- `lib/api-zod`, `lib/api-client-react`: Orval-generated clients.
- `artifacts/mockup-sandbox`: Replit shadcn component preview scaffold. Not product code.
- `attached_assets/*.txt`: the original product brief.
- `uci-education-source.zip`: an older snapshot of the same app. Skipped.

The two `legacy/README.md` sections are in Hindi/English. `legacy/password.md` is empty.

The brief asked for FastAPI and OpenAI. The build used Express and Google Gemini. Several UI strings still say "GPT-4o-mini".

---

## 1. User roles

| Role | How it is created | What it can do |
|---|---|---|
| `student` (default) | Self sign-up (`POST /api/auth/signup`) | Browse published courses, notes and tests. Take tests, see own results and history. Mark lessons complete. |
| `admin` | `pnpm seed:admin` using the env vars `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_MOBILE` and `ADMIN_PASSWORD` (at least 12 chars). **Also a backdoor:** signing up with the hard-coded email `admin@uci.com` grants admin (see the gaps section). | Everything a student can do, plus every `/api/admin/*` route: dashboard, results and scoreboard, courses, notes, banners, all test types, questions, PYQ papers, scheduled tests, categories and exams, AI generation, "notify all", admin photo URL. |

- No separate "teacher" role exists. "Admin" is the teacher/institute operator.
- The role is stored in `users.role` and checked server-side by `requireAdmin`.
- In the client, an admin's Home tab is replaced by an admin dashboard, and Profile shows an "Open admin dashboard" link.
- Paid-test buyers are just students with rows in `user_purchases`.

---

## 2. Feature inventory, screen by screen

### 2.0 Shell / navigation (all roles)
- **Auth gate** (`store/auth.tsx`):
  - Not signed in → `/(auth)/sign-in`. Signed in → `/(tabs)/home`.
  - Token storage: SecureStore on native, `sessionStorage` on web, so web users are logged out when the tab closes.
  - The session is restored on boot through `GET /auth/me`.
- **Bottom tabs:** Home, Courses, Notes, Tests, Profile.
  - On Android/web/older iOS the Notes tab is mislabelled **"Job"** with a briefcase icon. That looks like a half-done idea for a jobs/notifications section.
  - On iOS 26 the tabs use native "liquid glass".
- **Standalone screens (no tab bar):** `course/[id]`, `note/[id]`, `test/[id]`, `result/[id]`, `admin`, `admin-add-course`, `admin-add-note` (redirects to `admin-notes`), `admin-notes`, `admin-banners`, `admin-generate-test`, `admin-tests`, `admin-test-questions`, `admin-pyq`, `admin-scheduled-tests`.
- **Shared UI states:** Loading (spinner + label), Error (wifi-off icon + "Try again"), Empty (book icon + copy), ProgressBar.
- **UI copy** is a mix of English, Hinglish ("Courses load ho rahe hain…", "Koi course nahi mila") and Hindi ("आपकी सफलता का साथी").

### 2.1 Auth (public)
- **Sign in:**
  - Fields: "Email or mobile number" and password, with a show/hide toggle.
  - Login matches the email case-insensitively, or the mobile exactly. A 10-digit number also matches a stored `+91…` mobile.
  - Error message: "Email, mobile number, or password is incorrect."
- **Sign up:**
  - Fields: full name, email, mobile (placeholder `+91 98765 43210`), password (at least 8), confirm password.
  - Server rules: email regex; mobile `^\+?[0-9]{10,14}$`; password at least 8.
  - Duplicate email/mobile returns 409. In practice email duplicates are upserted instead (see the bugs section).
- **Logout** deletes the server session row.
- **Not built:** forgot/reset password (the brief asked for it), OTP, refresh tokens, login rate limiting.
- **Token design:**
  - A custom HS256 JWT signed with `SESSION_SECRET`, valid for 7 days.
  - Its `jti` is stored in `sessions`, so every request does a DB lookup and logout really revokes the token.

### 2.2 Student – Home tab (`(tabs)/home.tsx`, data from `GET /student/home`)
- **Brand header:** logo mark, "UCI **सारथी**" with the tagline "आपकी सफलता का साथी".
  - Search, bell and avatar buttons. Search and bell are no-ops.
  - The bell shows a **hard-coded "3"** badge.
- **Search box:** filters only the 4 "popular courses" client-side, by title, exam or instructor. Placeholder: "Courses, subjects, exams dhundein...".
- **Banner slider** (`MeeshoBannerSlider`):
  - Auto-advances every 3.8 s and pauses for 2 s after a drag. Paging dots, an "n / N" counter.
  - Image banners are shown image-only, with no text overlay.
  - Banners without an image fall back to a gradient card. A badge is guessed from the title ("LIVE MOCK TEST", "STUDY MATERIAL", "NEW BATCH"), followed by title, subtitle and CTA.
  - Tapping navigates to `banner.href`, an Expo route string such as `/(tabs)/tests`.
  - With no banners, a fallback gradient poster says "A stronger start to your exam prep".
- **Stats strip:** all hard-coded: "50K+ Students", "500+ Video Lectures", "Live Classes", "Expert Faculty".
- **Quick Access grid:**
  - Live Tests → tests filtered to `scheduled`.
  - PYQ Papers → tests filtered to `pyq`.
  - Courses (scrolls to the section).
  - Live Class → courses tab (placeholder).
  - Study Notes, and My Progress (→ profile).
- **"Target Competitive Exams" carousel:** hard-coded cards for SSC Exams, Railway Exams, MPPSC and MP Police. Each card links to the Tests tab with that `categorySlug`.
- **Courses list:** the latest 4 published courses.
- **"Continue Learning":** **fake**. It shows the first 5 courses with invented progress values (15%, 30%…), "12 min left" and a fake duration.
  - The real API `continueLearning` value (last course progress) is fetched and **ignored**.
- **Notes:** the latest 3, with a "PDF" badge when `pdfUrl` is set.
- **Tests:** the latest 3 published tests, with a difficulty pill.
- **Admin variant of Home:**
  - "ADMIN DASHBOARD" badge, shortcut grid (Scheduled Tests, PYQ Papers, Banners, Add Course, Add Note, Generate Test).
  - Five stat bubbles: Students, Courses, Notes, Tests, Results.
  - "Recent Results" (8), with "Full Board" → `/admin`.

### 2.3 Student – Courses tab + course detail
- **List** (`GET /courses?search=&exam=`):
  - Search matches title, exam or category with ILIKE.
  - Exam filter chips are hard-coded: All, SSC, Banking, Railway, Police, UPSC. The match is an exact `c.exam = $3`.
  - Each card shows thumbnail, exam tag, category, price (`₹` from `price_cents`, or "FREE"), title, description, instructor, lesson count, minutes and "View course".
- **Detail** (`GET /courses/:id`):
  - Hero thumbnail; exam · category; instructor; title; description.
  - Fact chips: lessons, minutes, price/Free.
  - "Course progress" percentage bar.
  - Chapter headers with their lessons. Each lesson shows a play or file icon, a check when done, its minutes and kind.
- **Lesson panel** (appears only when `lesson.body` is non-empty):
  - Shows the lesson body as plain text.
  - **"Open lesson resource"** button calls `Linking.openURL(resourceUrl)`. It opens YouTube or a PDF externally. **There is no embedded player.**
  - "Mark lesson complete" (`POST /lessons/:id/complete`) updates `lesson_progress` and `course_progress`.
- **Lesson kinds:** `text` (seed), `video` (admin form, YouTube URL), plus generic `resourceUrl`.
- **Not built:** enrolment, purchase, ratings, live classes, downloads. `price_cents` is display-only.

### 2.4 Student – Notes tab + note detail
- **List** (`GET /notes?search=&subject=`):
  - Search matches title, subject or exam.
  - Subject chips are hard-coded: All, Mathematics, Reasoning, English, General Knowledge.
  - Cards show subject, exam, title, description and "Read notes".
- **Detail:**
  - Subject · exam, title, description.
  - Body as **plain-text paragraphs**, split on blank lines. No markdown rendering.
  - **"Open PDF"** opens `pdfUrl` externally. Admins are told to paste Google Drive links.
  - "Published <date>".
- There is no exam filter UI, although the API's `search` param also matches exam.

### 2.5 Student – Tests tab (`(tabs)/tests.tsx`)
- **Header:** "EXAM PREPARATION & MOCK TESTS / Competitive Tests".
- **Filters:**
  - **Search** is server-side: title, topic or subject.
  - **Category tabs** come from `GET /categories` (exam_categories), plus "All Exams".
  - **Sub-exam pills** show the exams of the selected category.
  - **Type chips:** All Tests | Live & Scheduled (`scheduled`) | PYQ Papers (`pyq`) | Mock & Practice (`practice`) | **Precision Class** (client filter: `isPrecision || accessType==='password'`).
  - Category and exam filtering happen client-side, by matching `categoryName`/`examId`.
- **List:** grouped by **Category → Exam**. Both levels are collapsible accordions. Tests with no exam fall under "Other / General".
- **Test card:**
  - Status badge: LIVE NOW, a "Starts in Xh Ym" countdown, COMPLETED, CANCELLED, OFFICIAL PYQ, or the raw status.
  - PYQ cards add a year/shift badge.
  - Access badge: 🔑 Password, ₹price (unpaid), Purchased, or 🆓 Free.
  - Meta: question count, minutes, total marks, and a "+m / −n Neg" badge.
  - PYQ cards add "Official Answer Key Verified".
  - Button label: Start Live Test / Unlock & Enter Live / Opens at Scheduled Time / Completed / Unlock ₹X / Enter Password / Retake Test / Start Test.
- **Tap behaviour:**
  - Cancelled or ended scheduled test → an alert.
  - Upcoming scheduled test → opens the detail page, which shows a countdown.
  - Live scheduled test with a password, or any `accessType=password` test not yet attempted → **password modal**. It calls `POST /tests/:id/verify-access`, then navigates to `test/[id]?pwd=…`.
  - Paid and not purchased → alert: "requires payment of ₹X. Please contact admin to purchase."
  - Otherwise → `test/[id]`.

### 2.6 Student – Test session (`test/[id].tsx`)
- **Pre-test screen:**
  - A status box: Cancelled, Concluded, Locked with an "Opens in hh:mm:ss" countdown that flips to live at the start time, or 🔴 LIVE NOW until the end time in IST.
  - Tags: exam/category, year·shift, "Verified PYQ". Title and description.
  - Specs grid: questions, minutes, total marks.
  - **Marking scheme:** +marks for correct, −negative for wrong, 0 for unattempted.
  - Instructions: the test's own text, or a default list of 5 rules (server-synced timer, can't pause, auto-submit…).
  - Password field and "Unlock & Start Test" / "Start Test Now".
  - **Non-scheduled tests auto-start as soon as the page loads.** The pre-test screen is effectively skipped.
- **Start** (`POST /tests/:id/start`):
  - The server checks the schedule window, blocks a second attempt after a completed one (409), and resumes an in-progress attempt.
  - It verifies the password, with rate limiting, and checks a paid purchase (402).
  - It creates the attempt and computes `deadline = min(start + duration, scheduled_end)`.
  - It returns the questions **without `correctIndex` or explanation**, plus `savedAnswers`.
- **Session UI:**
  - Exit (confirmation: "timer will keep running").
  - Title, "x/y answered", "+m / −n".
  - **Countdown timer** derived from the server deadline. It turns red under 2 minutes.
  - A progress bar, then "QUESTION n / N".
  - **Clear**, **Mark for review ("Review later")** and 4 options A–D.
  - Previous / Next. "Submit Test" on the last question.
  - **Question palette:** grid of numbers coloured for current, marked or answered, plus "Review & Submit →".
  - **Submit confirmation modal:** answered, unanswered and marked counts. "Keep Working" or "Confirm Submit".
  - **Auto-submit** at 0, with one retry after 2 s.
- **Submit** (`POST /test-attempts/:id/submit`, body `{answers: {questionId: optionIndex|null}}`):
  - Scoring is server-side.
  - Per-question `marks` and `negative_marks` are used when set; otherwise the test's `marks_per_question` and `negative_marking`.
  - The score is clamped to ≥ 0.
  - `maxMarks` = the test's `total_marks`, or count × default marks.
  - `percentage` = score / maxMarks. `accuracy` = correct / attempted. `time_taken` is capped at the duration.
  - A **10 s grace** applies after the deadline. A later submission is graded as **all unanswered**.

### 2.7 Student – Result (`result/[id].tsx`, `GET /test-attempts/:id`, only the owner's attempts)
- **Hero:** percentage "SCORE" ring, "Test complete", test title.
- **Metrics:** Correct, Incorrect, Skipped.
- **"Your performance":** accuracy, questions correct x/y, time used, submitted date.
- **Answer review:** for each question, the prompt and every option, marked correct ✓ or "Your answer" ✗, a Correct/Incorrect/Skipped badge, and the explanation.
- Buttons: "Practice another test" and the "Test history" back link.
- The raw score in marks (`score/maxMarks`) is not shown, only the percentage.

### 2.8 Student – Profile tab
- Avatar initial, name, email, mobile.
- Stats: "Tests taken" and "Average score" (mean percentage).
- **Test history:** title, date, correct/total, percentage. Each row opens its result.
- Admins also get an "Open admin dashboard" link. "Sign out" for everyone.
- **Not built:** profile edit, photo, settings, My Courses, progress view (all in the brief).

### 2.9 Admin – Dashboard (`admin.tsx`)
- **Header card:** avatar (photo URL if set, otherwise an initial) with a camera button, name, email and a "UCI Administrator" badge.
- **"Edit Profile":** paste an image URL or Google Drive link → `PATCH /admin/profile/photo`.
  - The photo is never returned by `/auth/me`, so it never displays.
- **Action grid:** Scheduled Tests, PYQ Papers, Manage Tests, Generate Test, Offers & Banners, Add Course, Notes Manager, **Send Notification**, Edit Profile.
- **Send Notification panel:** title + message → `POST /admin/notify-all`.
  - The message is only **stored** in a `notifications` table, which the handler creates at runtime.
  - **Nobody can read it.** There is no push and no student inbox.
- **Stats:** Students, Courses, Study Notes, Tests, Completed Tests.
- **Tabs:**
  - **Recent Results** (20): name, email, test, score/total, percentage, accuracy.
  - **Scoreboard:** results grouped by test title, as a table of Student, Score, %, Acc.
  - This is the only "leaderboard" in the app, and it is admin-only. No student ever sees a rank, although the banner copy promises "All India Rank".
- Pull to refresh.
- `GET /admin/scoreboard` exists (ordered by %, with correct/wrong) but is **unused**. The UI groups `/admin/results` instead.

### 2.10 Admin – Courses (`admin-add-course.tsx`)
- **Create only.** There is no list, edit, delete or unpublish UI, and no API routes for those.
- **Top bar:** a "notify students" toggle (calls `notify-all` with "🎉 New Course Available!") and Publish.
- **Tabs:**
  - **Basic Info:** poster/thumbnail URL with live preview and Google Drive auto-convert (`drive.google.com/file/d/ID` → `uc?export=view&id=ID`); title*; description; instructor (default "UCI Faculty").
  - Exam chips: SSC, UPSC, IBPS, RRB, Police, State PSC, Other. These don't match the student filter chips.
  - Category is free text (defaults to the exam).
  - **Videos:** a repeatable list of title + **YouTube URL**. Each entry becomes a lesson of kind `video`, `resource_url`=URL, in one auto-created chapter "Course Content".
  - **Notes:** a repeatable list of title, PDF URL and content. **The client never sends these.** They are dropped silently.
- **Server:** the course is always created `published=true`. It sets `lesson_count`, never `duration_minutes`, and builds no multi-chapter structure.
- **This creation is broken whenever any video is added** (see the bugs section).
- Success screen in Hinglish: "Course Publish Ho Gaya! 🎉".

### 2.11 Admin – Notes (`admin-notes.tsx`, "Notes Manager")
- A wizard: **Section → Exam → Subject (skippable) → Note**. Each level has emoji icons and a "create new" option.
- Note fields: title*, PDF/Google Drive link*, description, "Publish immediately". The list has publish toggles and delete.
- There is also a "Run Migration" button (`POST /admin/migrate-notes`).
- **Every endpoint this screen calls is missing from the backend:** `/admin/notes/sections|exams|subjects|exam-notes`, `/admin/migrate-notes`. It also reads `useAuth().token`, which does not exist.
- **So the screen is dead.** It belongs to a planned hierarchical notes taxonomy, separate from the flat `notes` table.
- The working backend route `POST /admin/notes` (title, description, body, subject, exam, pdfUrl; published=true) **has no UI**, because `admin-add-note` just redirects to `admin-notes`.
- **Not built:** note edit, delete, unpublish or list endpoints.

### 2.12 Admin – Banners (`admin-banners.tsx`, "Offers & Posters")
- **Slide type** chips (Offer/Poster, Live Class, Mock Test, Notes) only preselect the destination.
- **Poster image URL\*** with Google Drive auto-convert and a live preview.
- **CTA text** (default "Enroll Now").
- **Destination:** Courses, Mock Tests, Study Notes or Live Class (→ home).
- The title is auto-generated (e.g. "Offer / Poster — 20/10/2026") and the subtitle is empty.
- The list shows thumbnail, title, CTA and href, with **delete**.
- **Not built:** edit, reorder (`sort_order` is never set by the UI), or an enable/disable toggle. The brief asked for all three.

### 2.13 Admin – Manage Tests (`admin-tests.tsx`): the free / password / paid system
- **Tabs:** All, Free, Password, Paid. These map to `GET /admin/tests?accessType=`.
- The list includes **every** test type: practice, generated, PYQ and scheduled.
- Each card shows an access badge, PUBLISHED/DRAFT, price, exam·category, Q count, minutes, difficulty and completed count.
- Card actions: Publish/Unpublish, **Questions** (→ `admin-test-questions`), Delete (with confirmation).
- **Create Test modal:**
  - Type: 🆓 Free / 🔑 Password / 💳 Paid.
  - Fields: title*, subject, topic, **exam\*** (chips grouped by category), duration, total marks, +marks/Q, −negative, difficulty (Easy/Medium/Hard).
  - **Password type:** custom password, or leave it empty to auto-generate an 8-char password. It is shown once after create. It also sets `isPrecision=true` ("Precision Class").
  - **Paid type:** price ₹ and bundle name.
  - Always "Create & Publish". The server creates `test_type='practice'`, status `active`.
- **"Add Category" / "Add Exam" modal:** creates an `exam_categories` or `exams` row (slug derived from the name). It lists the existing tree.
- **API with no UI:**
  - `PUT /admin/tests/:id` (edit).
  - `POST /admin/tests/:id/set-password` (set or rotate the password).
  - `POST /admin/tests/:id/grant-access` (record a manual purchase for a user).
  - `DELETE /admin/categories/:id` and `DELETE /admin/exams/:id`.

### 2.14 Admin – Questions per test (`admin-test-questions.tsx`): the teacher's own question bank
- Lists the test's questions: prompt, options A–D with the correct one highlighted, explanation, "+marks".
- **Add MCQ modal:** question*, options A–D*, correct A/B/C/D, explanation, marks.
  - Negative marks are not exposed here, though the PYQ form exposes them.
- Delete question.
- No edit, no reorder, no image or maths support.
- Questions belong to exactly **one** test (`test_questions.test_id`). **There is no reusable question bank or "module"** for building tests by picking from a pool. To get a "test from the teacher's own modules", the teacher creates a test and types or pastes its questions.

### 2.15 Admin – PYQ papers (`admin-pyq.tsx`)
- **Paper form:**
  - Title*, target exam*, year*, shift (e.g. "Shift 1"), language (default Hindi), duration (60).
  - +marks/Q (2.0), −negative (0.5), source/authority info, "Verified Authentic PYQ" checkbox.
  - Instructions default to "Official Previous Year Question Paper. Marking: +2 / -0.5."
  - **Total marks is in state (200) but has no input.**
  - "Save as Draft" or "Publish Paper".
- **Filters:** exam chips. Year and search exist in state and API, but have **no UI**.
- **Paper card:** exam, Verified, year, PUBLISHED/DRAFT, title, source, "Q · min · +m/−n". Actions: Manage Questions, Publish/Unpublish, Delete.
- **Question Manager modal:**
  - Add a single question: prompt, A–D, correct, explanation, marks 2.0, negative 0.5.
  - **Bulk Import (JSON):** paste an array of `{prompt, options[4], correctIndex 0-3, explanation?, marks?, negativeMarks?, topic?, difficulty?}`. All rows are validated before insert.
  - Lists questions with the correct option and allows delete.
- `PUT /admin/pyq/:id` (edit) has no UI.

### 2.16 Admin – Scheduled (live, password-protected) tests (`admin-scheduled-tests.tsx`)
- IST notice: "Indian Standard Time (IST) Authoritative Timing".
- **Form:**
  - Title*, exam*.
  - Date as **YYYY-MM-DD text**, hour (1–12), minute, AM/PM. It is composed as `…T hh:mm:00+05:30`, with a live IST preview.
  - Duration chips: 30/45/60/90/120/180.
  - +marks (2.0), −negative (0.5), total marks (100).
  - Optional access password. **The server ignores this field and always generates one.**
  - Description; student instructions (a default 3-line rule list).
  - "Save as Draft" or "Schedule & Publish". Publishing is rejected when the start is in the past.
  - `scheduled_end_at` = start + duration.
- **Generated-password modal:** shows the password once, with Copy and the warning that it "cannot be viewed in plaintext again".
- **List:** exam tag, live status pill (DRAFT, SCHEDULED, LIVE, COMPLETED, CANCELLED), starts, ends, duration, marking. Stats: Enrolled (started), Completed, Avg Score, Top Score.
- **Actions:** Regenerate Password (with confirmation), Stats, Publish (drafts only), Cancel (sets `cancelled` + unpublished).
- **Stats modal:** Started, Submitted, Avg, Top. Each participant row shows name, email, mobile, score, %, and submitted time or "In Progress".
- Questions are added through Manage Tests → Questions, because the scheduled test also appears there. `PUT /admin/scheduled-tests/:id` (edit) has no UI.
- **Student flow:**
  - Countdown before the start.
  - Password modal or field while live (5 failures per user or IP per test → 15-minute lockout).
  - Late joiners get only `min(duration, time until scheduled end)`.
  - One attempt per student.

### 2.17 Admin – AI test generator (`admin-generate-test.tsx`)
- **Mode toggle: Topic | PDF Upload.**
- **Fields:**
  - Topic*. The input is rendered twice by mistake.
  - Subject chips: General Knowledge, Mathematics, Reasoning, English, History, Geography, Science, Economics, Polity.
  - Difficulty: Easy, Medium, Hard. Questions: 5, 10, 15 or 20. Duration: 10/15/20/30/45/60.
- **PDF mode:** `expo-document-picker` selects a PDF, and the client JSON-serialises the picker *asset object*, not the file bytes.
  - **The server has no PDF handling.** It requires `topic` and returns 422. **PDF → questions does not work in legacy.** It has to be built fresh (see section 5).
- **Result:** a new test, `published=true`, `test_type` 'practice', no exam, free.
- Success screen: "Test Generated! 🎉".
- The UI claims "Powered by OpenAI GPT-4o-mini", which is inaccurate.

### 2.18 Things in the brief or schema that are **not** implemented
- Payments or a payment gateway. Paid access is only `user_purchases` rows, created by the unused grant-access API.
- Enrolment. Live classes.
- A student notifications inbox, and push (Expo/FCM).
- Forgot password. Profile edit. Settings.
- A student leaderboard or All-India rank.
- A test `mock` type. The column allows it and the filters count it, but nothing creates it.
- Course editing and chapters UI. Note CRUD UI.
- Banner edit, reorder and enable toggle.
- Duplicate-question prevention for AI output. Bilingual question content.
- File uploads of any kind. Every image or PDF is an external URL, usually a Google Drive link.

---

## 3. Data model (`lib/db/src/schema/education.ts` + runtime DDL)

Every `id` is `serial`. `created_at`/`updated_at` are `timestamptz` with default now.

| Table | Columns | Notes |
|---|---|---|
| **users** | id, name, email (unique), mobile (unique), password_hash (`scrypt$salt$hex`), role (`student`/`admin`, default student), created_at, updated_at, **photo_url** (text default '', added at runtime by `PATCH /admin/profile/photo`) | |
| **sessions** | token_id (PK, uuid = JWT jti), user_id → users (cascade), expires_at, created_at | idx user_id |
| **banners** | id, title, subtitle '', image_url '', cta_label 'Explore', href (nullable), enabled bool true, sort_order 0 | idx (enabled, sort_order) |
| **courses** | id, title, description '', instructor 'UCI Faculty', category 'SSC', exam 'SSC', lesson_count 0, duration_minutes 0, price_cents 0, thumbnail_url '', published false | idx published, exam. Exam and category are **free text**, not FKs. |
| **course_chapters** | id, course_id → courses (cascade), title, sort_order, created_at | |
| **lessons** | id, chapter_id → course_chapters (cascade), title, kind ('text' default; 'video' used), duration_minutes, resource_url '', body '', sort_order, created_at | **no `published` column** |
| **course_progress** | PK (user_id, course_id), completed_lessons, last_lesson_id → lessons (set null), updated_at | |
| **lesson_progress** | PK (user_id, lesson_id), completed_at | |
| **notes** | id, title, description '', body '', subject, exam, pdf_url '', published false | idx published, subject. Subject and exam are free text. |
| **exam_categories** | id, name, slug (unique), description, icon (Feather name, default 'award'), sort_order, enabled | seeded (below) |
| **exams** | id, category_id → exam_categories (cascade), name, slug (unique), description, sort_order, enabled | seeded |
| **tests** | id, title, subject, topic, question_count, duration_minutes 20, difficulty 'Medium', published false, exam_id → exams (set null), **test_type** ('practice'\|'mock'\|'pyq'\|'scheduled'), description, instructions, marks_per_question real 1, negative_marking real 0, total_marks real 0, **status** ('draft'\|'scheduled'\|'live'\|'completed'\|'cancelled'; code also writes 'active' and 'published'), scheduled_start_at, scheduled_end_at, access_password_hash, **access_type** ('free'\|'password'\|'paid'), is_precision bool, price real, bundle_name, year int, shift text, language 'Hindi', source_info, is_verified_pyq bool | idx published, exam_id, test_type, access_type, scheduled_start_at, status |
| **test_questions** | id, test_id → tests (cascade), prompt, options jsonb string[], correct_index int, explanation, topic, difficulty, sort_order, marks real 1, negative_marks real 0 | idx (test_id, sort_order) |
| **test_attempts** | id, user_id → users, test_id → tests (both cascade), started_at, submitted_at, score real, total_questions, correct_answers, wrong_answers, unattempted, percentage real, accuracy real, time_taken_seconds, total_marks real, max_marks real, status ('in_progress'\|'submitted'\|'timed_out') | idx (user_id, started_at), test_id, status |
| **test_answers** | id, attempt_id → test_attempts, question_id → test_questions (both cascade), selected_option int null, is_correct bool | unique (attempt_id, question_id) |
| **test_access_attempts** | id, user_id, test_id (cascade), ip, failed_count, locked_until, updated_at | password brute-force lockout |
| **user_purchases** | id, user_id → users, item_type ('test'\|'bundle'\|'exam'), item_id (no FK), amount real, created_at | idx (user_id, item_type, item_id) |
| **notifications** *(runtime DDL only)* | id, title, body, sent_at, sent_by int | write-only |

**Phantom tables** that the Notes Manager UI expects but that do not exist: note sections `{id, name, icon}`, note exams `{id, sectionId, name, icon}`, note subjects `{id, examId, name}`, and exam notes `{id, examId, subjectId?, title, description, pdfUrl, isPublished}`.

**Migrations:**
- Run as `drizzle-kit push` (`pnpm db:push`), plus a hand-written idempotent `scripts/migrate.ts`.
- `migrate.ts` adds the categories/exams tables, the extra test columns, `test_access_attempts`, and seeds categories.
- It is **not** run on boot, and it does **not** add `access_type`, `is_precision`, `price`, `bundle_name` or `user_purchases`.

**Seed: exam categories → exams** (from `migrate.ts`, which suggests a Madhya Pradesh focus):
- **SSC Exams** (icon award): SSC CGL, SSC CHSL, SSC MTS, SSC GD, SSC CPO
- **Railway Exams** (trending-up): RRB NTPC, RRB Group D, RRB ALP, RRB Technician
- **MPPSC** (book-open): Prelims, Mains, State Forest Service
- **MP Police** (shield): Constable, Sub-Inspector, Jail Prahari

**Seed content** (`seed-content.ts`):
- **3 banners:**
  - "🔥 Flat 50% Off — SSC CGL Foundation Batch"
  - "🏆 All India Live Mock Test Series"
  - "📚 Free Revision Notes & Formula Booklets"
  - All three use Unsplash images.
- **1 course:** "SSC CGL Quantitative Aptitude" (UCI Faculty, free). Chapter "Arithmetic foundations" has 3 text lessons: Percentages and conversions; Profit, loss and discount; Ratio and proportion.
- **4 notes:** Percentage quick sheet (Mathematics); Reasoning: number series; English: subject–verb agreement; General awareness: revision method. All are SSC CGL.
- **2 tests:** "Percentage fundamentals" (Easy) and "Reasoning warm-up", 4 MCQs each, 8 minutes.

---

## 4. API endpoints (all under `/api`)

Auth column: P = public, S = signed-in user, A = admin.

### Public / auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /healthz | P | `{status:"ok"}` |
| POST | /auth/signup | P | name, email, mobile, password → `{token, expiresIn, user}` (201) |
| POST | /auth/login | P | identifier (email/mobile), password → session |
| POST | /auth/logout | S | revoke session (204) |
| GET | /auth/me | S | current user |
| GET | /categories | P | enabled categories with nested exams + pyq/mock/scheduled published counts |
| GET | /exams/:id | P | exam + category + counts |

### Student
| Method | Path | Purpose |
|---|---|---|
| GET | /student/home | banners (enabled), continueLearning, popularCourses (4), upcomingTests (latest 3 published, not actually "upcoming"), latestNotes (3) |
| GET | /courses?search&exam | published courses + user's completedLessons |
| GET | /courses/:id | course + flat chapter/lesson rows with `completed` |
| POST | /lessons/:id/complete | mark lesson done, recompute course_progress |
| GET | /notes?search&subject | published notes |
| GET | /notes/:id | note with body |
| GET | /exams/:id/tests?type&year&shift&search | tests of an exam with attempted/activeAttemptId/hasPurchased/requiresPassword/computedStatus |
| GET | /scheduled-tests | published scheduled tests + liveStatus + serverTime (ISO + IST) |
| GET | /tests?search&type | all published tests with the same per-user flags |
| GET | /tests/:id | test meta + computedStatus + serverTime |
| POST | /tests/:id/verify-access | `{password}`, checks window + password with lockout |
| POST | /tests/:id/start | `{password?}` → `{attemptId, startedAt, deadline, serverTime, test, questions (no answers), savedAnswers}` |
| POST | /test-attempts/:id/submit | `{answers:{[qid]: idx\|null}}` → score summary |
| GET | /test-attempts | own submitted attempts |
| GET | /test-attempts/:id | own attempt + review (correct answers + explanations) |

### Admin (`/api/admin/*`, require admin)
| Method | Path | Purpose |
|---|---|---|
| GET | /admin/dashboard | counts: students, courses, notes, tests, attempts |
| GET | /admin/results | all submitted attempts with student name and email |
| GET | /admin/scoreboard | attempts ordered by test, then % (unused by UI) |
| POST | /admin/generate-test | Gemini MCQ generation (section 5) |
| POST | /admin/courses | create course + optional video lessons (broken, see the bugs section) |
| POST | /admin/notes | create note (no UI) |
| GET | /admin/banners | all banners |
| POST | /admin/banners | create banner |
| DELETE | /admin/banners/:id | delete banner |
| POST | /admin/notify-all | store a notification row (no delivery) |
| PATCH | /admin/profile/photo | set admin photo_url (runtime ALTER TABLE) |
| GET | /admin/scheduled-tests | scheduled tests + participant/completed/avg/top |
| POST | /admin/scheduled-tests | create (auto password, returned once) |
| PUT | /admin/scheduled-tests/:id | edit (no UI) |
| POST | /admin/scheduled-tests/:id/publish | publish (+ generate password if missing) |
| POST | /admin/scheduled-tests/:id/cancel | cancel |
| POST | /admin/scheduled-tests/:id/regenerate-password | new password, returned once |
| GET | /admin/scheduled-tests/:id/stats | stats + participants (name/email/mobile/score) |
| GET | /admin/pyq?examId&year&search | PYQ papers |
| POST | /admin/pyq | create paper |
| PUT | /admin/pyq/:id | edit paper (no UI) |
| DELETE | /admin/pyq/:id | delete paper |
| POST | /admin/pyq/:id/publish, /unpublish | toggle |
| GET | /admin/tests/:id/questions | questions incl. answers |
| POST | /admin/tests/:id/questions | add one MCQ (exactly 4 options, correctIndex 0–3) |
| POST | /admin/tests/:id/questions/bulk | bulk JSON import (validated all-or-nothing) |
| DELETE | /admin/questions/:id | delete question, recount |
| GET | /admin/categories | categories with exams |
| POST | /admin/categories | create category |
| DELETE | /admin/categories/:id | delete (no UI) |
| POST | /admin/exams | create exam under category |
| DELETE | /admin/exams/:id | delete (no UI) |
| GET | /admin/tests?accessType | all tests (any type) with stats |
| POST | /admin/tests | create free/password/paid practice test |
| PUT | /admin/tests/:id | edit (no UI) |
| POST | /admin/tests/:id/publish, /unpublish | toggle |
| DELETE | /admin/tests/:id | delete |
| POST | /admin/tests/:id/set-password | set or generate password, switch to password type (no UI) |
| POST | /admin/tests/:id/grant-access | `{userId}` → user_purchases row (no UI) |

The client calls these endpoints, but they **do not exist**: `GET/POST /admin/notes/sections`, `/admin/notes/exams`, `/admin/notes/subjects`, `/admin/notes/exam-notes` (+ `PATCH`/`DELETE /:id`), and `POST /admin/migrate-notes`.

---

## 5. AI usage

- **Provider:** Google Gemini REST, `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`.
  - On HTTP 404 it retries with `gemini-1.5-flash`.
  - The key comes from env `GEMINI_API_KEY`. It is sent **both** as the `?key=` query param and in the `x-goog-api-key` header. The query param leaks into logs.
  - With no key, the route returns 503.
- **Request:**
  - `system_instruction`: "You are an expert exam question creator. Always respond with valid JSON only."
  - A single user message.
  - `generationConfig: { responseMimeType: "application/json", temperature: 0.7 }`. **No `responseSchema`** is used.
- **Inputs:** topic (required), subject (default "General Knowledge"), difficulty (default "Medium"), questionCount (clamped to 3–20, default 10), durationMinutes (clamped to 5–60, default 15).
- **Prompt (verbatim template):**
  ```
  Generate a multiple choice quiz with exactly ${questionCount} questions on the topic: "${topic}" for subject "${subject}".
  Difficulty level: ${difficulty}.
  IMPORTANT: Respond with ONLY valid JSON. No markdown, no backticks, no explanation.
  Format exactly like this:
  { "title": "short quiz title here",
    "questions": [ { "prompt": "Question text here?", "options": ["Option A","Option B","Option C","Option D"],
                     "correctIndex": 0, "explanation": "Brief explanation why Option A is correct." } ] }
  Rules:
  - Exactly ${questionCount} questions
  - Each question has exactly 4 options
  - correctIndex is 0-3 (0=first option)
  - All questions must be about: ${topic}
  - Difficulty: ${difficulty}
  ```
- **Expected output shape:** `{ title: string, questions: [{ prompt: string, options: string[4], correctIndex: 0..3, explanation: string }] }`.
- **Parsing:**
  - The parser takes `candidates[0].content.parts[0].text`, strips code fences and runs `JSON.parse`.
  - It accepts any object with a `title` and a non-empty `questions` array.
  - **There is no per-question validation**: option count, index range, empty strings and duplicates are all unchecked.
- **Fallback:** if Gemini fails or the output can't be parsed, the server **silently builds a fake test**.
  - It uses 10 generic template questions such as "Which of the following is the most fundamental concept associated with X?". The correct answer is always A.
  - These are saved and published as if they were real.
- **Storage:** one transaction inserts `tests` (title, subject, topic, count, duration, difficulty, published=true) and `test_questions` (topic and difficulty copied). It returns `{testId, title, questionCount, topic, subject, difficulty, durationMinutes}`.
- **PDF → questions: not implemented** (section 2.17). The brief asked for OpenAI. The rebuild must design this from scratch:
  - Upload the PDF to the server.
  - Use the model's native PDF input, or extract the text.
  - Request structured output with a JSON schema.
  - Validate with Zod.
  - Review in a draft before publishing.

---

## 6. Branding

- **Names:**
  - The brief calls it "**UCI — Government Exam Preparation**". The Expo app name is "UCI Government Exam Preparation".
  - Sign-in shows "UCI." with the eyebrow "GOVERNMENT EXAM PREPARATION".
  - The in-app header reads **"UCI सारथी"** (UCI Saarthi) with the tagline **"आपकी सफलता का साथी"** ("your partner in success").
  - The README title is "UCI Exam Prep".
  - What "UCI" stands for appears nowhere.
- **Logo** (`artifacts/uci-education/assets/images/icon.png`, identical to `icon_2.png`, 1024², also the favicon):
  - A deep-navy rounded square.
  - An orange/amber rising sun with rays.
  - A winding road runs from the sun into an open cream book with orange page edges.
  - In-app, a generic Ionicons "book-outline" mark on navy is used instead of the logo.
- **Palette** (`constants/colors.ts`, light only):
  - primary **#d87735** (orange); foreground/text **#18344a** (navy).
  - background **#f7f5f0** (warm cream); card #ffffff.
  - secondary #edf0ed; muted #eeece6; muted-fg #71808a.
  - accent #f6e8da; accent-fg #7b4728.
  - border #e4e1d9; input #d9d8d2; destructive #ef4444.
  - radius 8.
  - Screens also hard-code many Tailwind-ish hues: indigo #6366f1, amber #D97706/#f59e0b, emerald #10b981, red #DC2626, blue #2563EB, violet #7c3aed, pink #ec4899.
- **Type:** Inter (400/500/600/700). **Icons:** Feather and Ionicons, with emojis sprinkled throughout the UI copy.
- **Contact info:** none anywhere in the code (no phone, address, WhatsApp or social links). Admin emails in the docs are placeholders.
- **Deploy identifiers:**
  - Android package `com.uci.examprep`.
  - EAS owner `abhishek_mewada_911`.
  - Backend on Render (`uci-8y03.onrender.com`). Web export to Vercel.
  - The Supabase/Neon Postgres is not secret-bearing in code.
- **Env vars (names only):** `DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`, `PORT`, `TZ` (Asia/Kolkata), `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_MOBILE`, `ADMIN_PASSWORD`, `EXPO_PUBLIC_DOMAIN`.
  - The README contains sample credential values; do not reuse them.
- **Real content:** this is the seed content in section 3. There are no real course names beyond the seed. The tone targets MP (Madhya Pradesh) and central government exam aspirants, in Hindi-first plus Hinglish.

---

## 7. Gaps and bugs worth fixing in the rebuild

### Security (critical)
1. **Account takeover on sign-up.** `INSERT … ON CONFLICT (email) DO UPDATE SET password_hash=…, role=…` means anyone can sign up with an existing email and overwrite that user's password and name. The fix is a plain insert with a 409 on conflict.
2. **Admin backdoor.** Sign-up with `admin@uci.com` gets `role='admin'`. Combined with item 1, anyone can become admin. Remove it. Admins should come only from seed or invite.
3. No login or sign-up rate limiting. Only the test-password route has a lockout. `cors()` is wide open.
4. The Gemini key is passed in the URL query string, which leaks into logs.
5. The test access password travels in the route URL (`test/[id]?pwd=…`), which leaks into history and logs.
6. The password lockout check is keyed `(user_id OR ip)`, but failures are recorded per user only. An IP-level lock is never actually set by IP.
7. Runtime DDL inside request handlers (`CREATE TABLE notifications`, `ALTER TABLE users`) should be proper migrations.

### Broken features
8. **Admin course creation fails** whenever video lessons are added. The insert names a `lessons.published` column that does not exist, so it returns a 500.
9. **Video lessons can't be opened or completed.** The lesson panel renders only when `body` is non-empty, and admin-created video lessons have an empty body. There is no YouTube embed anywhere. The rebuild should embed with `youtube-nocookie` and track completion.
10. **The Notes Manager is dead.** All its endpoints are missing, and it uses a non-existent `token`. Admins effectively cannot create notes. Course "Notes" tab entries are silently discarded.
11. **PDF → AI questions is not implemented.** The client sends a JSON asset object, the server ignores it and returns 422.
12. **The AI fallback publishes fake template questions** (all answer A) as a real test. The rebuild should fail loudly instead, and create drafts for review.
13. The AI output is not validated per question (option count, index range, duplicates). There is no schema-constrained output and no duplicate-question prevention.
14. **Password-protected practice tests opened directly can't be unlocked.** `test/[id]` checks `isPasswordProtected`, a field the API never returns (it returns `requiresPassword`), so the password field is hidden. Non-scheduled tests also auto-start, which skips the instructions and marking-scheme screen.
15. **The scheduled-test status shown to students is wrong.** Cards and detail use the DB `status` (`'scheduled'`) instead of `computedStatus`/`liveStatus`, so a live test still shows "Opens at Scheduled Time" until the client-side countdown flips.
16. **"Retake Test" is promised, but the server forbids a second attempt (409).** Decide on a policy: unlimited practice retakes versus one attempt for scheduled tests. Store attempts per try.
17. **Answers are not saved during the attempt.** `savedAnswers` is only written at submit, and the client ignores it on resume, so a reconnect loses every answer. **A submit more than 10 s late is graded as all-blank.** Autosave each answer server-side and grade what was saved at the deadline.
18. A `timed_out` attempt gets `submitted_at` but a null score. It then appears in history with nulls and blocks re-attempts.
19. The scheduled-test custom password is ignored (always auto-generated). The PYQ total-marks input is missing. PYQ year and search filters have no UI.
20. The admin photo is saved but never returned, so it never shows. Students have no profile edit or photo at all.
21. Banners: there is no edit, reorder or enable toggle, and the title and subtitle can't be set. Courses: there is no list, edit, delete, unpublish or chapter management. Notes: no edit, delete or unpublish. Several APIs exist with no UI (test edit, set-password, grant-access, category/exam delete, PYQ edit, scheduled edit, scoreboard).
22. **"Notify all" stores rows that nothing reads.** The bell icon is a no-op with a hard-coded "3". Build a real in-app inbox, with web push optional.
23. **Paid tests have no checkout.** `grant-access` has no UI, and the bundle purchase check compares the bundle id to the test id (always wrong). Decide on a payment gateway (e.g. Razorpay), or keep manual grants with an admin UI.

### Data / UX inconsistencies
24. There are **three disconnected taxonomies**:
    - `exam_categories → exams`, used for tests;
    - free-text `courses.exam/category` and `notes.exam/subject`;
    - the phantom notes sections/exams/subjects.
    The student course filter chips (SSC, Banking, Railway, Police, UPSC) don't match the admin chips (SSC, UPSC, IBPS, RRB, Police, State PSC, Other), so Banking and Railway never match. The rebuild should use one exam taxonomy shared by courses, notes and tests.
25. **Fake home data:**
    - The "Continue Learning" progress is invented and the real `continueLearning` value is ignored.
    - The "50K+ Students" stats are hard-coded, and so are the home category cards.
    - Home "upcoming tests" are really the latest 3 tests.
    - The home search covers only 4 courses.
26. The Notes tab is labelled "Job" on most platforms.
27. Test types: `mock` is never creatable. AI tests have no exam, so they land in "Other". Admin "Manage Tests" mixes every type together.
28. **There is no reusable question bank.** Each question belongs to one test. The requested "tests from the teacher's own modules/question banks" need new tables:
    - a question bank grouped by subject/topic module;
    - a `test_questions` join table, or snapshot copies.
    That allows picking or randomising questions from modules.
29. Questions are single-correct 4-option MCQs only. There are no images, maths/LaTeX, Hindi plus English bilingual text, or per-question negative marks in the simple editor.
30. **Leaderboards:** only an admin scoreboard exists, grouped by title, so tests with the same title merge. Student-facing ranks and percentiles, promised in the banners, are missing.
31. **Results:** the raw marks score isn't shown to students, only the percentage. The admin list prints "score/totalQuestions correct", but score is marks, not a count.
32. Web tokens live in `sessionStorage`, so users are logged out per tab. Prefer httpOnly cookie sessions in SvelteKit.
33. The scheduled date is typed as free text. Use native `datetime-local` with an IST conversion.
34. `migrate.ts` and the Drizzle schema have drifted: several columns exist only through `db:push`. Status values are inconsistent ('active', 'published', 'scheduled'…). Use one migration path and enums or check constraints.
35. The OpenAPI spec is stale. Generated hooks are cast with `as unknown as` and `@ts-ignore` throughout.
36. Not built at all: forgot password, live classes, enrolment, course ratings, and file uploads. Every image and PDF depends on Google Drive links. The rebuild should provide uploads to object storage, or at least validated Drive-link handling.
