# rgpv-live: Razorpay + exam-wise browsing (research for UCI)

Sources (read-only): `/Users/divyansh/Desktop/code/rgpv-live` (prod site "CampusPrep") and the second Razorpay
reference `/Users/divyansh/Desktop/code/campusquiz-svelte`. No secret values were copied.

**Bottom line:** rgpv-live is the product model to copy: an exam-scoped pass whose validity ends on the exam date, a
locked-content page that shows a teaser, and SEO pages for every branch, semester and subject. Its payment code is the
weaker of the two references: it has no webhook and no idempotency, and its coupon flow is broken. Port the payment
code from campusquiz-svelte (SvelteKit + Drizzle, the same stack as UCI) and keep rgpv-live's product shape.

---

## 1. Stack

- **Django 5 (Python, `uv`)** project: `manage.py`, `config/settings.py`, `config/urls.py`, apps under `apps/*`
  (`academics`, `content`, `products`, `users`, `practice`, `assistant`, ...). Server-rendered Django templates in
  `templates/**` with Tailwind 3 (`tailwind.config.cjs`, `static/css/src/site.css`) and plain JS in `static/js/*.js`.
- Celery (`config/celery.py`), Redis cache, Postgres/SQLite (`db.sqlite3` locally), allauth (Google), webpush, Prometheus.
- `package.json` names a half-started Next.js 15 + Drizzle rewrite ("rgpv-live-modern"), but **there is no `src/`**.
  Everything below is Django.
- Razorpay goes through the official Python SDK: `import razorpay; client = razorpay.Client(auth=(KEY_ID, KEY_SECRET))`
  (`apps/products/views.py:13-16`).

campusquiz-svelte: SvelteKit 2 + Svelte 5 + Bun + Drizzle/Postgres. It calls Razorpay over plain REST with no SDK
(`src/lib/server/razorpay.ts`). This is the code to port.

---

## 2. Razorpay end to end

### 2.1 What is sold (rgpv-live)

| Product | Model | Scope | Price source |
|---|---|---|---|
| **Gold Pass** (main product) | `SubscriptionPlan` with `plan_type='SEMESTER'` (`apps/products/models.py:26`) | one **branch + semester** | `plan.price` |
| **Single premium document** | `ParsedDocument.is_premium` + `.price` (content app) | one PDF/notes doc | `document.price` |
| `Product` / `ProductCategory` (per-subject bundles) | `models.py:6-24` | per subject | defined but **no checkout view uses it** (dead code) |
| Coupons | `Coupon(code, discount_percentage, max_uses, current_uses)` | any | — |

Plan types `FREE | SEMESTER | MONTHLY | YEARLY` exist, but only SEMESTER can be bought (`get_active_semester_plan`).
Features are gated through `PlanEntitlement(plan, feature_key, value_type bool|int, bool_value, int_value)`, which has
namespaced keys such as `content.notes`, `content.pyq`, `practice.question_sets`, `ai.daily_messages` and
`storage.notes_mb` (`models.py:132-197`). Changing a limit means editing a row, with no deploy.

### 2.2 Order creation (server)

`apps/products/views.py:199-259` `checkout_gold_pass` (GET `/payments/checkout/gold-pass/?branch=<id>&semester=<id>`):

```python
amount_in_paise = int(plan.price * 100)
razorpay_order = client.order.create(data={"amount": amount_in_paise, "currency": "INR",
    "receipt": f"receipt_gold_{plan.id}_{request.user.id}", "payment_capture": "1"})
ProductDataService.create_purchase(request.user, subscription=plan, amount=plan.price,
    razorpay_order_id=razorpay_order['id'], status='PENDING')
request.session['pending_gold_pass_branch'] = branch.id      # scope kept in SESSION, not on the order
```

- `checkout_document` (`views.py:152-196`) does the same for one document.
- **Smell:** the order is created on a **GET** page render. Every refresh creates another Razorpay order and another
  PENDING row.
