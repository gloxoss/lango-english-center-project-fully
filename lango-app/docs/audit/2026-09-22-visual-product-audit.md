# SchoolOS Visual Product Audit — worked-on pages

Date: 2026-09-22 · Reviewer mode: code-evidence audit (no runtime screenshots supplied) · Scope: pages touched in commits `ade5e02..f010a54` plus the uncommitted working tree (98 files, ~19.7k lines added).

Page order for all 321 pages: `~/.claude/skills/SchoolOS-Visual-Product-Auditor-Pack/references/page-sequence.md`.

## 1. Executive diagnosis

The worked-on pages are broadly moving in the right direction: the students list, admissions, transfers, schedule, and dashboard now read real tenant-scoped data, and the dashboard handles loading and errors without fake zeros.

But **three pages tell the school something untrue**, and one of them is the director's home page:

- The **dashboard counts refunded payments as collected, and draft and credited invoices as invoiced/overdue**. The director sees wrong money.
- **Exam planning (`/dashboard/academics/exams`) shows mock exams** when a school has none, with invented staff names ("Mme Khadija Bennani") and the same 8 students seated in every exam.
- **Grading policy (`/dashboard/academics/grading/policies`) says "saved successfully" but writes only to the browser's localStorage.** Nothing reaches the server or report cards.

Two shared-code problems also affect many pages: **add-on page gating never runs** for any locale-prefixed URL (all dashboard URLs are), and **super admins can enter any school's data through a browser cookie with no audit record**.

No page can be ACCEPTED yet: every verdict below is from code, and acceptance needs runtime screenshots (desktop, phone, Arabic RTL).

## 2. What works

- Dashboard summary API: every query filters `tenantId`, joins `user.tenantId`, and validates the requested branch against the caller's branch server-side (`src/app/api/dashboard/summary/route.ts:63-86`).
- Dashboard view shows a loading state and a real error state instead of zeros (`src/features/dashboard/ui/dashboard-view.tsx:84-98`).
- Students KPI counts now computed across all students, not the current page (`5ed4be0`).
- Placement commit is transactional and refuses over-capacity sections (`src/app/api/students/placements/auto/route.ts:798-808`).
- Previously flagged mock playgrounds (schedule, personnel, excel import, transfers) were moved to `future-implementation/_archived-ui`.

## 3. Remaining issues

### P0 — must fix before acceptance

**P0-1 · Dashboard finance totals are wrong** (`/dashboard`)
- Evidence: `src/app/api/dashboard/summary/route.ts` filters payments with `status != 'reversed'`, but the enum is `posted | reversed | refunded` (`src/models/Schema.ts:28`), so **refunded payments count as collected**. Invoices filter only `status != 'cancelled'`, so **draft and credited invoices count as invoiced** (lines ~205-211, ~306-312). Overdue uses `NOT IN ('paid','cancelled','draft')`, so **credited invoices count as overdue** (lines ~289-292, ~418-419).
- Why it matters: the director acts on collected / outstanding / overdue. Refunds inflate cash; drafts inflate billing; credited invoices create false chasing of families.
- Fix: collected = `status = 'posted'` only. Invoiced/overdue = `status IN ('pending','partial','overdue','paid')` for invoiced and `IN ('pending','partial','overdue')` + due date for overdue. Apply the same definitions to every finance query in this route (month, period chart, risk list, recent payments).

**P0-2 · Exam planning shows fabricated data** (`/dashboard/academics/exams`)
- Evidence: `src/features/academics/ui/exam-planning-client.tsx:30` seeds state with `MOCK_EXAMS`; line 57 returns `MOCK_EXAMS` when the API has no schedules. Lines 88-96 invent invigilators "M. Responsable de Salle" and "Mme Khadija Bennani". Line 73 invents `totalCandidates` (`currentStudents.length || 24`). Lines 75-86 seat the first 8 students of the whole school in every exam. Real supervisors are shown by raw `staffId`. Defaults `examDate '2026-06-22'` and invigilator `'M. Omar Alami'` are hardcoded.
- Why it matters: a new school sees exams it never created; staff names that do not exist appear on an official seating plan.
- Fix: remove `MOCK_EXAMS` entirely; empty API → real empty state with "Plan an exam" CTA. Candidates and seating from `exam_seats` for that exam only. Supervisors resolved to names via join. Form defaults empty.

