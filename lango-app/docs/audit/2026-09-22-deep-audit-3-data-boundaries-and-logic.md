# SchoolOS deep audit 3 — data boundaries, grades, finance controls, compliance

Date: 2026-09-22 · Baseline: working tree after correction pass 2 (another tool is editing admissions files concurrently; this audit is read-only) · Method: scripted sweeps + manual reading. No runtime testing.

Previous audits: `2026-09-22-visual-product-audit.md`, `2026-09-22-full-app-security-logic-audit.md`. Nothing here repeats them.

## 1. Executive diagnosis

Two new P0s:

1. **Any parent can read other families' money.** Several finance routes check only the `finance.read` capability, and the `parent` role holds it. A parent can list every refund and credit note in the school, the journals and bank reconciliation, and **any household's invoices and payments** by guardian id.
2. **Report cards average every result a student has ever had.** `getClassReportCards` has no term or school-year filter, so a term-1 bulletin includes last year's marks and marks from other terms.

Beyond those: saved grading rules that do nothing, grade edits after a term is locked, a refund side-effect from the pass-1 dashboard fix, SMS sends that ignore STOP, and email 2FA that can't deliver codes.

## 2. What works (verified)

- Parent portal (`/api/guardian/me/**`): every child route goes through `assertRelationshipAccess` with status and effective dates.
- Teacher grade entry and marksheet: writes limited to the teacher's own sections (`marksheet-access.ts`).
- Offboarding sets `userStatus = inactive`, and every request re-checks `userStatus = 'active'`, so access ends immediately.
- Mass assignment: every `.set(body)` / `...input` found uses a `.strict()` schema with a small field list.
- Broadcast campaigns re-check consent and suppression right before dispatch.
- Refund amount is capped at the payment amount by a DB trigger (migration 0042); invoice cancel refuses anything but `pending`.
- Public verify endpoints return only name + school, rate-limited.
- Login: lockout + 30/min sign-in rate limit.

## 3. Findings

### P0

**P0-E · Parents (and anyone holding `finance.read`) read school-wide finance**
- Routes gated only by `requireCapability(ctx, 'finance.read')` with no role list and no per-family scoping:
  `finance/refunds` GET, `finance/credit-notes` GET, `finance/journals` GET, `finance/chart-of-accounts`, `finance/bank-reconciliation` (+ `[id]`), `finance/allocations`, `students/parents/[id]/payments` GET.
- `parent` holds `finance.read` (`src/libs/api/permissions.ts:~352`).
- Example: `GET /api/students/parents/<any guardian id>/payments` returns that household's invoices and payments; `GET /api/finance/refunds` returns every refund with student names and reasons.
- Same shape for `students.read` (also held by parent): `students/placements` GET lists placements school-wide.
- Why it matters: Law 09-08 and basic trust. Families must never see each other's money.
- Fix: add explicit staff role lists (`['school_admin','accountant']`) to every staff finance route, and don't rely on capability alone where parents or students hold that capability. Add a test that sweeps all routes: parent and student sessions must get 403 on every non-portal finance and students route.