- **Smell:** the pass scope (branch/semester) is kept only in the Django session. If the session is lost before the
  verify step, the payment succeeds but no pass is granted.

campusquiz (better): `startCheckout(userId, planId)` in `src/lib/server/services/billing.ts:198-232` runs from a
**form action**. It refuses when billing is off or the plan is free, and it puts the scope in Razorpay `notes`:

```ts
const order = await createOrder(keys, { amountPaise: plan.priceInr,
  receipt: `cq_${userId.slice(0, 8)}_${Date.now()}`, notes: { userId, planId: plan.id, planCode: plan.code } });
await db().insert(payments).values({ userId, planId: plan.id, amountPaise: plan.priceInr,
  currency: order.currency, razorpayOrderId: order.id, status: 'created' });
```

`createOrder` (`src/lib/server/razorpay.ts:35-50`) POSTs to `https://api.razorpay.com/v1/orders` with Basic auth and
`AbortSignal.timeout(15_000)`, and cuts the receipt to 40 chars (the Razorpay limit).

### 2.3 Checkout script loading

- rgpv-live loads it with a static tag on every checkout page: `<script src="https://checkout.razorpay.com/v1/checkout.js">`
  (`templates/products/checkout.html:116`). Config is passed through `<script type="application/json" id="checkout-data">`,
  and the handler lives in `static/js/checkout.js`.
- campusquiz loads it **lazily, once, with retry on error** (`src/routes/teacher/billing/+page.svelte:23-37`):

```ts
let sdk: Promise<RzpCtor> | undefined;
function loadSdk() {
  return (sdk ??= new Promise((resolve, reject) => {
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Checkout failed to load')));
    s.onerror = () => { sdk = undefined; reject(new Error('Checkout failed to load. Check your connection.')); };
    document.head.append(s);
  }));
}
```

### 2.4 Client handler

rgpv-live, `static/js/checkout.js:16-48`: on success it fills a hidden form (`#razorpay-form`, with a CSRF token) and
submits it to `/payments/checkout/verify/`. On failure it calls `alert('Payment Failed: ' + response.error.description)`.
There is no `ondismiss` handler.

campusquiz, `+page.svelte:39-70`, is a phase machine
`idle | starting | paying | verifying | success | failed`:

```ts
handler: (r) => { resp = r; phase = 'verifying'; queueMicrotask(() => verifyForm?.requestSubmit()); },
modal: { ondismiss: () => { if (phase === 'paying') phase = 'idle'; } }
rzp.on('payment.failed', (r) => { phase = 'failed'; message = r.error?.description ?? 'The payment did not go through.'; });
```

The verify step is a hidden `use:enhance` form posting to `?/verify`. The server Zod-checks
`razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/)` (`src/routes/teacher/billing/+page.server.ts:44-58`).

### 2.5 Signature verification

- rgpv-live, `views.py:262-311` `payment_verify` (`@login_required @require_POST`):
  1. look up the purchase by `razorpay_order_id`
  2. reject it if `purchase.user_id != request.user.id`
  3. **verify the signature before any write**: `client.utility.verify_payment_signature(params_dict)`. On failure,
     mark the purchase FAILED and write an audit log.
  4. mark it SUCCESS and grant the entitlement

  A dedicated logger `audit.payments` records every transition. Regression tests are in
  `tests/test_payments_security.py` (login required, POST only, unknown order).
- campusquiz, `src/lib/server/razorpay.ts:14-31`: plain HMAC with a constant-time compare:

```ts
export function verifyPaymentSignature(orderId, paymentId, signature, keySecret) {
  return safeEqualHex(hmac(keySecret, `${orderId}|${paymentId}`), signature); }
export function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  return safeEqualHex(hmac(webhookSecret, rawBody), signature); }   // exact raw bytes
```

### 2.6 Webhooks and idempotency

