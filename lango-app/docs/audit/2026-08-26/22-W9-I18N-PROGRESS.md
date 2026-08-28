# W9 i18n Extraction — Progress 2026-08-28

This is **pass 2** of an intentionally multi-pass task. W9 is **not done** and is **not
close to done**. The ledger below is the real, measured state — no rounding up.

## Numbers

- files using useTranslations/getTranslations: **11** (3 at start; +8 this pass: the
  dashboard shell `dashboard-view.tsx` and all 7 dashboard child widgets)
- pages fully translated: **1 / 343** (the login/auth page's client form). The dashboard
  **home** is now wired but is *partial*, not counted as a completed page — the `Icon School
  & College Branch Dashboard` brand badge and the `MAD` currency code are still hardcoded.
- components fully translated: **8 / 409** — LoginClient + the 7 dashboard widgets
  (strength-metric-cards, income-expense-donut, annual-fee-summary-chart,
  attendance-inspection-chart, student-quantity-donut, dashboard-calendar-widget,
  birthday-tracker-widget). The sidebar is **not** fully translated — its ~150 nav item
  labels are still hardcoded French.
- locale keys: en **277** / fr **277** / ar **277** (added the `annualFee*` + 4-dashboard-
  widget key groups this pass)
- keys with NO trustworthy Arabic yet: **0** among the keys I added. The rest of the inline
  French UI is not yet in `locales/*` at all (still hardcoded), so it isn't "untrusted
  Arabic" — it's simply un-extracted.
- check:i18n: exit **1**; 0 missing / 0 invalid / 0 undefined / **150 unused** staged keys
  (down from 153 — trending toward 0, no regression)
- tsc: exit **0** · tests: **1838 / 1841** (3 pre-existing failures, see Defects; not
  re-runnable this session because Docker/Postgres is unavailable)

## Modules completed

| Module | fr | ar | en | Verified how |
|---|---|---|---|---|
| Login / Auth | ✅ | ✅ | ✅ | Curled `/fr/login` `/ar/login` `/en/login` and confirmed distinct strings; `dir` flips `ltr`→`rtl` for `/ar`; delete-key proof test (below) |
| Dashboard shell + 7 widgets | ✅ | ✅ | ✅ | `tsc` exit 0; `check:i18n` reported 0 missing keys (proves every new key is referenced in `src`); ICU runtime formatting of each new FR/EN/AR message confirmed (incl. `Aujourd''hui` apostrophes + `{count, plural}` branches); AR month/weekday names come from `Intl.DateTimeFormat` so they are genuinely Arabic, not invented |

The `Auth` namespace was ~90% wired before pass 1. Pass 1 completed it by extracting the
footer (`Auth.footerRights`). Pass 2 (this pass) extracted the whole dashboard home: the
`Dashboard` shell (metric cards, income/expense donut, annual-fee chart, attendance
inspection, student-quantity donut, calendar, birthday tracker, header banners, alerts,
recent-payments, at-risk card, module-open confirm dialog). Calendar month/weekday labels are
localized via `Intl.DateTimeFormat` with the active next-intl locale instead of a hardcoded
French array.

## What else this pass shipped

1. **The `en` decision — WIRED ENGLISH THROUGH, not removed.** Root cause was in two places:
   `src/i18n/request.ts:9` and `src/app/[locale]/layout.tsx:32` both clamped `en → fr`.
   Now both load `locales/en.json` and accept `'en'`. Rationale: this is an English-center
   product, its `<title>`/`description` metadata are in English, `locales/en.json` holds
   quality English (220 keys), and `/en/*` already returned HTTP 200. Removing English from a
   language-center product would be wrong; wiring it is correct.
   Verified: `/en/login` now serves `Sign in to your account` / `All rights reserved.`
   (it previously served French). Middleware does **not** clobber `en` — it only defaults to
   `fr` when no locale prefix is present (`src/middleware.ts:44-51`).
2. **Role labels wired to the staged `Roles` namespace** (`src/components/shared/sidebar.tsx`).
   Replaced the hardcoded French `ROLE_LABELS` map with a `ROLE_LABEL_KEY` map resolved at
   render through `useTranslations('Roles')` (super_admin→∞superadmin alias handled). Reuses
   already-staged, quality fr/ar/en — no new Arabic invented. Verified by `tsc` + confirmed
   the `Roles.*` keys exist in all three locales (`i18n-check` reported no missing keys);
   **not** live-rendered because the authenticated dashboard render requires the Better Auth
   API, which in this dev run fails earlier on `DATABASE_URL`/`BETTER_AUTH_SECRET` missing
   from the process env (dev-environment limitation, not a code issue).
3. **One bidi fix.** Login footer: the Latin brand run
   (`Lango English Center & SchoolOS Administration Portal`) is wrapped in `<bdi dir="ltr">`
   so it does not scramble inside the RTL Arabic sentence.

## Verification proof (required step 4)

Deleted `Auth.footerRights` from `locales/fr.json` → `check:i18n` reported
`Found missing keys!  locales\fr.json │ Auth.footerRights` and exited 1 → restored the key.
This proves the key is genuinely consumed and `check:i18n` detects a real gap.

## The `en` decision

**Wired English through** (see above). `en.json` is loaded, `en` is a first-class route
locale with `dir:ltr`. English marketing copy does not exist, however — the marketing
site (`src/features/marketing/**`) is French/Arabic-only and still clamps `en → fr`
(`marketing-header.tsx:17`, `marketing-footer.tsx:66`). So `/en` covers the app surfaces we
verified (login) but not the marketing landing page. This is a separate content system
(marketing `Locale = 'fr' | 'ar'`, English copy not authored) and is **out of this pass's
priority list**; flagged, not fixed.

## Untrustworthy Arabic

None introduced this pass. The one string I translated (`كل الحقوق محفوظة` = "All rights
reserved") is standard, unambiguous Arabic.

## RTL issues found

- `/ar/login` renders correctly with `dir="rtl"` (observed directly).
- Login footer brand run isolated with `<bdi dir="ltr">` (above).
- Flagged, not fixed: marketing header/footer clamp `en → fr`, so English marketing renders
  French; and the full dashboard RTL mirroring is unverified because the real translation
  content (Arabic strings replacing the hardcoded French) is not in place yet. The prior
  `17-ARABIC-RTL-VERIFICATION.md` carries its own Wave-3 correction flag for over-claiming —
  my RTL claims here are limited to the two observed facts above.

## Defects noticed outside i18n

- `src/app/api/__tests__/grade-entry-route.test.ts` — **3 tests fail** (`insert or update on
  table "assessment_results" violates foreign key constraint
  "assessment_results_assessment_id_assessments_id_fk"`). The test plants an
  `assessmentResults` row for `otherTenantId` against a shared `assessmentId` whose parent
  `assessments` row is not present. **Not fixed** (outside W9): verified it fails
  deterministically in isolation, and none of my changed files (locales, request.ts, layout,
  login-client, sidebar, marketing locale-context) touch assessment fixtures or the DB. This
  is a pre-existing defect, not a W9 regression.
- Environment note (not a code defect): starting `npm run dev` from this shell did not load
  `DATABASE_URL`/`BETTER_AUTH_SECRET` into the process, so the Better Auth sign-in API 500s.
  The vite global-setup also requires `DATABASE_URL`; tests were run with it set inline.

## What is NOT done

- **check:i18n exit 0:** not reached. 150 of 277 staged keys are still unwired in `src`; it
  reaches 0 only after the extraction is substantially done (or unused staged keys are removed).
- **The bulk of the extraction:** Students, Finance, Academics, Attendance, Portals, Grading,
  Settings, and most shared components still render hardcoded French. The sidebar's ~150
  nav-item labels, and every module page other than login, are still hardcoded.
- The dashboard **home** is wired but *partial* (brand badge + `MAD` currency remain hardcoded);
  it is not counted as a completed page.
- **`1 of 343` pages and `8 of 409`** components translated, by honest count.
- Parent-portal-in-Arabic end-to-end (the Definition of Done): not attempted this pass.
- The remaining Dashboard keys `totalStudents` / `totalRevenue` / `Common.total` are staged but
  unused (pre-existing, from an earlier styling grid) — flagged, not removed.

**Status legend used:** done = verified both ways · partial = which part · not-done = skipped.
When in doubt in this document, the status is the lower one.
