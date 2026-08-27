# Defect and Risk Register (2026-08-26)

Findings discovered during this audit session. **Not exhaustive** — see the
limitations section of `00-AUDIT-INDEX.md` for what was never examined.

Severity per the prompt's scale. Confidence reflects how directly the finding
was proven.

---

## D-1 — Page authorization uses two competing sources of truth (drift generator)

| Field | Value |
|---|---|
| Severity | **P1 High** |
| Confidence | High |
| Category | Security / architecture |
| Module | Cross-cutting (all dashboard pages) |
| Roles affected | All non-admin roles |

**Evidence:** 226 of 295 guarded dashboard pages gate on a hardcoded
`allowedRoles` array; only 69 gate on `requiredCapability`. The sidebar
(`src/libs/api/portal-manifest.ts`) computes visibility purely from capability.

**Impact:** For those 226 pages, nav visibility and page access are derived from
two unsynchronised sources. A permission change updates the nav but not the page,
producing "visible link → redirected home" defects. This already happened in
production-adjacent testing on 2026-08-26, generating a batch of user-reported
failures across Students, Guardians, Attendance, Academics and Transport.

**Root cause:** `requireServerPage`'s `allowedRoles` option predates the
capability system; pages were never migrated.

**Remediation:** Migrate the 226 pages to `requiredCapability`. `page-guard.ts`
already supports capability-only guarding (`allowedRoles` is now optional).
Consider a lint rule banning new `allowedRoles`-only pages.

**Regression test required:** For every nav item in the manifest, assert that
each role which can *see* it can also *open* it (and vice versa).

---

## D-2 — Tenant-isolation checker reports false confidence

| Field | Value |
|---|---|
| Severity | **P1 High** |
| Confidence | High |
| Category | Security / testing |

**Evidence:** `scripts/check-tenant-isolation.ts` prints
`✅ All API queries reference tenantId` and exits 0. Reading it
(`check-tenant-isolation.ts:62-85`) shows it is a line-oriented regex heuristic with
these blind spots:

1. **`db.insert` is never scanned** — line 62 matches only `select|update|delete`.
   An insert writing a client-supplied `tenantId` passes silently.
2. It only checks that the *token* `tenantId` (or `tenants`) appears within a
   ~50-line lookback window — **not** that the query is filtered by it, and not
   that it derives from the session.
3. Three whole route trees are allowlisted with zero checking:
   `super-admin`, `auth`, `waitlist` (lines 6-10).
4. Five further routes bypass via `SELF_SCOPED` (lines 15-21).

**Impact:** The green check is treated as proof of tenant isolation but does not
establish it. This is worse than having no check, because it suppresses scrutiny.

**Mitigating fact:** Independent verification during this audit found **no**
actual client-supplied `tenantId` outside super-admin routes, and all 21
super-admin routes are properly guarded. So no exploited instance was found —
the risk is future regressions passing unnoticed.

**Remediation:** Extend the scanner to `insert`; assert `tenantId` is bound from
`requireTenant(context)` rather than merely present; narrow the allowlists; or
replace with the runtime approach already proven in `tenant-isolation.test.ts`.

---

## D-3 — 75% of the test suite is silently inert without a database

| Field | Value |
|---|---|
| Severity | **P2 Medium** |
| Confidence | High |
| Category | Testing |

**Evidence:** With `schoolos-db` stopped: `Tests 5 failed | 438 passed | 1332 skipped (1775)`.
With it running: `1772 passed (1775)`. 1332 tests (75%) are gated behind a
DB-reachability check.

**Impact:** Any environment without a reachable Postgres silently loses three
quarters of its coverage — including the entire cross-tenant isolation suite,
the security regression suite, and all financial-arithmetic tests. In this
configuration the no-DB run *did* fail loudly (47 files errored), which limits
the danger; but a CI runner that provisions no DB and treats skips as passes
would report green with the security tests never having executed.

**Remediation:** Make DB availability an explicit hard precondition in CI (fail
fast if unreachable) rather than a per-test skip.

---

## D-4 — Test suite cannot exit 0 (vitest worker crash)

| Field | Value |
|---|---|
| Severity | **P2 Medium** |
| Confidence | High |
| Category | Reliability / CI |