- **rgpv-live has no webhook.** No route exists and there is no `RAZORPAY_WEBHOOK_SECRET`. If the browser closes after
  the payment but before the verify POST, the money is captured and the pass is never granted (support ticket). There
  is no idempotency either: posting verify twice re-runs the grant, which is harmless only because it overwrites fields.
- campusquiz handles it correctly:
  - Route `src/routes/api/razorpay/webhook/+server.ts` reads `request.text()` (raw body) and rejects anything over 1 MB.
  - `handleWebhook` (`billing.ts:287-310`) handles these events: `payment.captured` and `order.paid` lead to
    `markPaid`, `payment.failed` leads to `markFailed`. It returns 400 for a bad signature, 503 when no secret is set,
    and 200 for anything else so that Razorpay stops retrying.
  - **Idempotency lock** (`billing.ts:234-258`): a conditional status flip inside a transaction. The checkout callback
    and the webhook can race, but only one of them credits the order:

```ts
const [p] = await tx.update(payments).set({ status: 'paid', razorpayPaymentId: paymentId, ... })
  .where(and(eq(payments.razorpayOrderId, orderId), ne(payments.status, 'paid'),
             opts.amountPaise === undefined ? undefined : eq(payments.amountPaise, opts.amountPaise)))
  .returning();
if (!p) return null; // unknown order, amount mismatch, or already credited
```

  `payments.razorpayOrderId` is `UNIQUE`. The webhook also checks that the amount matches what was stored.

### 2.7 Entitlement model and expiry

rgpv-live:
- **Gold Pass is stored as columns on `users`** (`apps/users/models.py:23-44`): `active_subscription_plan`,
  `active_subscription_valid_until` (DATE), `gold_pass_branch`, `gold_pass_semester`. As a result a user can hold
  **only one pass at a time**, and buying a pass for another semester overwrites the current one.
- **Expiry = the exam date.** `AcademicsDataService.get_exam_date(branch, semester)` reads the `ExamDate(branch,
  semester, date)` table. When no exam date is set, the fallback is purchase date + 180 days (`views.py:347-355`).
  This is the main idea worth copying: the pass runs **until your exam**.
- Check: `User.has_gold_pass(subject=None, document_type=None)` (`users/models.py:46-87`) confirms that the date is
  still valid, that the scope matches (`subject.branch/semester`), and that the entitlement key `content.<type>` is on.
- Single documents use `UnlockedContent(user, product|parsed_document, valid_until)`. A null `valid_until` means
  "permanent". The check is `filter(Q(valid_until__isnull=True) | Q(valid_until__gte=today))`
  (`apps/products/data_services.py:15-26`).
- On purchase the plan's `ai_tier` is copied to `UserCredits` and the period counters are reset (`views.py:358-367`).

campusquiz: `subscriptions(userId, planId, status, currentPeriodEnd, razorpayOrderId, razorpayPaymentId,
grantedByAdmin)`. `activateOrExtend` extends the end date when the same plan is still active and otherwise cancels the
old row and inserts a new one. A null `currentPeriodEnd` means it never ends (admin grant). There is also an admin
`grantPlan` with no payment (`billing.ts:122-180`).

### 2.8 Receipts and invoices

- rgpv-live `/billing/` (`apps/users/views.py:98-115`) lists SUCCESS purchases and their total spend.
  `/billing/invoice/<id>/` (`views.py:117-127`, `templates/users/invoice.html`) is a **printable HTML invoice**
  ("Invoice #<purchase.id>", date, item, amount) that the user saves with the browser's Print to PDF. It has no GST
  number, uses no PDF library, and sends no email.
- campusquiz has a payments list on `/admin/billing` with revenue totals (`listPayments`, `billing.ts:315-345`) and a
  plan card on `/teacher/billing`. It has no invoices.

### 2.9 Refunds