**P0-3 · Grading policy is never saved to the server** (`/dashboard/academics/grading/policies`)
- Evidence: `src/features/grading/ui/assessment-policies-client.tsx:120-129` reads and `:188-198` writes `rules`, `passingScore`, `eliminatoryScore` to `localStorage('schoolos_grading_policy')`, then shows "Barème et seuils d'admission enregistrés avec succès."
- Why it matters: passing and eliminatory thresholds decide promotion. They differ per browser, vanish on another device, and never reach report cards or promotions. The success message is false.
- Fix: persist to a tenant-scoped (and academic-year-scoped) table via an API with `requireCapability`, Zod `.strict()`, `recordAudit()`. Report-card and promotion services must read it. Until then, the Save button must not claim success.

### P1 — operational correctness

**P1-1 · Add-on page gating never fires** (all add-on pages: transport, hostel, library, inventory, events, HR, workforce, cards, certificates, live class, broadcast, reports, website, branches)
- Evidence: `src/libs/api/page-guard.ts` normalizes with `currentPath.replace(/^\/[a-z]{2}(\/|$)/, '/$1')`. Middleware always redirects dashboard URLs to a locale prefix, and `/fr/dashboard/hostel` becomes `//dashboard/hostel`, which never matches `startsWith('/dashboard/hostel')`. Verified with node: prefixed paths → `false`.
- Why it matters: schools see modules they did not buy; the new guard gives a false sense of entitlement enforcement.
- Fix: strip the locale as `path.replace(/^\/(fr|ar|en)(?=\/|$)/, '')`. Add a unit test for `/fr/...`, `/ar/...`, `/en/...`. Also: redirecting a teacher/parent to `/settings/entitlements` sends them to a page they cannot open; redirect non-admins to their home with a message.

**P1-2 · Super admin enters any school without an audit trail**
- Evidence: `src/components/shared/header-tenant-switcher.tsx:70` sets `schoolos_active_tenant_id` client-side for 1 year. `src/libs/api/context.ts` then resolves that tenant and lets `super_admin` pass every route that allows `school_admin`. No `recordAudit()` on switch; no reason captured; no visible "you are inside School X" banner is guaranteed.
- Why it matters: Law 09-08 / CNDP. Platform staff reading minors' data must be logged per tenant.
- Fix: switch through a server route that validates the tenant, sets an httpOnly short-lived cookie (e.g. 8h), and writes an audit row (`actor`, `tenant`, `reason`, `time`). Mark audit rows written while impersonating. Show a persistent banner with an exit button.
- Related (P2): `page-guard.ts` then redirects super_admin to `/${locale}` on pages whose `allowedRoles` omit `super_admin`, while the API allows them. Pick one rule and apply it to both.