**Evidence:** Full run with DB available: all 1772 executing tests pass, yet
`TEST_EXIT=1` due to
`[vitest-pool]: Worker forks emitted error / Worker exited unexpectedly`.

**Impact:** No CI gate can be built on `npm run test` — it never returns success
even when everything passes. Teams typically respond by ignoring the exit code,
which then hides real failures.

**Suspected cause (unproven):** resource exhaustion. The same machine suffered a
thermal shutdown and a Docker daemon hang under parallel Node load earlier the
same day. Not confirmed — could equally be a specific test leaking a handle.

**Remediation:** Reproduce with `--pool=threads` / reduced `maxWorkers` to
isolate; identify the crashing file via `--reporter=verbose`.

---

## D-5 — Shared endpoints leak privileged fields to lesser-privileged roles

| Field | Value |
|---|---|
| Severity | **P1 High** (pattern), instances found were fixed |
| Confidence | High |
| Category | Privacy / access control |

**Evidence (all three found and fixed 2026-08-26, pre-audit):**

| Route | Leaked to | Field |
|---|---|---|
| `GET /api/students?id=` | `teacher` | `payments[]`, `balanceDue` |
| `GET /api/academics/classes/roster` | `teacher` | per-student `balanceDue` |
| `GET /api/students/parents/[id]/payments` | `teacher` (via `guardians.read`) | full household payment history |

**Root cause:** endpoints designed for `school_admin`'s response shape, later
opened to narrower roles by adding the role to the allowlist — without trimming
the payload. Authorization was checked at the *route* level, never at the *field* level.

**Why this stays P1 despite the fixes:** only routes surfaced by manual user
testing were examined. **The remaining ~780 API routes were not swept for this
pattern.** The three found were found by a user clicking around, not by
systematic review.

**Remediation:** Systematic review of every route whose role allowlist contains
more than one role, checking response shape per role. Consider per-role response
serializers rather than ad-hoc field deletion.

**Regression test required:** Per-role response-shape assertions on shared endpoints.

---

## D-6 — The application is effectively French-only; the trilingual layer is a stub

| Field | Value |
|---|---|
| Severity | **P1 High** (for a Moroccan-market product claiming FR/AR/EN) |
| Confidence | High |
| Category | i18n / UX |

**Evidence:**

- `locales/{fr,ar,en}.json` contain **51 keys each**, across only four
  namespaces: `Common`, `Navigation`, `Roles`, `Status`.
- **0 of 354** feature components under `src/features` call `useTranslations` or
  `getTranslations`.
- 34 component files contain hardcoded French UI strings
  (`'Ajouter'`, `'Modifier'`, `'Supprimer'`, `'Enregistrer'`, `'Annuler'`, …).

**Impact:** Visiting `/ar/...` or `/en/...` renders a **French** interface.
For Arabic the layout direction *does* flip correctly
(`src/app/[locale]/layout.tsx:30` sets `dir={isRTL ? 'rtl' : 'ltr'}`), producing
RTL-mirrored French text — arguably worse than not offering Arabic. Arabic is a
first-language requirement in the target market.

**Nuance:** the i18n *infrastructure* is correctly wired (next-intl, locale
routing, RTL direction). Only the content layer is missing. The remediation is
large but mechanical.

**Remediation:** Treat as a dedicated workstream, not a bug fix. Extract strings
per module, starting with the highest-traffic role surfaces.

---

## D-7 — Migration chain was unrunnable on a clean database (FIXED during audit window)

| Field | Value |
|---|---|
| Severity | **P0 Critical** (as it stood), now resolved |
| Confidence | High — verified by execution |
| Category | Data integrity / deployability |

**Evidence:** `drizzle-kit migrate` against an empty database failed. Two causes:

1. **19 migration files existed on disk but were absent from
   `migrations/meta/_journal.json`** (`0118`–`0136`), so drizzle skipped them
   entirely — silently omitting Stripe billing columns, `processed_stripe_events`,
   `addon_definitions`, `plan_limits`, `student_photos`, `teacher_availability`,
   `tenant_invitations`, `academic_readiness_snapshots`, and others.
2. `0127_alumni_request_pipeline.sql` used an enum value in the same transaction
   that added it — Postgres rejects this
   (`unsafe use of new value ... must be committed before they can be used`).