Neither project calls the refunds API. rgpv-live has a `REFUNDED` status in `Purchase.STATUS_CHOICES`, but nothing ever
sets it. Its refund policy is text only in `templates/pages/terms.html` and `templates/pages/contact.html`. Refunds are
done by hand in the Razorpay dashboard, after which an admin edits the row.

### 2.10 Keys and env

- rgpv-live: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (`config/settings.py:509-511`, `.env.example:85-87` says
  "test or live"). Test or live mode is decided only by which key pair is configured (`rzp_test_...` vs `rzp_live_...`).
  There is no separate flag.
- campusquiz: the same two keys plus `RAZORPAY_WEBHOOK_SECRET`, all optional in `src/lib/server/env.ts:32-34`.
  `razorpayKeys()` returns null unless the id and secret are both set. `billingEnabled()` = keys present AND
  `app_settings.billing_enabled != false`, an admin kill switch that is cached for 60 s (`billing.ts:27-45`). Upgrade
  buttons are hidden when billing is off. Orders that are already in flight still get credited.

### 2.11 Failure and retry UX

- rgpv-live: order-creation errors render `templates/products/payment_error.html` with `str(e)`, which **leaks the raw
  provider error**. Client failures use `alert()`. Signature failures show "Payment Verification Failed".
- campusquiz: a `BillingError` produces a friendly 400. Other errors produce a 502 that says "Could not reach the
  payment provider. Try again in a minute." (`+page.server.ts:25-29`). Inline banners: `role="alert"` with "...You can
  try again.", and "Confirming your payment..." with a spinner while verifying. Closing the modal returns to idle.

### 2.12 CSP and headers

rgpv-live has **no CSP**. Its SameSite cookie setting is `Lax` because "'Strict' would break Razorpay"
(`config/settings.py:105`). campusquiz (`vite.config.ts:21-37`, `src/hooks.server.ts:90-91`) uses:

```
script-src  'self' https://checkout.razorpay.com
frame-src   https://api.razorpay.com https://checkout.razorpay.com
connect-src 'self' https://lumberjack.razorpay.com
Permissions-Policy: payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")
Cross-Origin-Opener-Policy: same-origin-allow-popups   // UPI apps / 3DS popups
```

**UCI today** blocks payments. `src/hooks.server.ts:75` sends `payment=()`, and the `vite.config.ts` CSP is missing
Razorpay. Both must be changed to the campusquiz values above. UCI already sends COOP `same-origin-allow-popups`.
Also exclude `/api/razorpay/**` and billing pages from the service-worker cache (see campusquiz
`src/lib/components/pwa/cache-route.ts:11`).

### 2.13 Exact DB tables

rgpv-live (Django; table names are `products_<model>`):
- `SubscriptionPlan(name, plan_type, price, includes_* bools, ai_tier_id, is_active)`
- `PlanEntitlement(plan_id, feature_key, value_type, bool_value, int_value)`, unique on (plan, feature_key)
- `Purchase(user_id, product_id?, parsed_document_id?, subscription_id?, amount_paid, razorpay_order_id,
  razorpay_payment_id, status PENDING|SUCCESS|FAILED|REFUNDED, created_at)`. `razorpay_order_id` is **not unique**.
- `UnlockedContent(user_id, product_id?, parsed_document_id?, valid_until)`
- `Coupon(code unique, discount_percentage, max_uses, current_uses, is_active)`
- `Product`, `ProductCategory` (unused)
- the pass itself lives on `users_user`: `active_subscription_plan_id`, `active_subscription_valid_until`,
  `gold_pass_branch_id`, `gold_pass_semester_id`
- `academics.ExamDate(branch_id, semester_id, date)` is the expiry source

campusquiz (`src/lib/server/db/schema.ts:294-365`):
- `plans(id, code unique, name, priceInr int /* paise */, interval month|year, features jsonb, studentLimit, active, sort)`
- `subscriptions(id, userId, planId, status, currentPeriodEnd, razorpayOrderId, razorpayPaymentId, grantedByAdmin, createdAt)`
- `payments(id, userId, planId, amountPaise, currency, razorpayOrderId UNIQUE, razorpayPaymentId, razorpaySignature, status created|paid|failed, raw jsonb, createdAt)`
- `app_settings(key pk, value jsonb)`

