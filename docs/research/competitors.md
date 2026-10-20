# UCI competitor and pattern research

Researched 2026-10-20. Scope: public site, student LMS (YouTube lessons + markdown notes), online tests (free, password-protected scheduled, question-bank), teacher/admin, responsive web/PWA later wrapped for Android/iOS.

Confidence key: **[V]** verified from a primary source (official docs, the company's own blog, or token files). **[S]** secondary (review aggregators, case studies, vendor blogs). **[K]** observed product convention or practitioner knowledge with no single citable page. Review-aggregator "complaint" summaries are small or auto-generated samples, so read them as directional only.

---

## 1. Competitors

### Physics Wallah (PW), pw.live
- **Navigation [K]:** bottom tabs on phone (Home / Batches / Study / Library-style hub / Profile, labels vary by release). The batch is the main container: a batch has Subjects, then Chapters, then Lectures, Notes, DPPs (daily practice problems) and Tests. Exam category is chosen at onboarding and switched from the header.
- **Key screens:** exam picker, batch store, batch home (schedule + subjects), lecture player with attached notes/DPP, test series, doubt/community, downloads.
- **Best at:** price-to-value, and the **batch to subject to chapter to {lecture, notes, DPP, test}** hierarchy that students already know. A guide describes it as "clear categories for batches, study materials, and tests" ([BlueStacks guide](https://www.bluestacks.com/blog/game-guides/pw-jee-neet/pw-beginners-guide-en.html), promotional).
- **Complaints [S]:** iOS crashes during live classes and lessons that won't open ([Kimola App Store report](https://kimola.com/reports/unlock-insights-physics-wallah-app-user-feedback-report-app-store-in-156485)). Frequent UI churn and forced updates, a community section that jumps to external pages, and constant upsell of new batches ([G2](https://www.g2.com/products/physicswallah/reviews)). Paid recorded lectures that won't load ([Voxya complaints](https://voxya.com/consumer-complaints/facing-problem-to-completely-access-to-my-paid-prayas-batch/167440)). Feature gaps between platforms, such as bookmarks on Android but not iOS ([JustUseApp](https://justuseapp.com/en/app/1641443555/physics-wallah/contact)).

### Unacademy
- **Navigation [S]:** a full rebuild cut five tabs (Schedule, Syllabus, Tests, Updates, Profile) to **three: Planner, Self-study, Profile**, and **removed the hamburger menu** because "the user cannot immediately see what it contains" ([The Hard Copy case study](https://thehardcopy.co/unacademy-rewrites-the-book/)).
- **Key screens:** Planner (today's live classes and tests, the daily loop), Self-study (syllabus tree, practice, test series), Profile (progress and analytics). There is also a separate educator dashboard ([Prototypr case study](https://blog.prototypr.io/redesigning-unacademys-internal-educator-dashboard-ui-ux-case-study-6cc1897ee833)).
- **Best at:** a **"today" planner as the home screen**. It answers "what do I do now?" with no browsing. Strong educator branding.
- **Complaints [K]:** subscription and paywall pressure, sales calls, and content scattered across many educators. I did not find a solid primary source for these, so verify them in Play Store reviews.

### Testbook
- **Navigation [K]:** bottom tabs (Home / Tests / Live / Pass / Profile style). Exam selection drives everything. The test list is grouped by exam, then test series, then section (Full / Sectional / Chapter / PYP).
- **Key screens:** the test-series catalogue; a CBT-clone attempt screen (question palette, mark for review, section tabs, language toggle); results with All India Rank, percentile, a topper comparison, time per question and a solutions view.
- **Best at:** **test volume plus analytics plus live all-India tests.** Live tests run at the same time nationwide so students can benchmark ([Inc42](https://inc42.com/startups/testbook)). Pass is one membership: "1,50,000+ Mock Tests, 30,000+ PYPs, Unlimited Live Tests" ([Testbook FAQ](https://testbook.com/viteee/test-series)). Analysis is "based on performance" with improvement pointers ([MixRank Play listing](https://mixrank.com/playstore/apps/com.testbook.tbapp)).
- **Complaints [S]:** freezes and lag when opening quizzes and tests, promo pop-ups every time the app opens, and downloaded videos that won't play ([G2 Testbook Pass](https://www.g2.com/products/testbook-pass/reviews)).

### Adda247
- **Navigation [K]:** bottom tabs plus a large home feed of banners (courses, mock tests, e-books, current affairs, live classes). Store-heavy.
- **Best at:** coverage of government exams (banking, SSC, railways), bilingual Hindi/English content, daily current-affairs habit content.
- **Complaints [S]:** outdated tests, slow support after purchase, UI and lecture organisation that "could benefit from improvements", lag in recorded content ([Kimola Play report](https://kimola.com/reports/unlock-insights-adda247-exam-prep-app-user-feedback-report-google-play-en-in-155292)). Unwanted sales calls and videos disappearing ([Kimola](https://kimola.com/reports/unlock-insights-adda247-app-review-analysis-report-google-play-en-141543)). Listed among India's most 1–2-star-reviewed education apps ([Unstar](https://unstar.app/ru/worst-apps/education/in/india)).

### Classplus (white-label coaching apps)
- **Model [S]:** a branded app for each institute, with batch management, notifications, test creation with auto-correction, live classes, fee collection and course selling ([Capterra](https://www.capterra.com/p/208852/Class-Plus/reviews/), [SoftwareOne](https://platform.softwareone.com/product/classplusapp/PCP-9300-0602), [FitGap](https://us.fitgap.com/products/021852/classplus)).
- **Best at:** getting a coaching centre a Play Store app quickly. Batch-based access control, plus attendance and fees together.
- **Weak spots [S, competitor-biased]:** Testpress claims sectional mocks with negative marking, rank analytics and DRM are "limited" ([Testpress](https://blog.testpress.in/the-best-classplus-alternative-for-coaching-training-institutes-cost-effective-alternative-for-classplus/)). **[K]** Every institute gets the same generic template look. This is the gap a premium custom UCI app beats.

### Teachmint
- **Model [S]:** moved away from coaching and toward school ERP and the Teachmint X digital board in 2023 ([Testpress](https://blog.testpress.in/best-teachmint-alternative/)). Its modules are Result, Attendance, Fees, Finance and Test & Paper ([G2](https://www.g2.com/products/myclasscampus/reviews)). A Capterra reviewer says the topic-wise question bank needs improvement ([Capterra](https://www.capterra.com/p/163105/Teachmint/reviews/?page=3)).
- **Lesson for UCI:** ERP-style admin (sessions, batches, results, attendance) is the bar that institute owners expect. A **topic-tagged question bank** is a known weak spot in the market.

### Khan Academy
- **Structure [V]:** Course, then Unit, then Lesson, then Exercise/Video/Article. **Mastery levels** run Not started, Attempted, Familiar, Proficient, Mastered, each with its own icon. Course pages show percent mastered and mastery points. A **Course Challenge** card sits at the bottom. Assessments come in three scopes: quiz (lesson), unit test, course challenge ([KA mastery levels](https://support.khanacademy.org/hc/tr/articles/5548760867853), [Course & unit mastery](https://support.khanacademy.org/hc/articles/115002552631-What-are-Course-and-Unit-Mastery-)).
- **Best at:** progress that is legible at every level of the tree, calm UI, and a "Up next" resume point.

### Coursera
- **Lesson UX [V]:** an interactive transcript beside the video. You highlight transcript text to save a timestamped note, and the video drops to picture-in-picture while you highlight. Notes collect into one review page that you can view by module ([Coursera blog: unified notes](https://blog.coursera.org/ready-for-retention-presenting-a-unified-note-taking-experience/)). On mobile, a note captures a screenshot of the frame, the transcript snippet and your own text ([Coursera blog: mobile](https://blog.coursera.org/new-mobile-features-transcripts-notes-reminders)).
- **Best at:** **timestamped notes tied to video**, a module-by-module syllabus with week deadlines, and a left syllabus sidebar on desktop.

### Duolingo (motion reference)
- **[V]** Milestone celebrations were redesigned as "power-ups", and "timing is everything": the team ran multiple rough passes to tune rhythm before polishing ([Duolingo blog](https://blog.duolingo.com/streak-milestone-design-animation)). **[S]** Character animation runs on Rive state machines rather than pre-rendered video ([DEV](https://dev.to/uianimation/bringing-characters-to-life-with-rive-duolingo-style-animation-for-apps-16j7)). A designer's stated principles: evoke emotion, keep a beat, get to the payoff quickly, no decoration for its own sake ([LinkedIn](https://co.linkedin.com/in/felipe-quintero-a3487b167)).
- **Lesson for UCI:** keep the expressive motion for **rare, earned moments** (test submitted, personal best, streak milestone). Keep everything else quiet.

---

## 2. Test-taking UX best practices

Indian students train on the **NTA/TCS iON CBT layout**. Matching it lowers exam-day anxiety, so copy its *semantics* and polish its *visuals*. NTA's own mock app (National Test Abhyas) is the reference ([CBT guide](https://open-exam-prep.com/study-guides/in-ugc-net/introduction/exam-day-cbt-mechanics), [NEET CBT guide](https://ksquareinstitute.in/blog/?p=6174)).

**Question palette (five states, one legend that is always visible):**
| State | Convention | Note |
|---|---|---|
| Not visited | grey/white | |
| Not answered (visited) | red | |
| Answered | green | |
| Marked for review | purple | not scored |
| Answered + marked | purple with a green dot | **scored**, so say so explicitly in the legend |

The colours vary between sources, so pair each colour with a **shape or icon** (colour-blind safe), and show counts per state above the palette ([open-exam-prep](https://open-exam-prep.com/study-guides/in-ugc-net/paper2-strategy-exam-execution/exam-day-protocol-checklist)).

**Layout:** desktop puts the question on the left (about 70%) and a sticky palette on the right. On phone, the palette is a bottom sheet behind a "Q 12/90" chip. Use a sticky footer for: *Mark for review & next*, *Clear*, *Save & next* (primary). Section tabs go at the top, with per-section counts.

**Timer:** one countdown in the header with a tabular-numeral font. Change its colour at 5 and 1 minute, and announce it to screen readers at those thresholds only. Add optional per-section timers where the exam has them (CAT/SSC). Calculate time from the **server deadline**, not a client countdown, so it survives reloads and tab sleeps. **[K]**

**Section switching:** allow free switching unless the exam locks sections. When it does, show a confirm sheet: "You can't return to Section A."

**Autosave:** save every answer change to IndexedDB at once and sync to the server in the background (debounced about 1s, plus on visibility change). Show a quiet "Saved" or "Offline, 3 answers queued" indicator, and **resume on any device** at the same question. Testbook's freezes ([G2](https://www.g2.com/products/testbook-pass/reviews)) are the failure to avoid: the attempt screen must never block on the network.

**Submit:** show a summary sheet (answered / not answered / marked / not visited, broken down by section) and require one explicit confirm. Auto-submit at 0:00 and on deadline.

**Password-protected scheduled tests [K]:** a lobby screen with a countdown, the instructions, and a password field that unlocks only inside the window. Show the server time.

**Results and analytics:** score, rank and percentile (within batch, and across UCI), accuracy, attempted count. Show time spent per question compared with the topper and the average. Break down by subject, topic and difficulty. Add a "careless vs. didn't know" split (wrong answers under 20s). Compare with your previous attempts. Testbook-style live-test rank is the benchmark ([Inc42](https://inc42.com/startups/testbook)).

**Solutions:** filter by Wrong / Skipped / Marked / All. Show your answer, the correct answer and the solution together, plus the % of students who chose each option. Add "Bookmark to revision" and "Report an issue" ([Edwisely](https://blog.edwisely.com/?p=1919)), and a link to the related lesson or note.

**Integrity (light) [K]:** count fullscreen exits and tab switches, show the count to admins, and never auto-ban. Shuffle question and option order for each student.

---

## 3. Admin and teacher UX at scale

**Information architecture [K]:** `Academic session (2026–27)` contains `Batches` (e.g. "JEE 2027 Morning"), which contain `Students` + `Courses` + `Tests`. Store the **session switcher** in the header and keep it across pages. Every list is scoped to the active session by default, with an "All sessions" escape hatch. Rolling over a session copies batches, courses and tests forward but not students. This is the ERP model institute owners expect ([Teachmint modules](https://www.g2.com/products/myclasscampus/reviews)).

**Question bank:** tag every question with subject, chapter, topic, difficulty, type, source/year, language and author. Faceted filters with counts. Show where each question has been used ("used in 4 tests"). Full-text search over the question body, including math. Detect duplicates. Bulk import from CSV/Docx/PDF with a **review grid before commit** (UCI already has PDF-to-questions, so add that review step). A topic-wise bank is a known gap in the market ([Capterra on Teachmint](https://www.capterra.com/p/163105/Teachmint/reviews/?page=3)).

**Test builder:** a blueprint mode ("30 Physics: 10 easy / 15 medium / 5 hard, from chapters X, Y") that auto-picks and lets you swap one question. Also offer manual pick from the bank. Marking scheme per section (+4/−1). A schedule window, password, batch targeting and result-release time. Preview as a student.

**Tables (students, tests, questions) [S]:** checkbox selection with a **sticky bulk-action bar**; selected rows get a background highlight, not just a ticked box; destructive bulk actions confirm and state the count ("Delete 37 questions?"); filter first, then select all matching; more than 3 row actions go into a "More" menu; sticky header and filters ([UX Planet](https://uxplanet.org/best-practices-for-usable-and-efficient-data-table-in-applications-4a1d1fb29550), [SaaS UI](https://www.saasui.design/blog/saas-data-table-ui-patterns), [Medium/uxdworld](https://medium.com/uxdworld/best-practices-for-providing-actions-in-data-tables-d629c6e73ab8)). **Saved views** only for complex tables, with a sensible default and persistence ([Basis](https://design.basis.com/patterns/saved-views)). Filter and paginate on the server ([Edana](https://edana.ch/?p=51533)).

**Bulk actions to support:** move students between batches, extend access, reset a test attempt, publish/unpublish, retag questions, export (CSV/PDF result sheets), send WhatsApp/SMS/push to a filtered set.

**Speed features [K]:** a ⌘K command palette (jump to a student, test or question), URL-encoded filters so views are shareable, keyboard shortcuts in grading and review, optimistic updates with an undo toast instead of confirm dialogs for non-destructive actions, and an audit log ("who changed this test").

---

## 4. LMS video lesson and notes UX

- **Layout [V/K]:** desktop puts the player and notes in the main column with a **syllabus sidebar** (Coursera, Khan). Phone has a sticky player on top with tabs below (Notes / Resources / Up next).
- **Timestamped notes [V]:** "Add note at 12:34" captures the time, and clicking a note seeks the video. All notes are also collected on one review page by module ([Coursera](https://blog.coursera.org/ready-for-retention-presenting-a-unified-note-taking-experience/)).
- **Markdown notes [K]:** render KaTeX math, code and images, and add an auto table of contents for long notes. Give reading mode a comfortable 65–75ch line length. Make notes printable and downloadable as PDF, which Indian students expect.
- **YouTube embed [K]:** use `youtube-nocookie.com` and the IFrame API for progress (the 90% watched mark counts as complete). Load a lite facade first (thumbnail + play) for speed. Offer 1.25–2× speed controls and remember position per lesson. Be honest about the limit: YouTube is not DRM, so use unlisted videos and accept it.
- **Progress [V]:** show a state on every lesson (not started / in progress / done) and per-chapter percentages, Khan-style ([KA](https://support.khanacademy.org/hc/articles/115002552631-What-are-Course-and-Unit-Mastery-)). Put "Continue where you left off" at the top of home.
- **Attachments per lesson:** notes, DPP (practice) and a mini-test, following PW's chapter bundle model.
- **Avoid:** inaccessible paid lectures and crashes during playback (PW and Adda complaints above). Show a retry state, never a blank player.

---

## 5. Motion guidelines per platform

**Material 3 tokens (verified)** ([material-web tokens](https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss)):
- Durations: short1–4 = 50/100/150/200ms, medium1–4 = 250/300/350/400ms, long1–4 = 450/500/550/600ms, extra-long1–4 = 700–1000ms.
- Easing: standard `cubic-bezier(0.2,0,0,1)`, standard-decelerate `(0,0,0,1)`, standard-accelerate `(0.3,0,1,1)`, emphasized-decelerate `(0.05,0.7,0.1,1)`, emphasized-accelerate `(0.3,0,0.8,0.15)`.

**Apple HIG [V]:** "Don't add motion for the sake of adding motion." Make motion optional, and when Reduce Motion is on, "minimize or eliminate animations". Never let motion be the only carrier of information ([HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)). Scaling, spinning and peripheral motion are the triggers to avoid under Reduce Motion ([App Store Connect criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)). SwiftUI defaults to springs set by duration + bounce, with smooth / snappy / bouncy presets ([WWDC23 Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)).

**Recommended UCI motion spec:**
| Context | Desktop (≥1024px) | Tablet | Phone / wrapped app |
|---|---|---|---|
| Hover / press feedback | 100ms standard | 100ms | press scale 0.97, 100ms; no hover |
| Menus, popovers, tooltips | 150ms in (decelerate) / 100ms out | 150/100 | — |
| Bottom sheet, palette sheet | — | 300ms emphasized-decelerate | 300ms in / 200ms out (emphasized-accelerate), drag to dismiss |
| Page / route change | 200ms crossfade + 8px rise, **no bounce, no slide** | 250ms fade-through | 300ms shared-axis X push (iOS-like); back = reverse |
| Dialog | 200ms fade + scale 0.98→1 | same | full-screen sheet 300ms |
| List stagger | none (or 20ms, max 6 items, first load only) | 30ms | 30ms, max 8 items |
| Celebration (submit, personal best) | 400–600ms, once | same | up to 800ms + haptic |
| Springs (native-feel only) | none | none | stiffness ≈ 400, damping ≈ 30 (≈ SwiftUI `.snappy`, bounce ≤ 0.15) |

Rules: entrances decelerate and exits accelerate, and exits run at about 70% of the entrance duration. Never animate layout during a test attempt; only the palette state changes, with a 100ms colour fade. With `prefers-reduced-motion` on, every movement becomes a 0–150ms opacity fade (HIG). Each page entrance animation plays once and never replays on back navigation. This matches the latest repo commit ("Play each page entrance once, without an overshoot").

**Responsive navigation [V]:** window classes are compact <600dp, medium 600–839dp and expanded ≥840dp. Android's `NavigationSuiteScaffold` uses a bottom **navigation bar** when compact and a **navigation rail** otherwise, with a permanent drawer optional for expanded windows ([Android adaptive nav](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation), [responsive nav (Views)](https://developer.android.com/develop/ui/views/layout/build-responsive-navigation)). Use 3–5 destinations in a bar and 3–7 in a rail ([SAP Fiori M3 rail](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-rail/usage)). M3 Expressive's expanded rail replaces the drawer ([9to5Google](https://9to5google.com/2025/05/14/material-3-expressive-navigation/)). No hamburger for primary destinations (Unacademy, above).
- **UCI mapping:** phone (<600) gets bottom tabs: **Home (today) / Courses / Tests / Profile**. Tablet (600–1023) gets a rail with the same items plus Notes and Search. Desktop (≥1024) gets a collapsible sidebar with grouped sections, plus the session switcher for admin.

---

## 6. Public coaching-institute landing page

Most of these sources are agency or vendor blogs, so read their numbers as claims ([CodingClave](https://codingclave.com/blog/coaching-institute-website-design-india-2026), [WebSNP](https://www.websnp.com/help/coaching-tuition-center-website-design-nepal), [IRPR](https://irpr.agency/lead-generation-website-for-coaching-classes), [DEV](https://dev.to/delhiwebdesigning/how-coaching-institutes-can-generate-more-student-enquiries-with-a-professional-website-30pk)).
1. **Hero:** state what is taught and for which exam, with a clear outcome. Show two CTAs: *Book free demo / Enquire* (primary) and *WhatsApp us* (secondary). Show the next batch start date ("New JEE batch starts 5 Nov, 18 seats left" only if true).
2. **Results that are honest:** topper cards with photo, name, rank/score, exam and year, plus a **denominator** ("212 appeared, 64 selected"). Group them by year and exam. Inflated, denominator-free claims backfire.
3. **Faculty:** real photos, qualifications, years of experience and subjects/batches taught. Stock photos destroy trust. Parents are buying access to specific teachers.
4. **Courses:** cards with exam, duration, mode (offline/online/hybrid), batch timings, fee (or "from ₹"), and a syllabus PDF.
5. **Trust strip:** Google rating with review count, years running, students taught, affiliations, media mentions.
6. **Free value:** a free mock test with no signup until results. This is the lead magnet and also showcases the test engine.
7. **Contact:** a click-to-call and WhatsApp button that sticks to the bottom on mobile, a map embed and address, timings, and a short enquiry form (name, phone, class/exam) routed to WhatsApp/CRM.
8. **Parents' section:** fee structure, safety, attendance/progress reports, FAQs.
9. **Performance:** most visitors are on mobile, on Indian 4G. Target LCP under 2.5s, ship no heavy carousel, offer Hindi/English if the audience needs it.

---

## 7. Ranked: 25 features that beat competitors on UX

1. **Attempt engine that never freezes:** local-first answers, server-deadline timer, resume on any device (directly beats Testbook's lag complaint).
2. **NTA-faithful palette with colour + shape states** and an explicit "answered + marked is scored" legend.
3. **"Today" home:** next class, due test, continue-lesson, all in one screen (Unacademy Planner, minus the clutter).
4. **No ads, pop-ups or upsell interstitials for enrolled students.** A paying student never sees a sales banner (beats Testbook, PW and Adda).
5. **Deep result analytics:** rank in batch and institute, time per question vs topper, topic heatmap, careless vs unknown.
6. **Solutions review with option-wise % of students** and filters for wrong/skipped/marked.
7. **One-tap "revise mistakes":** auto-generated practice from the student's wrong and bookmarked questions.
8. **Timestamped notes on video** and a single notes review page (Coursera).
9. **Chapter bundle:** lecture + markdown notes + DPP + mini-test in one place (PW model, cleaner).
10. **Khan-style progress:** per lesson, chapter and course, always visible.
11. **Password-protected scheduled test lobby** with live countdown and server time.
12. **Adaptive navigation:** bottom tabs, rail and sidebar, with no hamburger for primary destinations.
13. **Calm, platform-correct motion,** reduced-motion respected, celebrations only for earned moments.
14. **Offline PWA:** cached notes and in-progress attempts, plus an installable app shell.
15. **Academic session switcher and session rollover** for admin.
16. **Question bank with full tagging, usage tracking, dedupe** and a review grid on PDF/CSV import.
17. **Blueprint test builder** (auto-pick by chapter/difficulty, swap one).
18. **Bulk actions with a sticky bar, count confirmation and undo,** plus shareable saved filters.
19. **⌘K command palette** for admins and teachers.
20. **Batch-targeted WhatsApp/push announcements** with templates (test reminders, results out).
21. **Parent view or weekly report** (attendance, test scores) shared over WhatsApp. Coaching parents expect this; generic platforms barely do it.
22. **Free public mock test** as the landing page's lead magnet, with signup only to see the full analysis.
23. **Honest results page** with denominators and verified topper cards.
24. **Bilingual UI and content toggle** (Hindi/English) per question and per note.
25. **Accessibility baseline:** tabular-numeral timer, colour-blind safe states, keyboard-only test attempt (1–4 to pick, M to mark, N for next), screen-reader announcements at time thresholds.

---

## Gaps and caveats
- I found no primary sources for Unacademy, Adda or Testbook navigation tab labels. They are marked [K] and should be checked against current Play Store screenshots.
- The official M3 motion pages are client-rendered. The tokens above come from Google's material-web token file, which carries the same values.
- The complaint data comes from aggregators with small samples. Before prioritising, read 50 recent 1–2-star Play reviews per competitor.