**Impact as it stood:** any fresh deployment produced a **structurally incomplete
database**. This was not hypothetical — it broke the production VPS deployment
on 2026-08-26 and required manual schema patching to complete.

**Resolution (verified):** journal repaired, offending backfill removed. Then
proven by execution against a genuinely empty throwaway Postgres:
all **138 migrations applied cleanly**, producing 432 tables. Diff against the
known-good schema showed one intentional difference (`sms_templates`, correctly
dropped by `0123`, still present in the older dev DB).

**Residual risk:** the local dev database predates the fix and still carries
`sms_templates`. Dev environments are not schema-identical to a fresh install.

---

## D-8 — Secrets file was world-readable on a shared multi-tenant host (FIXED)

| Field | Value |
|---|---|
| Severity | **P1 High** (as it stood), now resolved |
| Confidence | High |
| Category | Security |

**Evidence:** `~/schoolos-app/.env` on the production VPS was mode `644`,
readable by any local user. That host also runs four unrelated production
applications (`fes-tawsil`, `wenaya`, `epioso-cms`, `telegrambot`).

**Contents at risk:** `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`.

**Resolution:** `chmod 600`, verified `-rw-------`.

**Residual:** secrets were transmitted and written by an automated deployment
step. If any other operator account exists on that host, treat both values as
potentially disclosed and rotate.

---

## D-9 — Production host is materially under-resourced (operational risk)

| Field | Value |
|---|---|
| Severity | **P2 Medium** |
| Confidence | High |
| Category | Reliability |

**Evidence:** VPS has 1935 MB RAM total; observed 88 MB free / 638 MB available
with ~1 GB of swap in use, while hosting SchoolOS **plus** four other production
applications. During deployment the host became completely unreachable — SSH
timed out at banner exchange and the Docker API returned HTTP 500 — requiring an
out-of-band reboot from the cloud console.

**Contributing factor:** `schoolos-clamav` alone holds ~474 MB resident (24.5% of
host RAM), the largest single consumer.

**Impact:** Deploying SchoolOS can take down unrelated client services on the
same host. Partner testing is exposed to the same fragility.

**Remediation:** Move SchoolOS to its own host, or add RAM, before partner
testing scales. If ClamAV upload scanning is not required for the pilot,
disabling it recovers ~25% of host memory immediately.

---

## D-10 — No database backups exist

| Field | Value |
|---|---|
| Severity | **P0 Critical** (for real data) / P1 while synthetic-only |
| Confidence | High |
| Category | Data integrity / Reliability |

**Evidence (production VPS, 2026-08-26):**
```
crontab -l | grep -i 'backup\|dump'  →  NO_BACKUP_CRON
ls ~/backups                          →  NO_BACKUP_DIR
grep -rln "pg_dump\|backup" scripts/ infra/  →  no backup tooling in repo
```

**Impact:** The entire database — students, guardians, invoices, payments,
grades, attendance, documents — lives in a single Docker volume
(`schoolos_postgres_data`) on a host that became completely unreachable once
during this session (see D-9) and required an out-of-band reboot. There is no
mechanism to recover from volume loss, corruption, accidental `DROP`, or a bad
migration. Loss would be total and permanent.

**Why this is severity-split:** with synthetic seed data the practical impact is
re-running `db:seed:full`. The moment one real student record exists, this
becomes P0 and is an absolute blocker.

**Remediation:** scheduled `pg_dump` → off-host storage → retention policy →
**and a practised restore drill**. An unrestored backup is a hypothesis, not a
backup. Effort: S. See Gate 3 in `12-PRODUCTION-READINESS-ROADMAP.md`.

---

## D-11 — Error tracking installed but never configured

| Field | Value |
|---|---|
| Severity | **P1 High** |
| Confidence | High |
| Category | Reliability / Observability |