### 2.14 Bugs not to port

1. **Coupons are broken for partial discounts.** `checkout.js:84-86` sets `options.amount` on the client, but the order
   was already created server-side for the full price, so Razorpay charges the order amount (or errors). Only the
   100%-off path works, and it goes through `/payments/checkout/apply-free/`, which skips Razorpay entirely.
   Coupon `current_uses` is incremented without a lock, so it can race. Fix: apply the coupon **server-side before
   `createOrder`**, and increment it in the same transaction as `markPaid`.
2. The order is created on GET (2.2).
3. The scope is kept in the session (2.2).
4. There is no webhook or idempotency (2.6).
5. Error pages show the raw exception string (2.11).
6. The single pass on `users` overwrites itself (2.7).

---

## 3. Exam-wise browsing (rgpv-live)

The hierarchy is **University (RGPV, fixed) > Branch > Semester > Subject > Resource type > Document**
(`apps/academics/models.py`: `Branch`, `Semester`, `Course`, `Subject(branch, semester, course)`, `Unit(subject)`,
`ExamDate(branch, semester)`, `SubjectAnalytics`).

### 3.1 Route tree and URL structure

`apps/content/urls.py:16-31`. Every page is SSR with slug URLs:

```
/rgpv/                                   hub (seo_hub.html)
/rgpv/branches/  /rgpv/semesters/  /rgpv/subjects/  /rgpv/first-year/     index pages
/rgpv/<branch>/                          e.g. /rgpv/cse/            (seo_branch.html)
/rgpv/<branch>/sem-<n>/                  e.g. /rgpv/cse/sem-4/      (seo_semester.html)
/rgpv/<branch>/sem-<n>/<subject-code>/   e.g. /rgpv/cse/sem-4/cs-401/   (seo_subject.html)
/rgpv/<branch>/sem-<n>/<subject>/<resource>/        resource = syllabus | notes | important-questions | previous-year-papers
/rgpv/<branch>/sem-<n>/<subject>/<resource>/<doc-slug>/   reader, or the locked teaser
/rgpv-notes/  /rgpv-syllabus/  /rgpv-question-papers/ ...  static long-tail keyword landing pages (rgpv_static_page)
```

- Slugs: `slugify(branch.code)`, `semester_slug(n) = f'sem-{n}'`, `slugify(subject.code)` (`seo_helpers.py:161-172`).
  The resource map lives in `SEO_RESOURCE_MAP` (`seo_helpers.py:31-45`). It maps a URL segment to a set of document
  types.
- **Canonical 301s**: any other spelling of a slug redirects permanently (`_canonical_slug_redirect`, `views.py:62`).
  The old query-param browser `/explore/?branch=&semester=` now 301s to the slug pages (`views.py:784-806`), and the
  old `/subject/<id>/` and `/read/<id>/` redirect the same way.
- First-year subjects shared across branches have **one canonical page**, and the copies point to it with
  `canonical_url` (`seo.canonical_subject`).

### 3.2 Page layouts

- Semester page: a subject grid `grid gap-3 md:grid-cols-2 xl:grid-cols-3` (`templates/content/seo/seo_semester.html:17`)
  and a semester switcher row of pill links using `aria-current="page"` (`:73`).
- Subject page: two columns on desktop, `lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]`
  (`seo_subject.html:27`). The main column has the units and syllabus topics and the resource rows. The side column
  has recent papers and sibling subjects. On a phone it is a single stack.
- The locked document page puts the call to action **first on a phone and in a sticky side card on desktop**
  (`templates/content/locked_document.html` comment: "The way in: first on a phone, a sticky side card on a wide screen").
