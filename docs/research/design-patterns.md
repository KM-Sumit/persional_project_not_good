# UCI screen-by-screen design patterns

Researched 2026-10-20. Companion to `competitors.md` (that file holds the competitor teardown, the CBT palette
semantics, motion tokens and the 25-feature list; this file does not repeat them). Here: one concrete layout spec
per screen, then signature details and anti-patterns.

Brand frame used throughout: cool paper background, black ink, orange `#F07D1E` as the only accent (primary action,
current item, progress). Anek Latin/Devanagari for display, Figtree for body, IBM Plex Mono with tabular numerals for
every number (timer, marks, rank, price). OMR bubbles (hollow circle, letter inside, fills solid ink on select) are the
signature answer control and reappear as a motif: palette chips, stepper dots, progress pips.

Conventions in this file:
- **Fold** = what a 360x740 phone (or 1366x768 laptop for staff) shows without scrolling.
- **One action** = the single orange button on the screen. Everything else is secondary (ink outline) or a link.
- Copy is Hindi-first with English in the UI where students actually use English words ("Mock Test", "PYQ", "Rank").
  Devanagari needs about 1.5-1.6 line height for body text because matras sit above and below the line
  ([indiafont tips](https://indiafont.com/blog/indian-typography-tips), [Indic web typography](https://docs.thottingal.in/web-typography));
  never set Devanagari below 14px, and give it 2-4px more size than Latin at the same role.

---

## 0. Local references worth copying

Only one other local project is a real coaching/academy product: **Aawaz Academy** (SvelteKit, same stack family).
`AICTE/mocksphere` holds a single screenshot, `campusprep` is a scraper with no UI, and the rest are unrelated.

| What | Path | Copy for |
|---|---|---|
| Per-section CMS card: draft vs saved baseline, Save/Reset, "saved 2m ago", history, unsaved dot in the side nav | `/Users/divyansh/Desktop/code/aawazacademy/src/lib/components/cms/section-card.svelte`, `cms-state.svelte.ts`, `edit-dialog.svelte`, `item-row.svelte`, `row-controls.svelte` | Staff website editor |
| 412 hard-coded strings moved to 38 typed CMS keys with Zod defaults, so an empty table renders the live site | `/Users/divyansh/Desktop/code/aawazacademy/docs/magnum-opus/aawaz-platform/cms-inventory.md` | Website editor scope: decide the key list up front |
| Lead form: preselect course from URL (`?course=`, `?type=demo`), keeps values on error, WhatsApp fallback link, every label from CMS | `/Users/divyansh/Desktop/code/aawazacademy/src/lib/components/marketing/lead-form.svelte` | Contact/admissions, course page enquiry |
| One ticket table for leads, demo bookings and support (D5); student lifecycle derived in SQL, never stale (D8); walk-in students without accounts | `/Users/divyansh/Desktop/code/aawazacademy/docs/magnum-opus/aawaz-platform/02-decisions.md` | Enquiries inbox, students table status column |
| Marketing blocks: `stat-counter`, `batch-card`, `course-card`, `cta-band`, `youtube-card`, `section-heading` | `/Users/divyansh/Desktop/code/aawazacademy/src/lib/components/marketing/` | Landing, course cards, faculty |
| YouTube URL/ID parsing | `/Users/divyansh/Desktop/code/aawazacademy/src/lib/components/cms/youtube.ts` | Lesson editor, faculty intro video |
| Staff console sections: requests queue, tickets, audit, roles, students | `/Users/divyansh/Desktop/code/aawazacademy/src/routes/admin/` | Staff IA |
| Captured screens at 390 and 1440 (dashboard, register, requests review, batches) | `/Users/divyansh/Desktop/code/aawazacademy/docs/magnum-opus/aawaz-platform/screens/` | Visual reference for phone vs desktop staff layouts |
| AI pane that proposes, then confirms, with undo, and reconciles PDF ingest | `/Users/divyansh/Desktop/code/ruchi-maam/flex-range/` (also the `ai-harness-builder` skill) | AI generate review: propose, review, accept pattern |

---

## 1. Patterns found on the web (the short list that drives the specs)

- **Testbook test-series page** ([testbook.com/ukpsc-ro-aro/test-series](https://testbook.com/ukpsc-ro-aro/test-series)):
  header stats line "102 Total Tests, 3 Free Tests, 29.6k Users, English, Hindi"; a Mock/PYP toggle; filter tabs with
  counts (Live/Free 1, Subject 20, Current Events 22, Full Length 4); each row shows Free tag, title, attempts,
  questions, marks, minutes, languages, "Start Now" and a "Syllabus" link. Upsell is only a "Pro" badge on locked groups.
  Copy: the stats line, the counted tabs, the row anatomy. Skip: the referral cashback box and the 4-tab FAQ wall.
- **Testbook Pass** merged four tiers (Pass, Pro, Pro Max, Elite) into one Pass after customer confusion
  ([G2 pricing](https://www.g2.com/products/testbook-pass/pricing), [Trustpilot](https://www.trustpilot.com/review/testbook.com)).
  Lesson: one pass, one price per validity. Never tier features.
- **Adda247 product page** ([adda247.com/product-testseries](https://www.adda247.com/product-testseries)): plan tabs
  (Online, Offline, Free warm-up, PYQ 2013-2025), test cards with difficulty, Q count, minutes. It showed "Rs 0,
  Currently Not Available" with disabled buttons: a dead page that still ranks. Lesson: an unavailable product shows
  "Next batch on <date>, notify me", never Rs 0.
- **Adda247 release health** ([Quash](https://quashbugs.com/release-health/adda247)): unclosable promo pop-ups that block
  the app "including mid-mock and mid-class"; purchased content not showing; 16% of bug reports are crashes/freezes;
  14% hit payments/login/data. Testbook: 8.7% of reviews describe failure ([Quash Testbook](https://quashbugs.com/release-health/testbook)),
  too many course notifications ([Techjockey](https://www.techjockey.com/reviews/testbook)), lag during mocks
  ([consumercomplaints.in](https://www.consumercomplaints.in/bycompany/testbook-a435121.html)).
- **PW batch page** (web): the batch is the product; the page lists Live lectures, DPP, Tests, Doubt engine, Class notes,
  then Batch schedule and a Notices count; "Request a call back or call us" block before the footer
  ([pw.live batches](https://www.pw.live/nursing/batches/nursing-pro-batch-for-all-nursing-exams-979764),
  [BlueStacks guide](https://www.bluestacks.com/blog/game-guides/pw-jee-neet/pw-beginners-guide-en.html)).
  Complaint: UI changes too often ([G2](https://www.g2.com/products/physicswallah/reviews)).
- **Unacademy rewrite**: five tabs cut to three (Planner, Self-study, Profile), hamburger removed because "the user cannot
  immediately see what it contains" ([The Hard Copy](https://thehardcopy.co/unacademy-rewrites-the-book/)).
- **Duolingo path**: one linear path so the learner never decides what is next; units with a plain-language header;
  a per-unit guidebook in the unit header's corner; a floating arrow that returns you to your spot
  ([Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/)). Backlash came from removing choice
  ([piunikaweb](https://piunikaweb.com/2022/10/13/duolingo-app-update-with-path-ui-faces-backlash-from-users/)):
  so UCI shows a recommended next item but keeps the full outline tappable.
- **Khan Academy mastery squares**: one square per skill coloured by mastery, quiz and unit-test icons inline, tap goes
  straight to the exercise ([Khan support](https://support.khanacademy.org/hc/en-us/articles/18735142028045)).
  Use for course outline progress and for the topic heatmap in results.
- **Coursera course page**: hero with rating, enrolled count, "3 modules, 3 weeks at 10 h/week", one CTA with start date;
  sticky anchor tabs (About, Outcomes, Modules, Testimonials, Reviews); each module shows hours and "what's included"
  counts with an expand toggle ([coursera.org](https://www.coursera.org/learn/machine-learning)).
- **Vedantu course page**: "Select a batch" as the CTA, "Unlimited access till exam date" as the validity line,
  timetable and syllabus inline, toppers as testimonials ([vedantu.com](https://www.vedantu.com/course/neet-crash-course)).
- **Razorpay**: single-page checkout converts about 61% vs 56% multi-page; UPI first with apps ordered by success rate
  (GPay, PhonePe, Paytm, BHIM) on mobile, QR on desktop; fire the intent only on tap; show a cancellable waiting state
  ([checkout guide](https://razorpay.com/blog/high-converting-checkout-experience-guide/),
  [UPI intent docs](https://razorpay.com/docs/payments/payment-methods/upi/upi-intent)).
- **Bulk actions**: confirm with the exact count only for destructive actions; reversible ones run at once with an undo
  toast; "select all" must say whether it means this page or all N matching the filter; never lose selection on scroll
  ([saasui.design](https://saasui.design/blog/saas-bulk-actions-ux-patterns), [UX Movement](https://uxmovement.substack.com/p/a-better-ux-approach-to-bulk-actions)).
  Saved views only on tables with real configuration; persist the chosen view
  ([Basis saved views](https://design.basis.com/patterns/saved-views), [AppMaster](https://appmaster.io/blog/saved-views-admin-tables)).
- **Result screens**: score banner first, then per-question review with the correct option and the user's wrong option
  marked ([screensdesign quiz results](https://screensdesign.com/explore/screens/quiz-results/)).
- **Low-end phones and patchy data** were Testbook's original design constraint (built for 2G)
  ([YourStory](https://yourstory.com/2016/02/app-fridays-testbook/)). Still true in MP districts.

---

## 2. Global shell

**Phone (student):** bottom bar with 4 tabs: आज (Today) · पढ़ाई (Learn) · टेस्ट (Tests) · मैं (Me). Inbox is a bell in the
top bar with an unread count, not a tab. No hamburger for primary destinations. The bar hides during the exam attempt
and the lesson player in landscape.
**Desktop (student):** left rail (icons + labels, 72px) with the same 4 items, top bar with exam switcher chip
("SSC CGL 2026"), search, bell, avatar.
**Phone (public):** top bar logo + "लॉग इन" + a menu sheet (public site is allowed a menu; it is a brochure). Sticky
bottom CTA strip on sales pages only.
**Staff desktop:** collapsible sidebar grouped (Overview · Teaching: Courses, Notes, Question bank, Tests ·
People: Students, Batches · Reach: Announcements, Enquiries, Website · Money: Payments), a session switcher at the top
of the sidebar ("सत्र 2026-27 v"), Cmd+K palette, avatar. **Staff phone:** bottom bar Home · Tests · Students · More
(sheet); tables become stacked cards with the 2 most important fields and a chevron.

Loading everywhere: skeletons that match the final layout (never a centred spinner), shown only after 150ms.
Errors: inline banner with retry, data you already had stays on screen.

---

## 3. Public website

### 3.1 Landing `/`
**One action:** "फ्री मॉक टेस्ट दें" (Take a free mock). Secondary: "कोर्स देखें", WhatsApp.

Phone section order:
1. Top bar: logo, "लॉग इन".
2. **Hero (fold):** eyebrow "मध्य प्रदेश का भरोसेमंद कोचिंग संस्थान"; headline in Anek Devanagari 32/36
   "Dream. Prepare. Achieve." with the Hindi line under it; one sentence on what UCI does (SSC, Railway, MPPSC, MP Police);
   the orange button; under it a proof row in mono: "1,240 चयन · 12 साल · 4.8 Google" (real numbers, each tappable to
   its source: results page, about, Google profile). An exam chip row (SSC · Railway · MPPSC · MP Police · Patwari)
   scrolls horizontally just above the fold edge so the next section is visibly there.
3. **Live/upcoming strip:** next free live test with countdown ("रविवार 10:00 AM · 1,020 पंजीकृत") and "रजिस्टर करें".
4. **Exams grid:** 2-column cards per category with exam count; tap goes to the category page.
5. **Toppers carousel:** verified selection cards (photo, name, post, exam year, roll-number-masked proof link).
6. **Courses:** 3 best-selling course cards (cover, exam tag, language, lessons/tests counts, price with strike-through
   only when a real discount exists, "Next batch 5 Nov").
7. **Why UCI:** 3 points max with numbers (offline + online, bilingual tests, doubt support hours).
8. **Faculty preview:** 4 faces, subject, years, "सभी शिक्षक".
9. **App/PWA install band** (only if not installed).
10. **Visit us:** address, map static image, timings, call and WhatsApp buttons.
11. Footer: exams, courses, legal, social.

Desktop: hero is 2 columns (copy left, a real photo of the classroom or a phone mock showing a result screen right);
exams grid 4 columns; toppers as a row of 5; the rest 3 columns.
Empty state (no toppers yet): hide the section; never show placeholders. Loading: static SSR, nothing to load.

### 3.2 Exams browse: category `/exams/[category]` then exam `/exams/[category]/[exam]`
**Category page one action:** pick an exam. Fold: title "SSC परीक्षाएँ", one line description, list of exam rows
(CGL, CHSL, MTS, GD, Steno) each with "12 टेस्ट · 3 कोर्स · अगली परीक्षा मार्च 2027". Desktop: rows become a 3-col grid
with a left filter column (category list) that stays visible.
**Exam page one action:** "फ्री टेस्ट दें" (or "सीरीज़ अनलॉक करें" if the student is signed in and has used the free ones).
Section order: exam header (name, conducting body, next exam date, vacancies if known, language chip); counted tabs
like Testbook: Full mocks (n) · Sectional (n) · Chapter (n) · PYQ (n) · Live (n); test rows (title, Q, marks, minutes,
languages, attempts in mono, Free badge or lock icon, "Start"); then courses for this exam; then an "About the exam"
block (pattern table: sections, Q, marks, negative marking, time) which doubles as SEO; FAQ (5 questions max).
Phone: the counted tabs become a horizontal chip scroller pinned under the header.
Empty: "इस परीक्षा के टेस्ट जल्द आ रहे हैं" + "सूचना पाएँ" (notify me, WhatsApp opt-in).

### 3.3 Course detail (sales page) `/courses/[slug]`
**One action:** "अभी जुड़ें Rs 1,499" (or "फ्री डेमो देखें" first if the course has a free lesson and the user is new).
Fold (phone): cover image 16:9 with play icon if there is a free intro video; title; exam tags; meta row in mono
"86 लेक्चर · 40 टेस्ट · PDF नोट्स · हिंदी"; batch start and validity "शुरू 5 नवंबर · परीक्षा तक एक्सेस"; price with
real discount and the date it ends; the orange button. Sticky bottom bar after the hero scrolls away: price + button.
Then (Coursera-style anchor tabs on desktop: About · Syllabus · Faculty · Results · FAQ):
1. What you get (icon list, max 6, each with a count).
2. Syllabus: subjects, then chapters, each with lecture count and hours; first chapter expanded; free items marked
   "फ्री" and playable without paying.
3. Schedule (for live batches): week grid or "हर दिन 7-9 AM".
4. Faculty: cards with photo, subject, years, YouTube intro.
5. Results from this course: 3 verified selections.
6. Reviews: rating breakdown + 3 written reviews with name and city.
7. FAQ: validity, refund, device limits, offline centre access.
8. "सवाल है? कॉल बैक पाएँ" lead form (Aawaz lead-form pattern, course preselected).
Desktop: 2 columns, left content, right sticky purchase card (price, what's included summary, button, "7 दिन रिफंड"
if the policy allows, Razorpay/UPI marks).
Owned state: if the user already bought it, the page swaps the purchase card for "पढ़ाई जारी रखें" and never shows a price.
Sold out/closed: "अगला बैच 1 जनवरी, सूचना पाएँ". Never Rs 0 with disabled buttons (Adda's dead page).

### 3.4 Results / toppers `/results`
**One action:** none primary; the page is proof. Bottom CTA "आप भी तैयारी शुरू करें".
Fold: headline with one honest number and its denominator: "2025 में 214 चयन (1,830 छात्रों में से)"; filter chips:
year, exam. Grid of topper cards: photo, name, post ("Constable, MP Police"), exam + year, district, a "सत्यापित" tick
that opens the proof (selection list PDF/link with roll number partly masked). Desktop 4 columns, phone 2.
Featured row at top: 3 video testimonials (YouTube, lite embed, poster image until tapped).
Empty filter result: "इस साल के परिणाम अभी अपडेट हो रहे हैं".

### 3.5 Faculty `/faculty`
Grid of faculty cards (photo on paper background, name in Anek, subject, years teaching, exams taught, one line quote).
Tap opens a sheet/page: intro video, courses they teach, YouTube playlist link. Fold on phone: title + first 4 cards.
One action per profile: "इनका कोर्स देखें".

### 3.6 Contact / admissions `/contact`
**One action:** "कॉल बैक पाएँ" (submit enquiry). Fold (phone): 3 big contact buttons (Call, WhatsApp, Directions),
then the form: name, phone (10-digit with +91 fixed), exam interest (chips, not a dropdown), mode (Offline/Online),
optional message. No email field required. Success state replaces the form: "धन्यवाद! हम 2 घंटे में कॉल करेंगे
(सुबह 9 से शाम 7)" + a WhatsApp button prefilled with their exam. Below: address, map, timings, fee-office hours,
admission documents checklist. Desktop: form left, map/address right.
Rate-limit and honeypot silently; on error keep the values (Aawaz lead-form).

### 3.7 Pricing / test-series pass `/pass`
**One action:** "पास लें Rs 499" on the recommended validity.
Fold: headline "एक पास, सभी टेस्ट"; what's inside in mono counts tied to the student's exam if known ("SSC: 340 मॉक ·
1,200 PYQ · हर रविवार लाइव टेस्ट"); validity selector as 3 OMR-style options (3, 6, 12 months) showing total and
per-month price in mono, recommended one pre-selected; the button. Below: free vs pass comparison table (only 6 rows);
"किन परीक्षाओं के लिए" list; sample analysis screenshot; FAQ (validity, multiple devices, refund).
One pass only, no feature tiers (Testbook merged its four). Signed-in owners see "आपका पास 12 मार्च तक" and a
renew button only within 15 days of expiry.

---

## 4. Student app

### 4.1 Today `/app`
**One action:** the single "next thing" card's button (resume test, join live test, continue lesson).
Fold (phone):
1. Greeting row: "नमस्ते, अंकित" + exam chip (switch exam) + bell.
2. **Next-thing card** (orange edge): priority order: (a) live test starting within 2 h with countdown and
   "लॉबी में जाएँ", (b) an unfinished attempt "टेस्ट जारी रखें · 34 मिनट बचे", (c) continue lesson with progress bar and
   thumbnail, (d) today's recommended practice. Exactly one of these.
3. Streak/consistency strip: 7 OMR dots for the week, filled for days studied; no shaming copy for misses.
Below fold: "आज के टेस्ट" (scheduled today), "इस हफ्ते" (upcoming 3), last result summary card (score, rank, "विश्लेषण
देखें"), "गलतियाँ दोहराएँ" (revise mistakes, count of wrong+bookmarked questions), announcements (latest 2, pinned first).
Desktop: 2 columns: left the next-thing card and lists, right a calendar of the week and the last result.
Empty (new student): a 3-step checklist "परीक्षा चुनें · पहला फ्री टेस्ट दें · कोर्स देखें", each an OMR bubble that
fills when done. Loading: skeleton of the next-thing card only; lists stream in.

### 4.2 Learn `/app/learn`
Two segments at top: "मेरे कोर्स" · "सभी कोर्स".
My courses: each card shows cover, title, progress bar with "42/86", last lesson title, "जारी रखें". Sorted by last opened.
Catalog: exam filter chips, then course cards (same anatomy as public, price or "खरीदा हुआ").
Desktop: grid 3 columns; My courses as a wide "continue" row on top.
Empty my courses: "अभी कोई कोर्स नहीं" + two free lessons to try + "कोर्स देखें".
One action: "जारी रखें" on the most recent course.

### 4.3 Course outline `/app/learn/[slug]`
Header: title, overall progress ring in mono %, "अगला: Ch 4 · L2 Percentage basics" button (the one action).
Subjects as tabs (Quant · Reasoning · GK · English). Chapters as an accordion; each chapter row shows Khan-style
squares (one per lesson: empty, half (started), filled ink (done)), a lightning icon for the chapter test, and
counts. Lesson rows: number in mono, title, duration, notes icon if notes exist, lock if not purchased and not free.
The current chapter is expanded and scrolled into view; a floating "मेरी जगह" pill returns to it (Duolingo arrow).
Desktop: left column the outline, right a sticky panel: progress by subject, next live class, downloads (notes PDFs).
Empty course (no lessons yet): "पहला लेक्चर 5 नवंबर को आएगा" with a notify toggle.

### 4.4 Lesson player `/app/learn/[slug]/[lessonId]`
Phone (portrait):
1. YouTube player 16:9 pinned at top (privacy-enhanced embed, poster first, loads on tap; speed control).
2. Title, chapter, "पूरा हुआ" toggle (auto-marks at 90% watched).
3. Tabs under the video: नोट्स · सामग्री (PDFs, DPP) · मेरे नोट्स (timestamped notes: "+ नोट 12:34").
4. Sticky bottom: "अगला लेक्चर" with next title (the one action), and a previous arrow.
Desktop: video 8/12 width with notes below, right column 4/12 = chapter playlist with the current item highlighted
in orange and done items checked; the next button sits under the video.
Landscape phone: video full-screen, nav hidden.
States: video unavailable (YouTube removed) shows "वीडियो उपलब्ध नहीं, शिक्षक को सूचित किया गया" and keeps notes usable.
Locked lesson: blurred poster + price + "अनलॉक करें" (only paywall surface inside the app, and only when tapped).
Completion of the last lesson in a chapter: a quiet card "अध्याय पूरा! चैप्टर टेस्ट दें" (earned moment, small motion).

### 4.5 Notes reader `/app/notes/[slug]`
Reading width 65ch, Figtree 17/28 for Latin, Devanagari 18/29. Top bar: back, title (truncates), "Aa" (text size 3
steps, language toggle if bilingual), bookmark. Auto table of contents as a sheet on phone, sticky left column on
desktop. Formulas and tables scroll horizontally inside their block, never the page. End of note: "इस विषय पर
10 प्रश्न का अभ्यास" button (the one action) and the next note. Remember scroll position. Offline: cached notes open
with a small "ऑफ़लाइन" tag. Loading: text skeleton lines.

### 4.6 Tests hub `/app/tests`
Top: exam chip + search. Then segments: लाइव · सीरीज़ · अभ्यास · PYQ (counted, Testbook-style).
- **Live:** "अभी चल रहा" (red dot, join), "आने वाले" with date, time, countdown, registered count, password lock icon;
  "पिछले" with your rank if attempted.
- **Series:** cards per test series with progress "12/40 दिए", next test title, avg score.
- **Practice:** by subject, then chapter, then quick sets (10/20/30 Q), plus "गलतियाँ दोहराएँ".
- **PYQ:** by exam then year then shift; each row shows Q, minutes, "हिंदी/English".
Row anatomy everywhere: title, meta in mono (Q · marks · min), status pill (New, In progress with time left,
Attempted with score, Locked), and one trailing button.
Desktop: left filter column (exam, type, status, language), list in the middle, right column "Upcoming live" calendar.
One action: the top live test's button, else the first in-progress attempt.
Empty: per segment ("इस हफ्ते कोई लाइव टेस्ट नहीं, अभ्यास सेट आज़माएँ").

### 4.7 Test instructions `/app/tests/[id]`
Fold: title, exam, then a 4-cell stat grid in mono: प्रश्न 100 · अंक 200 · समय 60 मिनट · निगेटिव -0.5.
Language picker (हिंदी / English) as two OMR bubbles; default from profile.
Collapsible instructions (default collapsed after the first attempt), with the palette legend previewed exactly as in
the exam. Section list with per-section counts and timers if any.
For scheduled/live tests: lobby with server-time countdown, password field that activates only inside the window,
"5 गलत प्रयासों के बाद 15 मिनट रुकें" stated up front.
Checkbox "मैंने निर्देश पढ़ लिए हैं", then the one action "टेस्ट शुरू करें" (disabled until checked and window open).
Below: your previous attempts (date, score, rank, "विश्लेषण").
Device warning on phones under 360px width: "बेहतर अनुभव के लिए फ़ोन घुमाएँ" (rotate), dismissible.

### 4.8 Exam attempt `/app/tests/[id]/attempt/[attemptId]` (full screen, no app chrome)
Semantics follow the NTA/TCS CBT conventions in `competitors.md` section 2.

**Phone:**
- Top bar (48px): section dropdown ("Quant 12/25"), timer in Plex Mono with tabular numerals (turns orange at 5 min,
  red + one gentle haptic at 1 min), "Q 12/100" chip that opens the palette bottom sheet, save status dot.
- Body: question number + marks (+2/-0.5) in mono, language toggle icon, question text (zoomable images, tables scroll
  in place), then 4 OMR options as full-width rows: bubble with the letter, option text; selected = bubble filled ink
  and row tinted. Tap again to clear is not allowed (accidental); use "Clear".
- Sticky footer: "रिव्यू + अगला" (outline), "Clear" (text), "सेव + अगला" (orange, the one action).
- Swipe left/right = next/previous (with 24px dead zone so scrolling is not hijacked).
- Palette sheet: counts per state at top, legend always visible, grid of numbered chips by section, "सबमिट" at bottom.
**Desktop:**
- Header: logo, test title, section tabs with counts, timer at right, candidate name/photo (CBT familiarity).
- Left 70%: question; right 30%: sticky palette with legend and counts, and Submit at its bottom.
- Footer bar: Mark for review & next · Clear · Save & next. Keys: 1-4 select, M mark, N/arrow next, P previous.
**Behaviour:** answers save locally at once and sync in the background; offline banner "ऑफ़लाइन, 3 उत्तर सुरक्षित,
नेट आते ही भेजेंगे"; reload/resume lands on the same question; timer from server deadline; no pop-ups, no
notifications, no upsell, ever. Submit opens a summary sheet by section (answered / not answered / marked / not visited)
with "वापस जाएँ" and "सबमिट करें"; auto-submit at 0:00.

### 4.9 Result, analysis, solutions, rank `/app/results/[attemptId]`
Fold (phone): score card: "142.5 / 200" in big mono, rank "#37 / 1,204" and percentile "96.9", accuracy %, time
used; a one-line verdict in plain Hindi ("Quant में सबसे ज़्यादा अंक कटे: 8 गलत"). One action: "हल देखें"
(view solutions), secondary "दोबारा दें" (if allowed) and share (image card for WhatsApp).
Tabs: सारांश · विश्लेषण · हल · रैंक.
- **Summary:** attempted / correct / wrong / skipped as a 4-segment bar; section table (score, accuracy, time, cutoff
  if known); comparison with your last attempt (+/- in mono).
- **Analysis:** topic heatmap (Khan squares: green strong, amber shaky, red weak) with "इस टॉपिक का अभ्यास" per row;
  time per question strip vs topper and average; "जल्दबाज़ी की गलतियाँ" (wrong under 20s) vs "नहीं आता था".
- **Solutions:** filter chips (सभी · गलत · छोड़े · मार्क किए) with counts; per question: your bubble, correct bubble,
  option-wise % of students who picked each, explanation, bookmark, "रिपोर्ट करें" (wrong question).
- **Rank:** top 10 table (name masked to first name + city), your row pinned, distribution histogram with your marker.
Desktop: score card and analysis side by side; solutions as list + detail split.
Live test before result time: "परिणाम 6 बजे जारी होगा" with countdown; your raw attempt summary is still visible.
Celebrate only real achievements (personal best, top 10) with one short confetti-free motion: the rank number counts up.

### 4.10 Inbox `/app/inbox`
List of announcements and notifications, newest first, unread with a left orange bar. Types with icon: Test
(scheduled, result out), Class, Fee/Payment, General. Pinned items at top. Tap opens detail with the action button
("टेस्ट देखें"). Mark all read in the header. Empty: "कोई नई सूचना नहीं". No marketing messages for paid students.

### 4.11 Profile and history `/app/me`, `/app/me/history`
Header: avatar, name, exam(s), batch, phone. Cards: "मेरा पास / मेरे कोर्स" with validity dates; "टेस्ट इतिहास"
(last 5 with score and rank, "सभी देखें"); stats (tests taken, avg accuracy, study days); settings: language (हिंदी /
English), text size, notifications per type, install app, logout; legal links; support WhatsApp.
History page: filter chips (type, month), rows with date, test, score, rank, link to result. Payments history with
invoice download lives here too.

### 4.12 Checkout / paywall `/app/checkout/[product]`
Single page (Razorpay: single-page converts better). Phone order: product summary (title, validity "12 मार्च 2027 तक",
what's included in 3 lines); coupon field collapsed behind "कूपन है?"; price breakdown in mono (price, discount, GST if
applicable, total); the one action "Rs 499 का भुगतान करें"; under it UPI/card/netbanking marks and "Razorpay द्वारा
सुरक्षित भुगतान". Razorpay Checkout opens with UPI first.
After pay: a waiting state with "भुगतान की पुष्टि हो रही है" and a cancel link; success page "आपका पास चालू है" with
the next step button (start first test / first lesson) and invoice link. Failure: plain reason + "फिर से कोशिश करें"
+ WhatsApp support with the order id prefilled. Webhook makes access idempotent so a closed tab still unlocks.
Paywall entry points: only when a student taps a locked item. Show the specific benefit ("ये टेस्ट + 339 और"), never a
full-screen interstitial on app open.

---

## 5. Staff console (desktop-first, phone usable)

### 5.1 Dashboard `/admin`
Fold (1366x768): session switcher in the sidebar; a row of 4 KPI tiles in mono (Active students this week, Tests live
today, New enquiries (unanswered), Revenue this month), each clickable into its filtered table.
Then "आज" agenda: tests scheduled today with status (draft/ready/live/finished, registered count) and quick actions
(copy password, view live attempts); "ध्यान दें" list: tests without questions, results unpublished, enquiries older
than 24 h, failed payments, AI jobs ready for review. Right column: recent activity (audit feed).
One action: "+ नया टेस्ट". Phone: KPI tiles 2x2, agenda as cards, the rest under "More".
Empty (fresh install): setup checklist (add exam categories, first course, first test, website contact info).

### 5.2 Tests list at scale `/admin/tests`
Header: title, session switcher echoed as a chip, "+ नया टेस्ट" (one action), Cmd+K hint.
Toolbar: search (title/code), saved views tabs (Upcoming · Live now · Drafts · Finished · Archived, each counted),
filter button (exam, kind: mock/live/practice/PYQ, batch, created by, date range), sort.
Table columns: checkbox, title + code, kind pill, exam, batch, window (start-end in mono), Q count, status, attempts,
avg score, row menu (edit, duplicate, results, copy password, archive).
Keyset pagination with "1-50 of 1,284" and page-size; selection banner "50 चुने · सभी 1,284 चुनें जो फ़िल्टर से
मेल खाते हैं" (explicit scope).
Bulk sticky bar (bottom): Publish, Unpublish, Move to batch, Archive (reversible, undo toast), Delete (confirm with
exact count, type-to-confirm above 20).
Phone: cards with title, status, window, attempts; filters in a sheet; long-press to select.
Empty view: "इस सत्र में कोई टेस्ट नहीं" + "पिछले सत्र से कॉपी करें" + "+ नया टेस्ट".

### 5.3 Test builder wizard `/admin/tests/new`
Stepper with OMR dots: 1 Basics (title, exam, kind, language, duration, marks, negative) · 2 Questions · 3 Schedule &
access (window, batches, password, attempts, show solutions when) · 4 Review & publish.
Step 2 offers three sources as cards: "प्रश्न बैंक से चुनें" (blueprint: rows of module, count, difficulty mix;
live total; "random fill" then swap individual items), "PDF से AI बनाएँ", "CSV/JSON इंपोर्ट". Right preview pane shows
the test as a student will see it (phone frame toggle).
Every step autosaves as draft; the stepper allows jumping back; validation errors listed on step 4 with links.
One action per step: "आगे"; on step 4 "पब्लिश करें" (or "ड्राफ्ट रखें"). Publishing a live test shows the password
once with copy and "WhatsApp पर भेजें".

### 5.4 Question bank `/admin/bank`, `/admin/bank/[moduleId]`
Left: module tree (exam > subject > chapter) with counts. Middle: question list rows (first line of text, difficulty
dot, type, language flags, used-in count, last edited). Right: detail/editor of the selected question (text with
preview, 4 options with the correct one as a filled OMR bubble, explanation, tags, difficulty, Hindi/English tabs).
Toolbar: search, filters (difficulty, tag, unused, duplicates flagged, language missing), bulk tag/move/delete.
Duplicate warning inline when the fingerprint matches ("मिलता-जुलता प्रश्न 3 मॉड्यूल में").
One action: "+ प्रश्न". Phone: tree as a chip breadcrumb, list, full-screen editor.
Empty module: "कोई प्रश्न नहीं" + Add, Import, Generate with AI.

### 5.5 AI generate review `/admin/bank/generate/[jobId]`
Job header: source (PDF name, pages used), model, status with progress (pages read, questions drafted), cost/tokens.
While running: questions stream into the list as skeletons turning into cards.
Review grid: each card shows question, options with the proposed correct answer, explanation, difficulty, confidence
flag, duplicate flag, page reference ("पृष्ठ 14"); actions per card: Accept, Edit, Reject (keyboard: A / E / R, J/K to
move). Top filters: All · Flagged · Duplicates · Accepted · Rejected with counts.
Sticky footer: "38 स्वीकार · 4 अस्वीकार · 6 बाकी" and the one action "चुने हुए मॉड्यूल में जोड़ें" with a module
picker. Nothing reaches the bank without a human accept (propose, review, confirm pattern from flex-range).
Failure: show which pages failed and "इन्हें दोबारा चलाएँ"; already-drafted questions stay.

### 5.6 Test results `/admin/tests/[id]/results`
Header stats in mono: attempted / registered, avg, highest, median, pass mark if any. Actions: "परिणाम जारी करें"
(the one action when unpublished), Export CSV, Share to WhatsApp (rank list image).
Tabs: Students (table: rank, name, batch, score, accuracy, time, submitted at, flags such as auto-submitted or
tab-switch count; click opens their attempt) · Questions (per question: % correct, option distribution bars,
discrimination; flag for review; "उत्तर बदलें और पुनः अंक दें" regrade with confirmation) · Sections.
Live test in progress: live counter "312 दे रहे हैं · 48 सबमिट", auto-refreshing.

### 5.7 Students table `/admin/students`
Toolbar: search (name, phone, roll), saved views (All · Active · New this week · Paid · Inactive 14 days · Leads),
filters (batch, exam, course/pass owned, status, joined date). Columns: name + phone, batch, exam, status (derived:
lead / trial / active / paused / alumni, Aawaz D8 pattern), pass/courses, last active, avg score, tests taken.
Bulk: add to batch, send announcement, export, suspend. Row opens a detail page: header (contact, WhatsApp, status),
tabs Overview (activity sparkline, recent results), Tests, Courses & payments, Notes (staff-only dated notes), Audit.
One action: "+ छात्र जोड़ें" (walk-ins without accounts allowed).

### 5.8 Batches / sessions `/admin/batches`
Session switcher governs the whole console; a "सत्र प्रबंधन" page creates the next session and offers rollover
(copy batches, tests as drafts, courses stay).
Batches list: cards or table with name, exam, timing, mode (offline/online), student count, teacher, start date.
Batch detail: students (add by search/paste phone numbers/CSV), schedule, tests assigned, announcements sent.
One action: "+ नया बैच". Empty: "इस सत्र में कोई बैच नहीं" + "पिछले सत्र से कॉपी करें".

### 5.9 Announcements `/admin/announcements`
Composer first (fold): audience picker (All · Batches · Exam · Course owners · Individuals) showing the live recipient
count; templates (Test scheduled, Result out, Class cancelled, Fee reminder) that fill fields; title, body (Hindi
keyboard friendly), optional link to a test/lesson; channels (In-app always, Push, WhatsApp share link); pin toggle;
schedule. Preview as phone notification and inbox card. One action: "भेजें (1,204 छात्र)".
Below: sent list with read % in mono and resend to unread.

### 5.10 Website editor `/admin/site`
Aawaz pattern: left nav of page sections (Hero, Exams, Toppers, Courses on home, Why UCI, Faculty, Contact, Footer,
SEO, Legal) with unsaved dots; each section a card with typed fields, Save and Reset, "saved 2 मिनट पहले by Sumit",
history. Right: live preview iframe of the public page at phone width with a desktop toggle, scrolled to the section.
Lists (toppers, faculty, banners) use drag handles and per-row enable switches. Images upload with crop to the ratio
the slot needs. One action per section: "सेव करें". Leaving with unsaved changes asks.

### 5.11 Enquiries `/admin/leads`
Inbox layout: saved views (New · Called · Follow-up today · Converted · Lost) counted; list rows with name, phone,
exam interest, source (website form, course page, WhatsApp, walk-in), age ("3 घंटे"), assigned to. Selected lead
panel: one-tap Call and WhatsApp (prefilled message with their exam), status buttons, follow-up date, notes timeline,
"छात्र बनाएँ" (convert, the one action). SLA highlight: older than 24 h unanswered turns amber.
Phone: the list with swipe actions (Called, Follow-up).

### 5.12 Payments / orders `/admin/payments`
KPI row: today, this month, refunds, failed (mono). Table: order id, student, product, amount, method (UPI/card),
status (paid / pending / failed / refunded), Razorpay id (copy), date. Filters: status, product, date, method.
Row detail: timeline of webhook events, access granted (link to student), invoice, "रिफंड करें" (confirm with amount),
"एक्सेस दोबारा दें" for stuck orders (purchased-but-not-visible is Adda's critical bug; give staff a one-click fix).
Export CSV for the accountant. Empty: "अभी कोई भुगतान नहीं".

---

## 6. Fifteen signature details that make it feel premium

1. **The OMR bubble everywhere:** answer options fill like a pencil mark (a 120ms ink fill from the centre), and the same
   bubble is the stepper, the streak dot and the validity picker. One memorable shape, used consistently.
2. **Numbers in Plex Mono with tabular figures** (timer, rank, price, counts), so nothing jitters and every number looks
   official, like an admit card.
3. **"Saved" you can trust:** a tiny tick next to the timer after each answer, and "ऑफ़लाइन, 3 उत्तर सुरक्षित" when the
   network drops. Students fear losing answers more than anything else.
4. **Server-time countdown in the lobby** with the server clock shown ("सर्वर समय 09:58:12"), so nobody argues about
   the start.
5. **Rank that counts up once** on the result screen, then stays still. One earned moment, not confetti.
6. **Plain-Hindi verdict line** on every result ("Reasoning में समय ज़्यादा लगा: 1.4 मिनट/प्रश्न") instead of a chart only.
7. **WhatsApp-native sharing:** result card image, test password message, enquiry follow-ups, all prefilled. This is how
   MP students and parents actually communicate.
8. **Verified topper cards** with a proof link and a denominator on every results claim. Honest numbers read as premium.
9. **No interruptions for paying students:** no pop-ups, no upsell banners, no promo notifications. Silence is the
   premium feature.
10. **Bilingual toggle per question and per note** that remembers the choice, with Devanagari set at the right size and
    line height rather than squeezed into Latin metrics.
11. **"मेरी जगह" pill** that returns you to your current lesson in a long outline (Duolingo's floating arrow).
12. **Skeletons that match the final layout** and appear only after 150ms, so fast loads look instant and slow ones look
    intentional.
13. **Real faces:** faculty and classroom photos on the paper background instead of stock 3D illustrations.
14. **Keyboard-complete staff console:** Cmd+K, J/K through review queues, A/E/R in AI review, undo toasts on every
    reversible action.
15. **Receipts and dates in every money surface:** "पास 12 मार्च 2027 तक", invoice download, order id on the support
    WhatsApp message. Clarity about what you paid for builds trust.

## 7. Ten anti-patterns users hate in PW, Testbook and Adda247

1. **Unclosable promo pop-ups, even mid-mock or mid-class** (Adda247, [Quash](https://quashbugs.com/release-health/adda247);
   Testbook on app open, [G2](https://www.g2.com/products/testbook-pass/reviews)).
2. **Freezes and lag during a mock**, the worst possible moment (Testbook, [consumercomplaints.in](https://www.consumercomplaints.in/bycompany/testbook-a435121.html);
   8.7% of reviews describe failure, [Quash](https://quashbugs.com/release-health/testbook)).
3. **Paid content not showing after purchase** (Adda247 critical theme, [Quash](https://quashbugs.com/release-health/adda247);
   PW paid lectures not loading, [Voxya](https://voxya.com/consumer-complaints/facing-problem-to-completely-access-to-my-paid-prayas-batch/167440)).
4. **Plan confusion and features moved between tiers** after purchase (Testbook Pass, Pro, Pro Max, Elite,
   [Trustpilot](https://www.trustpilot.com/review/testbook.com)).
5. **Notification spam about new courses** ([Techjockey](https://www.techjockey.com/reviews/testbook); Adda247
   notifications disrupting study, [Kimola](https://kimola.com/reports/unlock-insights-adda247-app-review-analysis-report-google-play-en-141543)).
6. **Constant UI churn and forced updates** that move things students had memorised (PW, [G2](https://www.g2.com/products/physicswallah/reviews)).
7. **Dead product pages** showing Rs 0 and "Currently Not Available" with disabled buttons ([Adda247](https://www.adda247.com/product-testseries)).
8. **Single-device lockouts** with no self-serve fix ("account active on another device", [consumercomplaints.in](https://www.consumercomplaints.in/bycompany/testbook-a435121.html)).
9. **Refund walls and unresponsive post-purchase support** ([Trustpilot](https://www.trustpilot.com/review/testbook.com),
   [Kimola Adda247](https://kimola.com/reports/unlock-insights-adda247-app-review-analysis-report-google-play-en-141543)).
10. **Community and features that bounce to external pages, or differ by platform** (PW bookmarks on Android but not iOS,
    [JustUseApp](https://justuseapp.com/en/app/1641443555/physics-wallah/contact); community opening external pages, [G2](https://www.g2.com/products/physicswallah/reviews)).

## Gaps

- Mobbin and Dribbble are not indexed by search; no first-party screens were captured from them. The only relevant
  Dribbble hit was OyeExams (question filters, [dribbble.com/shabcreation](https://dribbble.com/shabcreation/shots)).
- pw.live blocked direct fetch; its batch page structure comes from search snippets and the BlueStacks guide.
- Complaint percentages are third-party aggregators (Quash, Kimola) with sampled reviews; treat them as directional.