**Evidence:** `@sentry/nextjs ^10.53.1` is declared in `package.json`, but:
- no `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`
- `Sentry.init` appears nowhere
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` referenced nowhere in `src`

The dependency is installed and entirely unused.

**Impact:** production has no error capture. There is no general health endpoint
(only `super-admin/health` and one addon's), no uptime monitoring, no alerting,
and no structured logging (`pino`/`winston` both absent). The current mechanism
for detecting a production crash is *a user noticing and reporting it* — which is
literally how the `teacher` white-screen crash on the student detail page was
found during this session.

**Impact is amplified by partner testing:** partners will hit bugs, and without
capture those bugs are only as good as each partner's willingness to write them
up.

**Remediation:** add Sentry config + DSN; add a general health endpoint; add
uptime monitoring and alerting. Effort: S — the dependency cost is already paid.

---

## D-12 — `GET /api/search` has no role or capability gate

| Field | Value |
|---|---|
| Severity | **P1 High** (P0 once real student/guardian data exists) |
| Confidence | High |
| Category | Security / Privacy — broken access control |
| Found | 2026-08-26, during verification of Agent Wave 1 (see doc 14) |

**Evidence:** `src/app/api/search/route.ts:10-11`
```ts
const context = await requireRequestContext(request);   // no role allowlist
const tenantId = requireTenant(context);                // no requireCapability
```

No `requireCapability` call exists anywhere in the file. Every authenticated
role in the tenant — `student`, `parent`, `alumni`, `guard`, `librarian`,
`receptionist`, `teacher` — reaches it. It backs the global header search and is
therefore reachable from every page.

**What it returns:**

| Data | Location |
|---|---|
| Every student's name, email, matricule | `route.ts:29-48` |
| Every teacher's name, email, matricule | `route.ts:51-70` |
| Invoice number, **`netAmount`**, status | `route.ts:73-87` |

**Impact:** a student or parent can enumerate the entire school roster and read
other families' invoice amounts. This is broader than D-5's three original leaks,
which at least gated on `students.read` / `guardians.read`. Under Law 09-08 this
is a personal-data exposure.

**Live in production** at `https://schoolos.epioso.com` (synthetic data only at
time of writing).

**Remediation:** add `requireCapability`; scope student/teacher results to what
the caller may see; remove invoice results entirely for roles without
`finance.read`. Effort: S.

**Why it matters beyond the fix:** D-5's remediation sweep did not find this. It
took ~15 minutes of sampling untouched routes. It is direct evidence that the
D-5 sweep was not performed at the required depth — see
`14-AGENT-WAVE-1-VERIFICATION.md`.

---

## D-13 — Parent role had no ownership check on attendance-excuse data (IDOR)

| Field | Value |
|---|---|
| Severity | **P0 Critical** — worse than D-12: unrestricted read/write of another family's data by an unprivileged role |
| Confidence | High |
| Category | Security — Insecure Direct Object Reference (broken access control) |
| Found | 2026-08-27, sampling untouched routes during T1–T6 execution |
| Status | **Fixed and verified same day** |

**Evidence:** `src/app/api/attendance/excuses/route.ts`

`GET` had a scoping branch for `student` (forced to `context.userId`) but **none
for `parent`** — it fell into the generic `else if (studentIdParam)` branch:
```ts
if (context.role === 'student') {
  conditions.push(eq(attendanceExcuses.studentId, context.userId));
} else if (studentIdParam) {          // parent lands here, unchecked
  conditions.push(eq(attendanceExcuses.studentId, studentIdParam));
}
```
Two failure modes: (1) pass **any** `studentId` query param — no verification
the caller is that student's guardian — and read that child's excuse
reason/document, which routinely contains medical or personal detail; (2) omit
the param entirely — **no filter applied at all**, returning every student's
excuses tenant-wide to any parent account.

`POST` had the matching flaw: `body.studentId` was trusted unconditionally for
every non-student role, letting a parent submit a fabricated excuse under
another family's child.

**Why this ranks above D-12:** D-12 (`/api/search`) leaked names/emails/invoice
amounts. This leaked (and allowed forging) individual medical/personal excuse
records for children the caller has no relationship to, and required zero
guessing — omitting one query parameter was enough.

**Fix:** added `getGuardianChildIds(tenantId, guardianUserId)`, resolving the
parent's actual children via `guardians.userId → guardianStudents`, server-side,
never from client input. `GET` now scopes to that set (or denies a
mismatched `studentId`); `POST` now 403s if `body.studentId` isn't in it.

**Verified both directions**, per this project's now-standing rule that a
check isn't proven until seen failing on broken input and passing on fixed
input:
```
Original code:  3 of 4 new tests FAIL (cross-family read, forged excuse both succeed)
Fixed code:      4 of 4 PASS
Revert of test file confirmed byte-identical to pre-change state.
```
Test: `src/app/api/__tests__/attendance-excuses-idor.test.ts`