- `_semester_grid.html` holds every branch and semester in one grid (`flex-col` on phone, `sm:flex-row` rows).
- `_remember.html` and `static/js/guest-prefs.js` remember the last branch and semester in localStorage and show a
  "Continue" chip. `includes/cp_picker.html` and `static/js/cp-picker.js` provide a two-step branch and semester picker.

### 3.3 Filters and search

There are no filter widgets. **The URL is the filter**: you drill down through branch, semester and subject. Resource
pages are paginated (`?page=n`, and pages after the first canonicalise to page 1). There is no global site search. The
only search is in-document (`static/js/reader-search.js`). The picker plus the drill-down hubs do the job of search.

### 3.4 SEO

- All public pages are SSR with per-page `seo_title`, `seo_description`, `seo_keywords` and `canonical_url`, built by
  `seo.branch_meta`, `semester_meta`, `subject_meta` and `resource_meta`.
- `seo_robots='noindex,follow'` applies to empty subjects, empty resource pages, locked teasers, logged-in readers and
  promise-only static pages (`NOINDEX_STATIC_PAGES`).
- **Breadcrumbs**: `seo.crumbs(branch, semester, subject, resource_label, doc)` returns `[{name,url}]` in the order
  Home > RGPV > CSE > 4th Semester > CS-401 > Notes > Doc (`seo_helpers.py:771-789`). `breadcrumb_jsonld` emits
  schema.org `BreadcrumbList`. `jsonld_script` escapes `< > &` so the JSON is safe inside `<script>`. The partial is
  `templates/content/seo/_breadcrumbs.html`. Readers get additional JSON-LD (`reader_jsonld`).
- **Sitemap**: `/sitemap.xml`, built by `seo.sitemap_entries()` (`seo_helpers.py:897+`) and cached for 1 h under the key
  `seo_sitemap_entries_v2`. It lists hubs, indexable static pages, branches and semesters that have content, canonical
  subjects, non-empty resource pages and indexable docs. Each entry has a real `lastmod` (the newest `updated_at` of
  the documents under it). Empty pages are left out.
- `/robots.txt` disallows `/dashboard/ /notes/ /practice/ /payments/ /api/ /accounts/ /*?next=`.
- IndexNow pings on change (`apps/content/indexnow.py`).
- Guests can read the free document types (`GUEST_ALLOWED_DOCUMENT_TYPES`). The rest are gated by
  `_can_access_document` (`views.py:35`).

---

## 4. Design and UX patterns worth copying