**P1-3 · Auto-placement "random" preview is not what gets committed** (`/dashboard/students/promotions`, `/dashboard/academics/promotions`)
- Evidence: `src/app/api/students/placements/auto/route.ts:369` shuffles with `Math.random()` on every request; `dryRun` and commit are separate requests.
- Why it matters: the director approves one distribution and a different one is saved.
- Fix: commit must apply the exact previewed assignments (send the preview's assignment list or a preview id + seed), and reject if the roster changed since preview.

**P1-4 · Scanner roster count is capped by page size** (`/dashboard/attendance/scanner`)
- Evidence: `src/features/attendance/ui/attendance-scanner-playground.tsx:131-144` sets `classRosterCount = json.data.length` from a paginated `/api/students` call.
- Why it matters: "scanned X of Y" is wrong for any section larger than one page, so absentees look present-complete.
- Fix: use the API's `total` (or a count endpoint) for the roster.

### P2 — usability / maintainability

- **Silent fetch failures show as empty data**: `student-detail-view.tsx:475`, `matricules-view.tsx:105`, `attendance-scanner-playground.tsx:128,144`, `assessment-policies-client.tsx:98,108,118`, `events-calendar-client.tsx:143`, `employee-directory-view.tsx:103`, `sms-reminders-view.tsx:196`. Each `.catch(() => {})` must set an error state with retry.
- **Dashboard finance follows the student's current branch** (`userBranchFilter` on `user.branchId`), not the branch that issued the invoice. After a transfer, history moves campuses. Decide the rule and document it.
- **Money summed as `::float`** in the dashboard route. Use numeric and format at the edge to avoid cent drift.
- **Collection desk family banner** (`finance/collection-desk/page.client.tsx`): hardcoded French strings, `ml-2` instead of `ms-2` (breaks RTL), emoji as icon.
- Dashboard branch fallback labels are hardcoded French ('Toutes les succursales', 'Campus Principal').

### P3 — polish
- Exam date strings forced to `fr-FR` regardless of locale in `exam-planning-client.tsx`.

## 4. Report vs runtime contradictions

| Claim (commit / UI) | Evidence | Verdict |
|---|---|---|
| "Schedule builder … 100% real database data" family of claims | Exams page next door still serves `MOCK_EXAMS` | Contradiction for the academics area |
| Grading policy "enregistrés avec succès" | Only `localStorage.setItem` | Contradiction |
| Add-on guard in `page-guard.ts` | Regex never matches locale-prefixed paths | Contradiction |
| `.ultraplan/STATE.md` "30/30 tasks, deployed and verified" | P0-1..3 exist in the tree; ~98 files uncommitted | Status overstated |

## 5. Visual / UX judgment

Not assessable without screenshots. Code shows the students list and dashboard use bounded lists (`limit(5)`, `limit(6)`, `limit(10)`), which is right. Hardcoded hex colors (`#2487B8`, `#16212B`) appear inline in new code instead of design tokens; check against `05_UI_UX_DESIGN_SYSTEM_AND_TOKENS.md` during the screenshot pass.

## 6. Code / business judgment

Tenant filtering in the reviewed APIs is consistent. The risk is not leakage between schools, it is **wrong truth inside one school**: money definitions, invented exam data, and a policy that never persists. Typecheck and tests were not run in this audit.

## 7. Coding-agent prompt (copy-paste)

```
Precision correction pass. Do NOT redesign any page. Preserve current layouts of the dashboard, students list, admissions, transfers, schedule, and exam-planning UI. Fix only the items below.

1. Dashboard finance definitions — src/app/api/dashboard/summary/route.ts
   - Collected = payments.status = 'posted' only (refunded and reversed excluded).
   - Invoiced = invoices.status IN ('pending','partial','overdue','paid'). Exclude draft, cancelled, credited.
   - Overdue = status IN ('pending','partial','overdue') AND due_date < today.
   - Apply to EVERY finance query in the route (month totals, period chart, risk list, recent payments).
   - Sum money as numeric, not ::float.
   - Add tests: a refunded payment is not collected; a draft invoice is not invoiced; a credited invoice is not overdue.

2. Exam planning — src/features/academics/ui/exam-planning-client.tsx and data/exam-planning-config.ts
   - Delete MOCK_EXAMS and every invented value (Khadija Bennani, Responsable de Salle, Omar Alami, 24, '2026-06-22', 'Salle principale', 'Session Régionale', '08:00 - 10:00').
   - Empty API => real empty state with a "Planifier une épreuve" CTA.
   - Candidates and seating from exam_seats for that exam only. Supervisors resolved to staff names server-side.
   - Missing values show "—" or "À définir", never a made-up default.

3. Grading policy persistence — src/features/grading/ui/assessment-policies-client.tsx
   - Remove localStorage. Persist rules, passingScore, eliminatoryScore per tenant + academic year through an API following the pipeline: requireRequestContext -> requireTenant -> requireCapability -> Zod .strict() -> tenant-scoped Drizzle -> recordAudit.
   - Report-card and promotion services must read the stored policy. Test that.
   - Success toast only after a 2xx from the server.

4. Add-on gating — src/libs/api/page-guard.ts
   - Strip locale with /^\/(fr|ar|en)(?=\/|$)/ -> ''. Unit test /fr, /ar, /en paths for hostel, library, workforce.
   - Non-admin roles blocked by an add-on go to their own home, not /settings/entitlements.

5. Super-admin tenant switch
   - Server route validates tenant, sets httpOnly cookie (8h max), writes recordAudit(actor, tenant, reason).
   - Audit rows written while impersonating are marked as such.
   - Persistent "Vous êtes dans <École>" banner with exit.
   - Make page-guard and requireRequestContext agree on whether super_admin may open school_admin pages.

6. Placement preview = commit — src/app/api/students/placements/auto/route.ts
   - Commit must apply exactly the previewed assignments (preview id or submitted assignment list + roster hash). Reject with 409 if roster changed.

7. Scanner roster count — attendance-scanner-playground.tsx
   - Use total count from the API, not data.length of a page.

8. Replace every `.catch(() => {})` listed in docs/audit/2026-09-22-visual-product-audit.md §3 P2 with a visible error + retry.

Return, with evidence (not "fixed"):
ACTIVE SCOPE:
ACTIVE ACADEMIC YEAR:
INVOICED (month / year):
COLLECTED (month / year):
REFUNDED EXCLUDED AMOUNT:
OUTSTANDING:
OVERDUE COUNT / AMOUNT:
EXAMS PAGE WITH ZERO SCHEDULES: (screenshot)
GRADING POLICY AFTER RELOAD IN A SECOND BROWSER: (screenshot)
/fr/dashboard/hostel WITH HOSTEL ADDON OFF: (where it redirects)
AUDIT ROW AFTER SUPER-ADMIN SWITCH: (row)
typecheck + tenant-isolation check + new tests output.
Screenshots: /dashboard, /dashboard/academics/exams, /dashboard/academics/grading/policies at desktop, 390px phone, and Arabic RTL.
```

## 8. Acceptance gate

| Page | Verdict |
|---|---|
| `/dashboard` | NEEDS CORRECTION (P0-1) |
| `/dashboard/academics/exams` | BLOCKED (P0-2) |
| `/dashboard/academics/grading/policies` | BLOCKED (P0-3) |
| `/dashboard/students/promotions`, `/dashboard/academics/promotions` | NEEDS CORRECTION (P1-3) |
| `/dashboard/attendance/scanner` | NEEDS CORRECTION (P1-4) |
| All add-on pages | NEEDS CORRECTION (P1-1, shared) |
| Other worked-on pages (students list/detail, admissions, transfers, parents, classes, sections, schedule, exam-master, homework, marksheet, collection desk, events, HR employees, domains, entitlements, super-admin pages) | Code passes this audit except the P2 items; **pending screenshot gate** |

Next page after corrections: stay on Wave 1, `/dashboard`, then `/dashboard/students`.

---

## 9. Cross-check of correction pass 1 (2026-09-22, code evidence only, no screenshots)

| Claim | Code evidence | Verdict |
|---|---|---|
| P0-1 finance definitions | `src/libs/finance/definitions.ts` (posted only; pending/partial/overdue/paid; overdue = owed + past due) imported by the dashboard route; no `!= 'reversed'` left | Confirmed |
| P0-2 exam mocks removed | No `MOCK_EXAMS`, no invented names or defaults in the exams client. Remaining "Omar Alami / Khadija Bennani" live only in unrouted dead configs (`class-subjects-config.ts`, `class-section-teachers-config.ts`) | Confirmed; delete dead configs |
| P0-3 grading policy server-side | `/api/academics/grading-policies` with role, capability, `.strict()`, `recordAudit`; no localStorage | Confirmed. Note: tenant-wide, not per academic year. Changing it mid-year retroactively changes last year's promotion math |
| P1-1 add-on gate | `page-guard-path.ts` strips `/(fr|ar|en)`; wired into page-guard | Confirmed |
| P1-2 super-admin switch audited | httpOnly 8h cookie, `impersonate_start/end` audit, writes flagged | **Partial.** `context.ts:97-113` still accepts `x-tenant-id` header and `?tenantId=` for super_admin, which bypasses the audited switch (no start row, no 8h limit). Reads of student data that way leave no trace |
| P1-3 preview = commit | `rosterFingerprint` + 409 `ROSTER_CHANGED` + exact assignments applied | Confirmed (legacy commit without assignments still re-randomizes; OK if only scripts use it) |
| P1-4 scanner total | uses `json.total` | Confirmed |
| Scanner truthfulness (agent's own flag) | `attendance-scanner-playground.tsx:184,300-302,458-460` set `smsDispatched: true` and "Tuteur légal (SMS notifié)" without sending anything | **New P1**: staff are told parents were notified when they were not |
| "18 TS errors all pre-existing at HEAD" | My run before this pass had 6. The 4 in `students/route.ts:68-72` and 8 in `src/scripts/*` are new since then | Minor contradiction; errors are harmless null-checks, but types still aren't a deploy gate |
| Test suite 2323/2329 | 4 failures are "flaky" tenant-isolation tests | **Not acceptable as flaky.** A tenant-isolation test that fails intermittently must be diagnosed, not waived |

Security audit P0s (`2026-09-22-full-app-security-logic-audit.md`) are **all still open**: WAHA QR (`waha/qr/route.ts:7,20-22`), exam answer key (`questions/route.ts:31-33`), Stripe callback (`callback/route.ts:34`), payroll IR. Expected, since that prompt wasn't sent yet.

### Gate
- `/dashboard`, `/dashboard/academics/exams`, `/dashboard/academics/grading/policies`: **code ACCEPTED, pending screenshot gate.**
- `/dashboard/attendance/scanner`: NEEDS CORRECTION (fake SMS notice).
- Super-admin switch: NEEDS CORRECTION (header/query bypass).

### Precision prompt (pass 2), send together with §5 of the security audit
```
Do not touch anything accepted in pass 1. Fix only:
1. src/libs/api/context.ts + server-context.ts: super_admin tenant comes ONLY from the httpOnly cookie set by /api/super-admin/tenant-context. Remove the x-tenant-id header and ?tenantId= overrides for super_admin (custom-domain x-tenant-id stays for non-super users). Test: super_admin with ?tenantId=X and no cookie -> tenantId null.
2. attendance-scanner-playground.tsx: never claim an SMS was sent. smsDispatched only true when the API confirms a delivery row; otherwise show "Notification non envoyée". Guardian name from real data or "—".
3. Diagnose the 4 intermittent tenant-isolation test failures. Root cause + fix, not retry.
4. Delete dead mock configs: class-subjects-config MOCK_ASSIGNMENTS, class-section-teachers-config MOCK_TEACHERS, homework-submission-config, MOCK_HOUSEHOLDS, MOCK_STUDENTS, MOCK_CHAPTERS, MOCK_SCALES (render real scale instead) and their unrouted clients.
5. Fix the 18 TS errors, then remove NEXT_IGNORE_TYPES=1 from the Dockerfile so type errors block deploy.
Then do docs/audit/2026-09-22-full-app-security-logic-audit.md §5 in its stated order (WAHA first).
Return: output of check:types (0), check:isolation, the isolation tests run 5x in a row, and the WAHA/answer-key/Stripe evidence lines.
```