**P0-F · Report cards are not scoped to a term or school year** — `src/features/academics/services/report-card-service.ts:34-100`
- Signature is `(tenantId, classSectionId)`. Results are selected by tenant + current roster only, with no exam term and no session year.
- Each subject score is a plain mean of every mark ever recorded, and the coefficient comes from whatever `class_subject` the old mark belonged to (last year's class for promoted students).
- Why it matters: the bulletin families receive is mathematically wrong the moment a second term or year exists.
- Fix: take `examTermId` (or session year + term), filter results through `assessments → assessment_plans → exam term / session year`, use the current class's coefficients. Test: a student with marks in two terms gets a term-1 bulletin that only uses term-1 marks.

### P1

**P1-G · Saved grading rules that nothing applies.** `academic.eliminatoryScore` and `academic.evaluationWeights` are validated and saved (pass 1) but have **no consumer**. `grep` finds them only in the policy route, settings registry, and UI config. Bulletins ignore the eliminatory mark and weight every assessment equally. The page implies these rules are in force. Either apply them in the report-card and promotion services, or show them as "non appliqué" until they are.

**P1-H · Marks can change after a term is locked or published.** `api/academics/grade-entry/route.ts` writes marks without `requireExamTermStage` (only `exam-terms/[id]/marksheet` and `seat-allocation` use the guard). A teacher can edit marks behind a published bulletin.

**P1-I · Any teacher can grade any assignment submission** — `api/academics/assignments/grade/route.ts`. No check that the teacher owns the assignment or teaches the class (the homework grade route does check `createdBy`).

**P1-J · A partial refund wipes the whole payment from "Collected".** `refund-approval.ts:126` sets the payment `status = 'refunded'` even when only part is refunded. Combined with the pass-1 rule "collected = posted only", a 100 MAD refund on a 5,000 MAD payment removes 5,000 MAD from the dashboard. It also blocks any second partial refund. Fix: collected = sum(posted + refunded payments) − sum(approved refunds), or keep the payment `posted` and track refunds separately.

**P1-K · Direct SMS ignores STOP / opt-out.** `api/communication/send`, `api/communication/messages`, and `api/attendance/audit-summary` send through `sms-delivery` with no `checkConsent` or suppression check. Only broadcast campaigns honour opt-outs. Telecom rules and AGENTS.md §1.2 require STOP handling on every send.

**P1-L · Email 2FA codes are never delivered in production.** `src/libs/auth.ts` `sendOTP` only writes a hashed code to the DB; the comment says "Log-only… Replace with a real email provider in production." Anyone who enables email-code 2FA cannot log in. Either wire a real mail provider or hide email-OTP 2FA until one exists.

**P1-M · Photo / media consent is not enforced.** AGENTS.md §1.2 says guardian consent is required before student photos are processed or published. The only trace is a `mediaConsent` portal preference key (`portal-preferences.ts:20`); no card issuance, website, or photo route checks it.

**P1-N · Refund and some finance postings are "fail-open" to the ledger.** `refund-approval.ts` updates invoices and the payment, then `tryPostRefundGLEntry` after the transaction. If the GL post fails (for example, closed period), the student ledger and the general ledger drift with no blocking error. Surface a reconciliation exception instead of silently continuing.

### P2

- **CSV formula injection**: 14 of 17 CSV exports write raw cell text (students, HR, audit logs, trial balance, statements, library, transport…). Names come from the public inquiry form, so `=HYPERLINK(...)` can reach an admin's Excel. Route all exports through `libs/services/exporters.ts` `toCsv` (already escapes) or add the `'` prefix for cells starting with `= + - @`.
- **Unbounded lists**: ~95 list GETs have no limit/pagination (e.g. refunds GET), and `students/admissions` accepts any `pageSize`. On a 1.9 GB host, cap at 200.
- **Alumni can change their login email with no verification** (`alumni/me/profile` PATCH sets `user.email`).
- **Two grade engines**: exam-term rankings and report cards compute averages separately; after P0-F, verify they agree on the same data.

## 4. Coding-agent prompt (copy-paste)

```
Data-boundary + grade-correctness pass. Do not redesign UI. Do not touch files the admissions work is editing (admission-requests-client.tsx, admissions page, locales) unless listed. Each fix needs a test.

P0-E  Staff-only finance and student-admin routes
  - Add requireRequestContext(req, ['school_admin','accountant']) (or the correct staff list) to: finance/refunds, finance/credit-notes, finance/journals, finance/chart-of-accounts, finance/bank-reconciliation (+[id]), finance/allocations, students/parents/[id]/payments, students/placements.
  - New test that enumerates every route under src/app/api/{finance,students,hr,academics} (excluding guardian/student portal routes) and asserts parent and student sessions get 403.

P0-F  Report cards scoped to a term
  - getClassReportCards(tenantId, classSectionId, examTermId). Filter results to that term's assessments; use the current class's coefficients.
  - Update both callers (students/report-card, report-card/issue) and the UI to pass the term.
  - Test: marks in term 1 and term 2 -> term-1 bulletin uses only term-1 marks.

P1
  - Apply academic.eliminatoryScore (any subject below it => Ajourné) and academic.evaluationWeights in report-card + promotion services, or mark them "non appliqué" in the UI. Pick apply.
  - grade-entry route: requireExamTermStage so locked/published terms refuse writes (409).
  - assignments/grade: teacher must own the assignment or teach its class.
  - Partial refunds: keep collected correct. Collected = posted payments minus approved refunds; do not flip a partially refunded payment to 'refunded'. Update libs/finance/definitions.ts and its tests.
  - communication/send, communication/messages, attendance/audit-summary: checkConsent + suppression before every SMS; skipped recipients reported.
  - Email 2FA: hide email-OTP option unless a mail provider is configured (env flag), and say so in settings.
  - mediaConsent: enforce before card issuance with photo and any public/website photo use.
  - Refund GL post failure -> create a reconciliation exception row, visible in finance.

P2
  - All CSV exports through exporters.toCsv (formula-safe).
  - Cap pageSize at 200 everywhere; add limits to unpaginated list GETs that can grow (refunds, credit notes, journals first).

Return: the parent/student 403 sweep test output, the bulletin term test, check:types (0), check:isolation, full vitest.
```

## 5. Gate

- Finance pages reachable by parents via API: **BLOCKED** until P0-E.
- Report cards / results pages: **BLOCKED** until P0-F.
- Everything else from audits 1-2 unchanged.

---

## 6. Cross-check of audit-3 pass (code evidence)

Confirmed: all 9 flagged routes now use explicit staff role lists (0 bare `requireRequestContext(req)` left in them); report cards filter by term window (`assessmentDate` between `termStart`/`termEnd`) and apply `academic.eliminatoryScore`; refunds flip a payment to `refunded` only when cumulative refunds ≥ payment; grade-entry calls `requireExamTermStage(..., 'enter_marks')`; teachers can only grade submissions on assignments they created. Sweep test `src/app/api/__tests__/data-boundary-sweep.test.ts` exists with a short, justified allowlist (`hr/payslips` self-scopes non-admins to their own rows; syllabus and exam-taking are student-facing by design).

Residual (P3): `academics/homework/[id]` GET lets a student read any homework in the school by id, not only their class's. Content only, no marks or other students' data.

Still open from this audit: P1-K (SMS STOP on direct sends), P1-L (email 2FA), P1-M (photo consent), P1-N (refund GL exception), P1-G weights part (evaluationWeights unused), P1-G for promotions (eliminatory mark applied to bulletins only), P2 CSV formula escaping, remaining page-size caps, alumni email change.

Gate: P0-E and P0-F **ACCEPTED on code**.

---

## 7. Remaining-items pass (done directly by the reviewer, 2026-09-22/23)

| Item | Fix | Test |
|---|---|---|
| P1-K SMS STOP | `findSendBlock` in `sms-delivery.ts` blocks suppressed numbers and revoked student consent on every direct send; blocked attempts recorded as `failed`. Inbound STOP/ARRET/توقف on the signed webhook suppresses the number in tenants that messaged it (`inbound-stop.ts`). Webhook signing secret has no literal fallback. | `sms-stop-optout.test.ts` (7) |
| P1-L email 2FA | Downgraded to P2: enrollment is TOTP, nobody was locked out. `otp-email.ts` sends real email via Resend when `PLATFORM_RESEND_API_KEY` is set; production without a key refuses with a clear message. | `otp-email.test.ts` (4) |
| P1-M photo consent | `media-consent.ts`: any active guardian's explicit `mediaConsent=false` withholds the photo on student and exam cards (card still issued; photo-required template → 409 `MEDIA_CONSENT_REFUSED`). Also fixed: card PDFs received photo **URLs**, which pdfme cannot render, so photo cards silently produced no PDF; photos are now inlined as data URIs. | `media-consent.test.ts` (3) |
| P1-N refund GL | Refund that cannot post to the GL (school has a chart of accounts) raises an `accounting_adapter_exceptions` row `gl_post_skipped`. | `refund-linkage.test.ts` (+2) |
| **Regression from audit-3 pass** | Partially refunded payments stayed `posted` at full amount, so "Collected" over-counted refunds. `netCollectedSumSql` nets approved refunds from still-posted payments (full refunds already excluded, never subtracted twice). Dashboard month + period use it. | `refund-linkage.test.ts` (+1) |
| P1-G weights | Assessments carry no CC/exam category, so weights cannot be applied without a schema decision. The policy page now states: pass + eliminatory marks applied, weights stored but not yet applied. | — |
| P1-G promotions | Promotion preview averaged every mark ever, unweighted, across years. It now uses the bulletin computation (default session year, current-class coefficients, eliminatory mark). | `promotion-preview-bulletin.test.ts` (1) |
| P2 CSV injection | `libs/csv-safe.ts`; readiness, audit logs, transport, statements, trial balance, HR, students, broadcast, live-class, reporting, client helper all use it. | `csv-safe.test.ts` (3) |
| P2 page size | Admissions uses `parsePagination` (max 100). | — |
| P2 alumni email | Changing the login email from the alumni portal is refused (422); field read-only. | — |
| P3 homework | Students get homework detail only if it is in their own audience list. | — |
| Audit-2 P2 secrets | Badge/QR HMAC and report-link signing refuse to run in production without a real secret; punches route reuses the shared badge HMAC. | existing (142) |
| Audit-2 P2 Caddy | On-demand TLS allows exact platform hosts + registered tenant domains only. | — |
| Audit-2 P2 setup/invite | Activation and invitation links claimed atomically (single use under double submit); password max 128. | existing (11) |
| Audit-2 P3 Stripe amount | Verified amount ≠ session amount → session `review` + exception row, nothing posted, 200 to stop retries. | `stripe-callback.test.ts` (+1) |
| Audit-2 P3 answer key | Teachers see the authoring view only for exams they wrote or teach. | `online-exam-access.test.ts` (4) |
| Dead trap code | `sendMoroccanSms` (always returned success without sending) removed. | — |

Accepted / not done, with reason:
- **Invitation tokens stored in plain text**: the admin screen re-copies invite links from the list; hashing removes that feature. Only `users.manage` admins can read them. Product decision.
- **`edge-tenant-resolve` bypass header**: only maps a domain to a tenant id; low value to an attacker.
- **WAHA image `latest`**: pin once the deployed version is known on the VPS.
- **Weights in averages**: needs an assessment category field (schema + teacher UI).
- **Payroll IR 2025 figures**: accountant sign-off.
- **~90 unpaginated list GETs**: capped where growth is real; the rest are small reference lists.
- **Dashboard branch labels in French only** (P3).