1. **Locked-content teaser instead of a login wall** (`views.py:710-742`, `templates/content/locked_document.html`):
   it shows breadcrumbs, the type, the title, and "What this covers" (the unit's syllabus topics), then **one clear way
   in**. For a free account that is "Create free account" + "I already have an account" (both keep `?next=`). For paid
   material that is "Unlock for ₹X" + "See Gold Pass", followed by a "Free to read now" list of related free items. It
   is `noindex`, and the login/signup links are `rel="nofollow"`.
2. **Access chips on lists** (`seo/_access_chip.html`): `Free`, `N free` (some items free), or `Locked` with a lock
   icon. Members get no chip, because their access is decided per item.
3. **Pricing card** (`templates/products/gold_pass_public.html`, public `/gold-pass/`, cached): one aside card with
   the name, `₹price` and "one-time, for one semester", then a single call to action that depends on state:
   - guest: Create free account
   - account with branch and semester set: "Continue to checkout" + "For the branch and semester on your account. Change it"
   - no scope set: Choose your branch and semester
   - already active: "Your Gold Pass is active: view your plan"
   - nothing on sale: "Gold Pass is not on sale at the moment"

   Below the card is a **Free vs Gold comparison table** built from `PlanEntitlement` rows.
4. **Membership page** (`/payments/membership/`, `gold_pass_membership.html`): days left, storage usage bars, the
   comparison table and the last 3 purchases.
5. **Checkout page**: an order summary, a coupon field, and a **sticky pay bar on phone** that sits in normal flow on
   desktop, with "Payments secured by Razorpay" (`templates/products/checkout.html:64-101`).
6. **Pass valid until the exam date.** This is easy to explain and fits coaching students exactly.
7. From campusquiz: the phase-machine banners (Confirming / failed: you can try again), hiding upgrade UI when billing
   is off, and an admin "grant plan without payment" for offline cash payers.

---

## 5. Recommendation for UCI

### 5.1 What to sell (in order)

1. **Exam Pass (test series pass)**, the main product. It is scoped to one `exams` row (SSC CGL, MP Police...) and
   unlocks every `tests.access='paid'` test, every paid course and every paid note for that exam. It is valid until
   `validUntil`: the admin sets a fixed end date (the exam date, as in rgpv-live) or a duration in days. Several passes
   per user are allowed (one row each, not columns on `users`).
2. **Single paid course** (`courses`): lifetime access, or access until the course end date.
3. **Single paid test** (`tests.access='paid'`, which already exists with `priceInr`): a cheap one-off mock. It writes
   to the existing `test_grants`, so the attempt engine does not change.

Skip coupons, refunds API, GST invoices and recurring subscriptions until there is a real need. Offline (cash) students
are handled by an admin grant, which UCI already has via `testGrants`. Extend it to passes.

### 5.2 Minimal tables (Drizzle, append to `src/lib/server/db/schema.ts`)

```ts
export const productKind = pgEnum('product_kind', ['exam_pass', 'course', 'test']);
export const paymentStatus = pgEnum('payment_status', ['created', 'paid', 'failed', 'refunded']);

/** Anything sellable. Exactly one target column is set, matching `kind`. */
export const products = pgTable('products', {
  id: id(),
  kind: productKind().notNull(),
  examId: uuid().references(() => exams.id, { onDelete: 'cascade' }),     // exam_pass
  courseId: uuid().references(() => courses.id, { onDelete: 'cascade' }), // course
  testId: uuid().references(() => tests.id, { onDelete: 'cascade' }),     // test
  title: text().notNull(),
  description: text().notNull().default(''),
  pricePaise: integer().notNull(),
  mrpPaise: integer(),                       // strike-through price on the card
  validDays: integer(),                      // null = use validUntil or lifetime
  validUntil: timestamp({ withTimezone: true }), // fixed end (exam date); wins over validDays
  active: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt()
}, (t) => [index().on(t.kind, t.active), index().on(t.examId)]);

export const payments = pgTable('payments', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id, { onDelete: 'restrict' }),
  amountPaise: integer().notNull(),
  currency: text().notNull().default('INR'),
  razorpayOrderId: text().notNull().unique(),   // idempotency key
  razorpayPaymentId: text(),
  status: paymentStatus().notNull().default('created'),
  raw: jsonb().$type<unknown>(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => [index().on(t.userId, t.createdAt), index().on(t.status)]);

/** What a user can open. Written by markPaid or an admin grant. One row per (user, product). */
export const entitlements = pgTable('entitlements', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid().notNull().references(() => products.id, { onDelete: 'cascade' }),
  validUntil: timestamp({ withTimezone: true }),  // null = lifetime
  paymentId: uuid().references(() => payments.id, { onDelete: 'set null' }),
  grantedById: uuid().references(() => users.id, { onDelete: 'set null' }), // admin grant
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);
```

Plus these changes to existing tables:
- `courses.priceInr` / `notes.premium` are not needed. A course is paid when an active `products` row has
  `kind='course'` and points at it. For tests, keep `tests.access='paid'`.
- The `billing_enabled` key goes in the existing `settings` table, as the admin kill switch.

Access check, one function in `src/lib/features/billing/server/access.ts`:
`canOpen(user, {examId, courseId?, testId?})`. It returns true when the user has an entitlement row with
`validUntil` null or in the future, and the row is for that item's product **or** for the `exam_pass` product of the
item's `examId`. Cache it per user with `cacheKeys` and invalidate it in `markPaid` and in grants. Keep the existing
`test_grants` check for per-test admin grants.

Services to port almost verbatim from campusquiz:
- `src/lib/server/razorpay.ts` (copy the whole file)
- `startCheckout`, `confirmCheckout`, `markPaid` (the conditional status-flip lock plus the amount check),
  `handleWebhook`, `billingEnabled` from `src/lib/server/services/billing.ts`, moved to
  `src/lib/features/billing/server/service.ts`. Replace `activateOrExtend` with "upsert entitlement,
  `validUntil = max(existing, computed)`".
- Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, optional in `env.ts`. Billing is off
  unless all are set. Use `rzp_test_*` keys locally and `rzp_live_*` in production.
- Headers and CSP: see 2.12. Change `payment=()` to the Razorpay allow-list, and add `script-src`, `frame-src` and
  `connect-src`.
- Add `/legal/refunds` (already in the route tree) as text. Process refunds by hand in the Razorpay dashboard, then
  have an admin set `payments.status='refunded'` and delete the entitlement.

### 5.3 Route tree for exam-wise browsing

UCI's taxonomy is already `exam_categories > exams > subjects`, which maps onto rgpv-live's
`branch > semester > subject` drill-down.

**Public SSR + SEO** (`src/routes/(site)/`), replacing rgpv's `/rgpv/<branch>/sem-<n>/...`:

```
/exams                                   all categories > exam cards          (hub; JSON-LD BreadcrumbList)
/exams/[category]                        e.g. /exams/ssc  > its exams
/exams/[category]/[exam]                 e.g. /exams/ssc/ssc-cgl  exam landing: pass pricing card,
                                         tabs/sections: Test series · PYQ papers · Courses · Notes, subject chips
/exams/[category]/[exam]/tests           list of mocks/PYQs/sectionals with Free/N free/Locked chips
/exams/[category]/[exam]/pyq             previous-year papers (tests.kind='pyq', year/shift)
/exams/[category]/[exam]/[subject]       subject-wise tests + notes for that exam (only when non-empty)
/exams/[category]/[exam]/pass            public pricing page (cached; rgpv /gold-pass/ pattern)
/sitemap.xml  /robots.txt                sitemap from enabled exams with content, real lastmod; noindex empty pages
```

`/courses` and `/courses/[slug]` stay as they are. Add an exam filter chip row that writes `?exam=ssc-cgl`, which is
crawlable but canonicalised to the page without the parameter.

**Student app** (`src/routes/(app)/app/`):

```
/app/exams                               my target exam(s) first (users.targetExamId), then all, via picker
/app/exams/[exam]                        exam home: pass status (days left), tests, PYQs, courses, notes
/app/tests?exam=<slug>&kind=mock|pyq|practice&subject=<slug>   existing list gets filter chips (URL = filter)
/app/checkout/[productId]                order summary + sticky pay bar (phone) -> Razorpay modal
/app/me/billing                          payments list + printable receipt /app/me/billing/[paymentId]
```

API: `POST /api/razorpay/webhook` (raw body). Checkout start and verify are **form actions** on
`/app/checkout/[productId]` (`?/start`, `?/verify`), as in campusquiz.

Staff (`src/routes/(staff)/admin/`): `/admin/products` (CRUD; the price, validity and exam come from taxonomy),
`/admin/payments` (list, revenue, status filter), `/admin/students/[id]`, which gets a "Grant pass" action, and a
billing on/off switch in `/admin/site`.

Locked states: a paid test, course or note that the user cannot open renders the **teaser** from 4.1 rather than
redirecting. It shows the title, what it covers (sections, number of questions, duration) and one call to action
("Unlock with SSC CGL Pass ₹X" or "Buy this test ₹Y"). Guests get "Sign in with Google" with `?next=`. Teasers are
`noindex`.