**Residual work:** this route is one of 334 multi-role call sites; only ~2%
have been reviewed (see D-5, T5). D-13 was found by sampling, not by a
completed sweep — treat its discovery as evidence the sweep is not done, not
as evidence the remaining 98% is clean.

---

## Severity summary

*Updated 2026-08-27 after independent verification + execution of Wave-2 tasks
T1–T4 (T5 partial, T6 correctly withheld pending owner authorisation).*

| Severity | Open | Fixed | Total |
|---|---|---|---|
| P0 Critical | 1 (D-10, for real data) | 2 (D-7, **D-13**) | 3 |
| P1 High | 2 (D-6, D-11) | 5 (D-8, D-1¹, **D-2**², **D-5**³, **D-12**⁴) | 7 |
| P2 Medium | 2 (D-4⁵, D-9) | 1 (D-3) | 3 |
| P3 Low | 0 | 0 | 0 |

¹ **D-1 fixed** 2026-08-26 — 203 pages migrated, 23 correct exceptions,
capabilities verified sound. Its regression test was rewritten 2026-08-27 (T2)
to import `FULL_NAVIGATION` and assert exact nav↔page capability equality —
proven both directions (catches an injected mismatch by name; passes clean).
Recurrence is now genuinely guarded.
² **D-2 fixed** 2026-08-27 (T3) — checker now catches client-supplied `tenantId`
in inserts (proven by injection) **and** exits 0 on the clean tree (the
`guardian/me/children/.../overview` false positive is resolved). Residual,
self-disclosed limit: cannot prove a tenant value's *provenance* (a hardcoded or
filter-dropped `tenantId` that's still lexically present passes) — this is the
honestly-stated boundary of a static heuristic, not a hidden gap.
³ **D-5 still only ~2% swept** (7 of 334 call sites) — listed under "Fixed" only
for the 7 confirmed-and-corrected routes; the sweep itself remains open. **D-13
was found by sampling the unswept remainder** — treat that as a signal the
other ~98% has not been reviewed, not as evidence it is clean.
⁴ **D-12 fixed and verified** 2026-08-27 (T1) — per-role capability gating
added to `/api/search`; proven both directions (4/5 assertions fail against the
original code, 5/5 pass against the fix).
⁵ **D-4 not reliably fixed.** The original 5 cross-tenant-isolation timeouts are
genuinely gone (absent across 3 consecutive full runs). But `npm run test` is
still not exit-0-reliable: run 1 and 2 passed (1794, then 1799 tests), run 3
failed with 3 **new** assertion failures in
`src/features/finance/__tests__/payment-allocation.test.ts` (expected 409, got
500 on overpayment rejection) — confirmed flaky (passes 2/2 in isolation, fails
under full-suite concurrency), not a deterministic regression. The underlying
DB-contention issue under `pool: 'threads'` at full parallelism was patched for
one symptom, not resolved at the root; it resurfaced in a different file.

No P3 findings are recorded — not because none exist, but because this audit
never performed the UX/accessibility/polish review that surfaces them.

---

## 2026-08-27 addendum — T1–T6 execution report

Full detail: `15-WAVE2-T1-T6-EXECUTION-REPORT.md`. One-line summary per task:

| Task | Result |
|---|---|
| T1 (D-12) | ✅ Fixed & verified both directions |
| T2 (parity test) | ✅ Fixed & verified both directions |
| T3 (isolation checker) | ✅ Fixed per stated scope; residual limit self-disclosed |
| T4 (suite exit 0) | ❌ Not reliably achieved — 2/3 consecutive runs, new flaky failure |
| T5 (field-leak sweep) | ⚠️ Still ~2% (7/334); found + fixed **D-13** during sampling |
| T6 (rotate VPS secrets) | ⛔ Correctly withheld — requires your explicit authorisation |

**D-10 and D-11 were added on 2026-08-26 after the initial register was written**,
while grounding `12-PRODUCTION-READINESS-ROADMAP.md`. They are notable because
the original audit was code-focused and therefore structurally blind to
operational gaps: no amount of repository review surfaces "there are no backups."
This is itself a finding about audit scope — a code audit is not an operational
readiness review.
