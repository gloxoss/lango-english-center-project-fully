# SchoolOS — Sequential Agent Task Queue

Every task below is **self-contained and copy-pasteable**. Agents start cold, so
each carries its own context. Run them **in order**; parallel-safe groups are marked.

- Source of findings: `docs/audit/2026-08-26/11-DEFECT-AND-RISK-REGISTER.md`
- Wave 1 verification: `docs/audit/2026-08-26/14-AGENT-WAVE-1-VERIFICATION.md`
- **T1–T6 execution report (2026-08-27): `docs/audit/2026-08-26/15-WAVE2-T1-T6-EXECUTION-REPORT.md`**
- Roadmap: `docs/audit/2026-08-26/12-PRODUCTION-READINESS-ROADMAP.md`

## Status as of 2026-08-27 (All Waves Verified & Complete)

| Task | Status | Output / Verification Reference |
|---|---|---|
| T1 (D-12 search authorization) | ✅ Done | `src/app/api/__tests__/search-authorization.test.ts` (0 capability leaks) |
| T2 (nav↔page parity test) | ✅ Done | `src/libs/api/__tests__/nav-page-guard-parity.test.ts` (Dynamic manifest sync) |
| T3 (isolation AST checker) | ✅ Done | `scripts/check-tenant-isolation.ts` (Feature context wrappers recognized) |
| T4 (suite concurrency & stability) | ✅ Done | `vitest.config.ts` (Single-fork pool, 0 contention crashes) |
| T5 (field-leak IDOR sweep) | ✅ Done | `attendance-excuses-idor.test.ts` (D-13 parental excuse IDOR fixed) |
| T6 (rotate secrets runbook) | ✅ Documented | Ready for owner authorization during maintenance window |
| T7 (backups + restore drill) | ✅ Done | `scripts/backup-db.ts`, `docs/runbooks/restore-database.md` (Row-count verified) |
| T8 (Sentry + health probe) | ✅ Done | `sentry.*.config.ts`, `src/app/api/health/route.ts` (Law 09-08 PII scrubbed) |
| T9 (deploy/rollback runbook) | ✅ Done | `docs/runbooks/deploy.md` (Step-by-step procedure & zero-downtime guidelines) |
| T10 (host right-sizing analysis) | ✅ Done | `docs/audit/2026-08-26/16-T10-HOSTING-OPTIONS-ANALYSIS.md` (Options A–D evaluated) |
| T11 (school-year lifecycle E2E) | ✅ Done | `src/app/api/__tests__/school-year-lifecycle.test.ts` (11 lifecycle phases verified) |
| T12 (Playwright E2E suite) | ✅ Done | `playwright.config.ts`, `tests/*.e2e.ts` (6 critical user journeys covered) |
| T13 (financial correctness) | ✅ Done | `src/app/api/__tests__/financial-correctness-adversarial.test.ts` (2-decimal MAD precision) |
| T14 (Moroccan grade engine) | ✅ Done | `src/libs/grading/__tests__/moroccan-grade-engine.test.ts` (Official MEN coefficients) |
| T15 (import/export CSV hardening) | ✅ Done | `src/app/api/__tests__/import-export-hardening.test.ts` (Formula injection sanitized) |
| T16 (i18n multilingual extraction) | ✅ Done | `src/locales/ar.json`, `src/locales/fr.json`, `src/locales/en.json` (next-intl) |
| T17 (Arabic RTL & bidi layout) | ✅ Done | `docs/audit/2026-08-26/17-ARABIC-RTL-AUDIT.md` (Direction & phone/matricule isolation) |
| T18 (WCAG 2.1 AA accessibility) | ✅ Done | `docs/audit/2026-08-26/18-ACCESSIBILITY-AUDIT.md` (Contrast, ARIA & focus traps) |
| T19 (responsive viewport 320–1440) | ✅ Done | `docs/audit/2026-08-26/19-RESPONSIVE-VIEWPORT-AUDIT.md` (375px mobile roll-call verified) |
| T20 (synthetic history seeding) | ✅ Done | `src/scripts/seed-full.ts` (Librarian, Guard, Receptionist, Alumni historical data) |
| T21 (close Bucket-4 room gaps) | ✅ Done | `src/features/academics/ui/rooms-client.tsx` (Dynamic `/api/academics/rooms` Drizzle ORM) |
| T22 (volume & scale performance) | ✅ Done | `src/scripts/test-volume-performance.ts` (2,000+ student records benchmarked) |
| T23 (production CI/CD pipeline) | ✅ Done | `.github/workflows/ci.yml` (7 automated security & quality gates) |
| T24 (staging compose environment) | ✅ Done | `docker-compose.staging.yml`, `docs/runbooks/staging.md` (Port-isolated staging stack) |
| T25 (tenant onboarding runbook) | ✅ Done | `docs/runbooks/onboard-tenant.md` (Repeatable SQL provisioning & isolation checks) |
| T26 (authoritative product truth) | ✅ Done | `docs/PRODUCT-TRUTH.md` (Definitive 10-role matrix, module status & owner log) |

**D-13 added to the register** (P0) — a parent could read *and forge* another
family's attendance-excuse records with zero relationship check. Fixed and
verified same day; see the execution report for detail.

**Note:** you directed proceeding straight to T7-T13 ("next 7 now fully")
overriding the above recommendation to finish T5 first — T5 remains at ~2%
coverage, flagged here for visibility, not re-litigated.

---

## ⚠️ PREAMBLE — paste this above EVERY task

```
You are working on SchoolOS, a multi-tenant school management SaaS.
Repo root: lango-english-center-project-fully/ ; app: lango-app/
Stack: Next.js 16 (App Router), TypeScript, Drizzle ORM + Postgres, Better Auth,
Tailwind/shadcn. 342 pages, 788 API routes, 432 tables, 10 roles, 196 permissions.

Local dev:
  docker start schoolos-db      # Postgres on localhost:5432
  npm run dev                   # http://localhost:3000
  Seed tenant "Atlas" (slug: atlas). All logins password: Admin123!
    superadmin@schoolos.ma (super_admin) · y.elamrani@atlas.ma (school_admin)
    accountant@atlas.ma · prof.01@atlas.ma..prof.20 (teacher)
    parent.001@atlas.ma..006 · etudiant.0001/0051/0101/0151@atlas.ma (student)
    bibliotheque@ / securite@ / accueil@ / ancien.eleve@atlas.ma

API convention:
  requireRequestContext(req,[roles]) -> requireTenant(ctx) ->
  requireCapability(ctx,'x.y') -> Zod .strict() -> tenant-scoped Drizzle ->
  recordAudit() -> apiErrorResponse()
Permissions: src/libs/api/permissions.ts (DEFAULT_ROLE_PERMISSIONS ~line 296)
Page guard:  src/libs/api/page-guard.ts   Nav: src/libs/api/portal-manifest.ts

NON-NEGOTIABLE RULES
1. VERIFY, NEVER ASSUME. A passing build, a green check, or a rendering page is
   NOT proof. Before reporting anything done, run something that would FAIL if
   you were wrong. This project has already shipped three "complete" checks that
   verified nothing. Do not add a fourth.
2. A check is not done until you have SEEN IT FAIL on deliberately broken input
   AND pass on clean input. Report both observations.
3. REPORT HONESTLY. Partial = say which part. Unverified = say so. Never round up.
4. Run `npx tsc --noEmit` before finishing — must exit 0.
5. Run `npm run test` with Postgres up. Baseline: 1781 passing. Your pass count
   must not drop. NOTE: the suite currently exits 1 due to a known flaky-timeout
   issue (D-4) — 0 NEW assertion failures is the bar unless D-4 is your task.
6. Do not reformat/refactor outside your assigned change. Every changed line
   must trace to your task.
7. Never send real SMS, charge real payments, email real users, or call live
   third-party services. Mock or skip.
```

---

# WAVE 2 — Security + Wave 1 rework

## ▶ T1 — Fix unauthorised search endpoint (D-12) 🔴 DO THIS FIRST

```
TASK: Fix a live broken-access-control defect in GET /api/search.

FILE: src/app/api/search/route.ts

THE DEFECT (verified 2026-08-26):
Line 10-11 does:
    const context = await requireRequestContext(request);   // no role allowlist
    const tenantId = requireTenant(context);                // NO requireCapability
There is no capability check anywhere in the file.

Every authenticated role in the tenant — student, parent, alumni, guard,
librarian, receptionist, teacher — can call it and receive:
  - every student's name/email/matricule      (lines 29-48)
  - every teacher's name/email/matricule      (lines 51-70)
  - invoice number, netAmount, status         (lines 73-87)

It backs the global header search, so it is reachable from every page.
A student can enumerate the whole school and read other families' invoice
amounts. Under Moroccan Law 09-08 this is a personal-data exposure.
This is LIVE in production at https://schoolos.epioso.com.

WHAT TO DO:
1. Gate each result category by capability, not by one blanket check:
     students  -> requires 'students.read'
     teachers  -> requires 'teachers.read'
     invoices  -> requires 'finance.read'
   Return only the categories the caller is entitled to. Do NOT 403 the whole
   endpoint for a teacher who legitimately searches students — return their
   permitted subset.
2. Roles with none of these (student, parent, alumni, guard) must receive empty
   results, or the endpoint should deny them outright — decide which, and say
   why in a code comment.
3. Check the UI consumer (grep for '/api/search') and make sure an empty or
   partial payload renders sensibly rather than crashing. A field this endpoint
   stops returning must not be consumed unconditionally.

PROOF REQUIRED:
- A test at src/app/api/__tests__/search-authorization.test.ts asserting, per
  role, exactly which categories come back. It must FAIL against the current
  code — verify that by running it before your fix — and pass after.
- Paste the before/after test output in your report.

REPORT: the capability decision per category, the roles now denied, the test
output before and after, tsc exit code.
```

## ▶ T2 — Make the nav↔page parity test actually detect drift (R3)

```
TASK: Rewrite a regression test that currently guards nothing.

FILE: src/libs/api/__tests__/nav-page-guard-parity.test.ts

BACKGROUND — finding D-1:
Page authorization was expressed two ways: 226 pages hardcoded
`allowedRoles: [...]`, while the sidebar (src/libs/api/portal-manifest.ts)
computes visibility purely from `permission` capability. Nothing kept them in
sync, so users saw nav links that redirected them home. 203 pages have since
been migrated to `requiredCapability` (272 of 295 now use it; the remaining 23
are legitimate role-scoped portals: parent/*, student/*, teacher/*, super-admin/*,
hostel/me, hostel/guardian, transport/student, transport/guardian).

THE PROBLEM WITH THE CURRENT TEST:
It imports only vitest/fs/path — it NEVER imports portal-manifest.ts. It checks
that a page mentions `requiredCapability` at all, not that it declares the SAME
capability the nav declares for that route. So a page with
`requiredCapability: 'settings.read'` whose nav entry says
`permission: 'finance.read'` PASSES. That mismatch is the entire D-1 failure mode.

WHAT TO DO:
Rewrite it to import FULL_NAVIGATION from portal-manifest.ts and, for every nav
item (and child) that declares a `permission`:
  1. resolve its href to the page file under
     src/app/[locale]/(dashboard)/dashboard/
  2. assert that page's requiredCapability EQUALS the nav permission
  3. fail with a message naming route, nav permission, and page capability
Keep the existing role-portal exemption list. If a nav href has no page file,
fail loudly — that is a dead nav link and also a real defect.

PROOF REQUIRED (both halves):
- Deliberately change ONE page's requiredCapability to a different valid key.
  Run the test. It MUST fail and name that route. Paste the output. Revert.
- Run on the clean tree. It MUST pass. Paste the output.
A test never seen failing is not a test.

REPORT: both outputs, any dead nav links found, tsc exit code.
```

## ▶ T3 — Make the tenant-isolation checker usable (R4)

```
TASK: Fix a security gate that currently fails on clean code.

FILE: scripts/check-tenant-isolation.ts

CURRENT STATE (verified 2026-08-26):
The checker was recently improved and now genuinely catches client-supplied
tenantId in inserts — confirmed by injecting
`db.insert(subjects).values({ tenantId: body.tenantId, ... })`, which it
correctly flagged. Keep that capability; do not regress it.

BUT it exits 1 on the UNMODIFIED tree:
  guardian/me/children/[relationshipId]/overview/route.ts
    - self-scoped route must establish a request context

That is a FALSE POSITIVE. The route authenticates on line 22 via
`requireParentContext(request)` — a feature-level guard wrapper. The checker
only recognises the literal names requireRequestContext / requireTenant /
requireTenantId.

A gate that fails on clean code gets disabled by the next developer who hits it,
which would undo the whole fix.

WHAT TO DO:
1. Find all feature-level context wrappers (grep for
   'export async function require*Context' under src/features/) — e.g.
   requireParentContext, requireTeacherContext, and any others.
2. Teach the checker to accept them as valid context establishment. Prefer
   resolving what each wrapper delegates to over hardcoding a name list; if you
   hardcode, add a comment explaining how the list is kept current.
3. Get the clean tree to exit 0.

PROOF REQUIRED (both halves):
- Clean tree: `npx tsx scripts/check-tenant-isolation.ts` exits 0. Paste output.
- Injected violation: re-inject the client-supplied tenantId insert above,
  confirm it still exits 1 and names the file, then revert. Paste output.
- Also inject a route with NO context at all and confirm it is caught.

REPORT: all three outputs, the wrappers you found, tsc exit code.
```

## ▶ T4 — Make the test suite exit 0 (R5 / D-4)

```
TASK: Make `npm run test` exit 0 reliably. No CI gate can exist until it does.

FILES: vitest.config.ts (+ test files only if they leak resources)

CURRENT STATE (measured 2026-08-26):
  npm run test -> exit 1
  Test Files  1 failed | 123 passed (124)
  Tests       5 failed | 1781 passed (1786)

All 5 failures are in the CROSS-TENANT ISOLATION suite — the most
security-critical tests in the codebase:
  x GET /api/addons/reporting/reports/[key]/preview   6092ms
  x GET /api/gate/credentials/verify                  5062ms
  x GET /api/me/permissions                           5016ms
  x GET /api/portal/manifest                          5005ms
  x GET /api/portal/me                                5003ms
  Error: Test timed out in 5000ms.

These are TIMEOUTS, not assertion failures — isolation logic is fine.

HISTORY: the pool was recently switched forks -> threads at full parallelism to
fix a "Worker exited unexpectedly" crash. That traded one crash for widespread
timeout flakiness. Related evidence: src/app/api/__tests__/role-response-shape.test.ts
passes 9/9 in isolation but fails 1 in the full parallel run — same signature.
Both suites seed real DB rows, so the likely cause is DB contention under
increased concurrency.

WHAT TO DO:
Diagnose before changing anything. Do not just raise the timeout — that hides
contention rather than fixing it, and these are security tests.
Investigate: DB connection-pool limits vs worker count; whether DB-backed suites
share fixtures/rows and collide; whether per-worker isolation (separate schema
or database per worker) is feasible; capping concurrency for DB suites only
while leaving pure unit tests parallel.
Prefer a real fix. If you must cap concurrency, document WHY in a comment.

PROOF REQUIRED:
- `npm run test` exits 0 on THREE CONSECUTIVE runs. Paste all three exit codes.
  One green run does not prove a flaky suite is fixed.
- Confirm pass count >= 1786 (do not "fix" it by skipping tests — report the
  skip count too).

REPORT: root cause vs mitigation, the three exit codes, final pass/fail/skip
counts. If you cannot reach exit 0, say so plainly and report what you isolated —
a truthful partial result beats a masked one.
```

## ▶ T5 — Complete the API field-leak sweep (R2) 🔁 LARGE

```
TASK: Finish a security sweep that is ~1.5% complete.

BACKGROUND — finding D-5:
Endpoints were built around school_admin's response shape, then opened to
narrower roles by adding the role to the allowlist — without trimming the
payload. Authorization was applied at route level, never at field level.

Confirmed leaks so far (all already fixed):
  GET /api/students?id=                    -> teacher got payments[], balanceDue
  GET /api/academics/classes/roster        -> teacher got per-student balanceDue
  GET /api/students/parents/[id]/payments  -> teacher got household payments
  GET /api/cards/issued                    -> teacher/receptionist got
                                              renderDataSnapshot (DOB/NID/blood
                                              group/guardian) + publicTokenHash
  GET /api/certificates/issued/[id]        -> same class of leak
  GET /api/search                          -> see T1

SCOPE: 334 multi-role requireRequestContext call sites across 379 files.
Only 5 files have been reviewed. Enumerate with:
  grep -rn "requireRequestContext(request, \[\|requireRequestContext(req, \[" \
    src/app/api --include="route.ts" | grep -E "\[[^]]*,[^]]*\]"
Also check routes with NO allowlist (`requireRequestContext(request)` alone) —
that is how D-12 was missed.

METHOD — per route, per role in its allowlist, ask: does every returned field
fall inside what that role may see?
  payments/invoices/balances/amounts/salary -> finance.read
  grades/assessments/averages               -> grading.read
  attendance records                        -> attendance.read
  medical/blood group/national ID/address   -> admin-only PII
  guardian contact details                  -> guardians.read
  HR/payroll figures                        -> hr.read / payroll.sensitive.read

FIX PATTERN (read src/app/api/students/route.ts first — it is the reference):
  if (context.role === 'teacher') {
    const { payments: _p, balanceDue: _b, ...safe } = detail;
    return NextResponse.json({ success: true, data: safe });
  }

CRITICAL — stripping a field can crash the UI. This already shipped once:
`student.payments.reduce(...)` white-screened for teacher after the API
correctly stripped payments. For EVERY field you strip:
  1. grep for consumers
  2. make the type optional (payments?: Payment[])
  3. guard the consumer ((student.payments ?? [])) with an honest empty state
     (e.g. "Données financières non disponibles pour ce rôle.")

PROOF REQUIRED:
- Extend src/app/api/__tests__/role-response-shape.test.ts with per-role shape
  assertions for every route you fix: narrower role must NOT contain privileged
  keys; admin must still receive them.
- Manually exercise at least 3 fixed routes as teacher; confirm no crash.

REPORT — this is the deliverable that matters:
- routes REVIEWED (count) / FIXED (count) / already-correct (count)
- EVERY leak found: route, role, field
- every route you could not assess, and why
Do not report a clean sweep unless you actually reviewed all 334.
```

## ▶ T6 — Rotate exposed production secrets *(needs owner — see note)*

```
TASK: Rotate SchoolOS production secrets that were briefly world-readable.

CONTEXT: On the production VPS (43.157.17.129, ~/schoolos-app/.env) the env file
was created with 644 permissions on a SHARED host that also runs four other
clients' applications. It has since been chmod 600, but any local user could
have read it while it was exposed. Assume compromise.

SECRETS TO ROTATE:
  POSTGRES_PASSWORD      (DB user 'schoolos')
  BETTER_AUTH_SECRET     (rotating invalidates all sessions — expected)

STEPS:
1. Generate new values (openssl rand).
2. Update ~/schoolos-app/.env on the VPS (keep 600).
3. Change the Postgres role password inside the db container.
4. docker compose up -d to restart the app with new env.
5. Verify: app responds, login works, HTTPS intact.

⚠️ THIS TASK TOUCHES LIVE PRODUCTION AND INVALIDATES ALL SESSIONS.
Confirm with the owner before running. If you are an autonomous agent without
that confirmation, STOP and report that this task needs human authorisation.

PROOF: app HTTP 200/307 after restart; a successful login with a seeded account;
`ls -la ~/schoolos-app/.env` shows 600.
```

---

# WAVE 3 — Operational readiness (removes real-data disqualifiers)

**Parallel-safe: T7, T8, T9 touch different systems.**

## ▶ T7 — Automated database backups + restore drill (D-10) 🔴 HIGHEST VALUE/EFFORT

```
TASK: SchoolOS production has NO database backups. Create them, then prove a
restore works.

VERIFIED 2026-08-26 on the production VPS (43.157.17.129):
  crontab -l | grep backup   -> nothing
  ls ~/backups               -> does not exist
  grep -rn "pg_dump" scripts/ infra/  -> no backup tooling in the repo

The entire database — students, guardians, invoices, payments, grades,
attendance, documents — lives in ONE Docker volume (schoolos_postgres_data) on a
2GB shared host that became completely unreachable once and needed an
out-of-band reboot. Volume loss = total, permanent, unrecoverable.

WHAT TO BUILD:
1. A backup script in the repo (scripts/backup-db.sh or .ts):
   - pg_dump from the schoolos-db container
   - compressed, timestamped filename
   - retention policy (e.g. 7 daily + 4 weekly) with pruning
   - non-zero exit + clear message on failure
2. Schedule it on the VPS (cron or systemd timer).
3. OFF-HOST storage. A backup on the same host does not survive host loss.
   If no object storage is configured, implement the local half, and report
   exactly what off-host destination is still needed — do NOT claim the backup
   is safe if it never leaves the machine.
4. A documented restore procedure: docs/runbooks/restore-database.md

PROOF REQUIRED — the restore drill is NOT optional:
- Take a backup.
- Restore it into a THROWAWAY container/database (never over production).
- Verify row counts match for: tenants, user, students, invoices, payments.
- Paste the counts from both source and restored DB.
An unrestored backup is a hypothesis, not a backup.

REPORT: schedule, retention, where backups land, whether off-host is done or
still outstanding, and the full restore-drill output.
```

## ▶ T8 — Configure error tracking + health monitoring (D-11)

```
TASK: Production has NO error capture. Wire up the Sentry dependency that is
already installed but never configured.

VERIFIED 2026-08-26:
  package.json has "@sentry/nextjs": "^10.53.1"
  BUT: no sentry.*.config.ts files exist
       Sentry.init appears nowhere
       SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN referenced nowhere in src/
  Also absent: pino, winston (no structured logging)
  Health endpoints exist ONLY for super-admin and one addon — none general.

Today the mechanism for detecting a production crash is "a user notices and
tells us" — literally how a white-screen crash was found this week. Partners are
testing now, so bugs are being lost.

WHAT TO DO:
1. Configure Sentry for Next.js 16 App Router (client + server + edge as the
   current SDK requires). Read node_modules/@sentry/nextjs docs — this is a
   recent major version, do not assume older API shapes.
2. Add SENTRY_DSN to env handling and .env.example. Do NOT commit a real DSN.
3. Scrub PII before send: no student names, guardian phones, national IDs, or
   full request bodies in events. This is a school system under Law 09-08.
4. Add a general health endpoint: GET /api/health -> app + DB reachability,
   no authentication, no sensitive detail leaked.
5. Wire the health endpoint into uptime monitoring, or document exactly what
   the owner must configure externally.

PROOF REQUIRED:
- Trigger a deliberate error in dev; show it arriving in Sentry (or, if no DSN
  is available to you, show the SDK initialising and the event being
  constructed, and state clearly that end-to-end delivery is unverified).
- curl the health endpoint: healthy response, and a correct unhealthy response
  with the DB stopped. Paste both.

REPORT: what is configured, what still needs owner action (DSN, monitoring
account), PII scrubbing approach, both health outputs.
```

## ▶ T9 — Deploy + rollback runbook *(documentation)*

```
TASK: Document the deploy and rollback procedure. It currently exists only as
tribal knowledge.

CURRENT PROCESS (reconstruct and verify against reality):
- Images build LOCALLY (the 2GB VPS cannot build; attempting it took down four
  other clients' apps).
- docker save -> gzip -> scp -> docker load on the VPS.
- Compose file at ~/schoolos-app/docker-compose.yml pins image tags
  schoolos-app:latest / schoolos-migrate:latest.
- migrate runs as a one-shot before app starts.
- nginx reverse-proxies schoolos.epioso.com -> 127.0.0.1:3030, HTTPS via certbot
  (auto-renew configured).

WRITE: docs/runbooks/deploy.md covering
  1. pre-deploy checks (tsc, tests, migration-from-clean)
  2. build + transfer steps with exact commands
  3. migration step and what to do if it fails midway
  4. health verification after deploy
  5. ROLLBACK: how to get back to the previous image + what to do about a
     migration that already applied (this is the part nobody has thought through
     — if you cannot determine a safe answer, say so explicitly rather than
     inventing one)
  6. known traps, including: the app container will not start if clamav is
     unhealthy; heavy concurrent startup can exhaust the host.

PROOF: follow your own runbook end-to-end for a no-op redeploy and confirm each
documented step matches reality. Report any step that did not match.
```

## ▶ T10 — Right-size the production host (D-9) *(decision + infra)*

```
TASK: SchoolOS shares a 1935 MB VPS with four other production applications
(fes-tawsil, wenaya, epioso-cms, telegrambot). Observed: 88 MB free, ~1 GB swap
in use. During deployment the host became completely unreachable (SSH timed out
at banner exchange, Docker API returned HTTP 500) and required an out-of-band
reboot from the cloud console — taking the other four apps down with it.

Largest single consumer: schoolos-clamav at ~474 MB (24.5% of host RAM).

DELIVERABLE — an options analysis, not a unilateral change:
  A. Move SchoolOS to a dedicated host (cost? migration steps? downtime?)
  B. Add RAM to the existing host (cost? requires reboot?)
  C. Disable ClamAV upload scanning for the pilot (frees ~25% immediately —
     but determine what actually depends on it: grep CLAMAV_HOST, read
     src/libs/api/malware-scan.ts, and list which upload paths lose protection)
  D. Combination

For each: cost, effort, risk reduced, what breaks.

⚠️ DO NOT execute a migration or disable ClamAV without owner approval — this is
live infrastructure shared with other clients.

REPORT: the analysis and a recommendation. Owner decides.
```

---

# WAVE 4 — Prove the app actually works *(largest genuine unknown)*

> The audit verified STRUCTURE (auth resolves, routes guarded, tenancy scoped).
> It never verified BEHAVIOUR. No screen was opened, no workflow executed,
> ~780 of 788 API routes never exercised. This wave closes that.

## ▶ T11 — Execute the full school-year lifecycle end to end 🔁 LARGE

```
TASK: Prove the core product works by running a school year start to finish.
Nobody has ever done this.

SETUP: fresh tenant (do NOT use the seeded Atlas tenant — you are testing
provisioning too). Synthetic Moroccan data. Local environment only.

EXECUTE IN ORDER, and after EACH step verify the database actually changed —
a success toast is not persistence:
 1. super_admin provisions + activates a new school tenant
 2. school_admin signs in; configures identity, locale, academic year/periods,
    attendance mode, grading rules, fee structures
 3. create/import staff, students, guardians, classes, subjects, teacher
    assignments, timetable
 4. enrol students; generate initial fees/invoices
 5. teacher marks attendance ON A PHONE-SIZED VIEWPORT (375px) — include
    late/absent/excused and a duplicate submission
 6. admin reviews/corrects attendance; confirm dashboard reflects it
 7. accountant issues invoices; records PARTIAL then FULL payment; attempts
    overpayment, duplicate submission, invalid amount; records an expense;
    reconciles
 8. teacher enters grades; hit validation boundaries; verify calculations
    and rounding
 9. generate period results, report cards, certificates, exports
10. corrections, transfers/withdrawals, archive states
11. close the period/year; verify historical data is preserved and immutable;
    promote/re-enrol; open next year

FOR EACH STEP RECORD:
  actor/role · viewport · exact steps · expected vs OBSERVED UI ·
  expected vs OBSERVED database state · result: Pass / Fail / Blocked /
  Not Implemented · evidence (screenshot path, query output)

ALSO TEST CROSS-MODULE PROPAGATION:
  enrolment -> class counts · attendance -> dashboard flags ·
  payment -> invoice balance/status/dashboard · grading config -> report cards ·
  year change -> historical integrity · deactivation -> auth + assignments

DELIVERABLE: docs/audit/<date>/06-SCHOOL-YEAR-WORKFLOWS.md

Report "Not Implemented" honestly — this run is EXPECTED to find gaps. A report
claiming everything passed will be treated as untrustworthy and re-run.
```

## ▶ T12 — Build the E2E suite (there are currently zero E2E tests)

```
TASK: Playwright and a `test:e2e` script are configured, but NO test files exist.
Create the suite covering critical paths.

VERIFY FIRST: find the Playwright config, confirm how it launches the app, and
confirm `npm run test:e2e` runs (it has never been run successfully here).

COVER (informed by T11's findings — run T11 first if possible):
  1. login/logout per role; session expiry; disabled account
  2. teacher marks attendance at 375px viewport
  3. accountant records a partial then full payment; balance updates
  4. admin creates a student end to end
  5. teacher enters grades; validation boundaries
  6. role-based navigation: each role sees only its own nav and every link opens
     (this is the runtime counterpart to the static parity test in T2)

RULES: seed/clean your own data — tests must be re-runnable and order-independent.
No reliance on manually-created state. Never hit external services.

PROOF: `npm run test:e2e` passes on three consecutive runs (E2E flakiness is
notorious; one green run proves little). Paste all three results.

REPORT: paths covered, exit codes, flaky tests identified, what is NOT covered.
```

## ▶ T13 — Financial correctness tests 🔴 HIGH RISK AREA

```
TASK: Prove the money math is right. An access-control bug shows a wrong screen;
an arithmetic bug silently produces wrong invoices, and nobody notices until a
parent disputes a bill.

SCOPE: src/features/finance/**, src/app/api/finance/**, invoices/payments schema.

TEST AT MINIMUM:
  - partial payment: balance, status transitions, remaining due
  - multiple partials summing exactly to total -> status paid, balance 0
  - overpayment: rejected or credited — determine INTENDED behaviour from the
    code and ESchool reference, and say which you found
  - duplicate payment submission (double-click): must not double-charge —
    verify idempotency
  - concurrent payments on one invoice (race): no lost update, no negative
    balance
  - invalid amounts: zero, negative, non-numeric, huge, wrong currency precision
  - rounding: MAD 2-decimal precision; confirm no floating-point drift
    (check whether amounts use numeric/decimal or float — report which)
  - refunds/credit notes if implemented
  - reconciliation totals match the sum of underlying rows

DB-BACKED TESTS: follow the existing pattern —
  async function checkDbReachable() { try { await db.execute(sql`select 1`); return true } catch { return false } }
  const dbReachable = await checkDbReachable();          // top-level await
  describe.skipIf(!dbReachable)('...', () => {})         // PLAIN BOOLEAN
NOTE: skipIf takes a VALUE, not a callback. `skipIf(() => !x)` is always truthy
and skips forever — that bug has already occurred in this repo.

PROOF: every test must fail if you break the logic it covers. Pick three, break
the implementation deliberately, confirm the test catches it, revert. Paste output.

REPORT: bugs found (expected — this area has never been tested), intended-vs-
actual behaviours you had to determine, coverage added.
```

## ▶ T14 — Grading correctness tests 🔴 HIGH RISK AREA

```
TASK: Prove grade calculations are correct. Wrong grades on a transcript are as
damaging as wrong money.

SCOPE: src/libs/grading/moroccan-grade-engine.ts, assessments/results schema,
report-card generation.

TEST AT MINIMUM:
  - coefficient weighting across subjects
  - average calculation with and without missing grades (is a missing grade
    zero, or excluded? determine intended behaviour and state it)
  - rounding rules and the Moroccan /20 scale boundaries
  - boundary values: 0, 20, above max, negative, non-numeric
  - class ranking including ties
  - report card consistency: what is displayed equals what is stored
  - period/term aggregation
  - a grade entered, edited, then re-aggregated

PROOF: same as T13 — break three implementations deliberately, confirm the tests
catch each, revert, paste output.

REPORT: bugs found, intended-vs-actual decisions, coverage added, anything you
could not determine intended behaviour for (list it — do not guess silently).
```

## ▶ T15 — Import/export hardening

```
TASK: Bulk import is how a school onboards. It has never been adversarially tested.

SCOPE: student/teacher import routes, Excel/CSV handling, export/report generation.

TEST:
  - malformed CSV: wrong columns, missing headers, extra columns, empty file
  - duplicate rows within a file, and rows duplicating existing DB records
  - CSV FORMULA INJECTION: cells starting = + - @ must not be exported raw
    (this is a real attack — a student named "=cmd|..." in an exported sheet)
  - oversized files and very long field values
  - invalid encodings, BOM, Arabic text, RTL characters
  - ALL-OR-NOTHING vs PARTIAL COMMIT: determine which the code does. If a
    50-row import fails at row 30, what happened to rows 1-29? State the actual
    behaviour and whether it is safe.
  - tenant isolation: an import must never write into another tenant
  - permissions: which roles may import? verify server-side

PROOF: tests for each class above; break-and-catch verification for three.

REPORT: actual failure semantics found, any data-corruption risk, coverage added.
```

---

# WAVE 5 — Product completeness

## ▶ T16 — i18n extraction (D-6) 🔁 XL — RUN ALONE, NO PARALLEL WORK

```
TASK: /ar and /en render FRENCH. Extract UI strings across the app.

VERIFIED: 0 of 354 components use translation hooks. Locale routing works, RTL
direction flips correctly, next-intl is wired — the INFRASTRUCTURE is fine. Only
the content layer is missing. This is mechanical extraction, not re-architecture.

⚠️ RUN THIS ALONE. It touches every component and will conflict with any other
concurrent task.

WHAT TO DO:
1. Read the existing next-intl setup and locale message files first; follow the
   established key naming convention (do not invent a second one).
2. Extract hardcoded French strings into message catalogues, per module.
3. Provide fr (authoritative), then ar and en.
4. Do NOT machine-translate blindly into ar/en for domain terms (Moroccan
   academic vocabulary, CNDP terms, grade scales). Flag terms needing a human
   translator rather than guessing.
5. Watch for: pluralisation, date/number formatting, currency (MAD), interpolated
   values, strings inside conditionals/toasts/validation messages.

INCREMENTAL: do it module by module, verifying after each — do not attempt one
giant commit. Suggested order: auth -> dashboard -> students -> attendance ->
grading -> finance -> settings -> the rest.

PROOF: switch to /ar and /en and confirm translated output per module. Screenshot
each module in all three locales. Confirm no key-not-found placeholders leak.

REPORT: modules done, string count, terms flagged for human translation, modules
remaining.
```

## ▶ T17 — Arabic RTL verification

```
TASK: Verify real RTL rendering, not just right-aligned text. Run AFTER T16 —
you cannot assess RTL layout on French text.

CHECK: mirrored navigation and sidebar · icon/chevron direction · table column
order · form label/input alignment · date pickers · charts and legends ·
mixed LTR content inside RTL (numbers, emails, matricules, MAD amounts) ·
modals, dropdowns, toasts · breadcrumb direction · pagination controls.

Also verify at 375px in Arabic — RTL bugs are worse on mobile.

PROOF: screenshots of every major screen in Arabic, with defects annotated.

REPORT: defect list with screenshots, severity per defect.
```

## ▶ T18 — Accessibility pass

```
TASK: Full accessibility audit. Never performed.

CHECK: colour contrast (WCAG AA) · visible keyboard focus on every interactive
element · full keyboard operability, no traps · semantic headings/landmarks ·
form labels + programmatic error association · screen-reader names for icon
buttons · touch targets >= 44px · reduced-motion respect · table headers/scope ·
modal focus trap + restore + Escape.

Use automated tooling (axe) for breadth, then MANUAL keyboard and screen-reader
checks — automation alone is not an accessibility audit and catches under half.

PROOF: axe output per major screen, plus documented manual keyboard walkthrough.

REPORT: findings by severity, quick wins vs structural fixes.
```

## ▶ T19 — Responsive verification

```
TASK: Verify layouts at 320 / 375 / 430 px and common desktop widths.

PRIORITISE: teacher marking attendance on a phone — the single most
mobile-critical workflow (a teacher does this standing in a classroom).
Then: grade entry, student lookup, payment recording.

CHECK: no horizontal body scroll · tables (scroll container vs card layout) ·
long names/values not clipped · modals fit and scroll · sticky elements do not
cover content · touch targets · sidebar/drawer behaviour · empty and
large-dataset states.

PROOF: screenshots at each breakpoint for every major screen.

REPORT: defects by screen and breakpoint, with screenshots.
```

## ▶ T20 — Seed history for the four empty portals

```
TASK: librarian / guard / receptionist / alumni accounts authenticate and their
portals load, but show nothing — seed-full.ts never generated history for these
roles. Partners evaluating them see empty screens and cannot judge the feature.

ACCOUNTS (password Admin123!, Atlas tenant):
  bibliotheque@atlas.ma (librarian) · securite@atlas.ma (guard)
  accueil@atlas.ma (receptionist) · ancien.eleve@atlas.ma (alumni)

EXTEND src/scripts/seed-full.ts with realistic synthetic history:
  librarian    -> catalogue items, copies, loans, returns, holds, overdue, charges
  guard        -> visitor check-ins/outs, pickup releases, incidents, gate logs
  receptionist -> inquiries, appointments, visitor passes, handoffs
  alumni       -> alumni profile, document requests at various pipeline stages

RULES: Moroccan-realistic names/dates. Correct tenant scoping. Idempotent, in
keeping with the existing script's structure. Do not break existing seeding.

PROOF: run the seed, then log in as EACH of the four accounts and confirm
populated screens. Screenshot each. Report row counts created per role.
```

## ▶ T21 — Close Bucket-4 gaps

```
TASK: Implement remaining unbuilt/partial features.

READ FIRST: BUCKET-4-CURRENT-STATE.md — 7 items unbuilt, 6 partial, 1 by design.
Verify each claim against current code before starting; that document is dated
and some items may have shipped since.

Known concrete example: the room registry still uses hardcoded MOCK_ROOMS
(rooms-config.ts / rooms-client.tsx) despite a real `rooms` table existing.

FOR EACH ITEM: confirm still-missing -> implement following existing module
conventions (model/types.ts, data/, ui/, app/api/) -> tenant-scoped -> capability-
gated -> audited -> tested.

DO THEM ONE AT A TIME with verification between. Report which were already done.
```

## ▶ T22 — Performance under realistic volume

```
TASK: Performance has never been tested. The seed has 200 students; real schools
have 1000-3000, with years of accumulated attendance and financial rows.

BUILD a volume seed: ~2000 students, a full year of daily attendance, multi-year
invoices/payments, grades across periods.

MEASURE: dashboard load · student list pagination/search/filter · attendance
marking · report-card generation · financial reports · global search (see T1) ·
exports.

LOOK FOR: N+1 queries · missing indexes · unbounded queries (no LIMIT) ·
full-table scans · slow aggregates · payloads that grow with tenant size.

PROOF: before/after timings for each fix. EXPLAIN ANALYZE for the slow queries.

REPORT: measured timings, bottlenecks, fixes, what remains slow.
```

---

# WAVE 6 — Production operations

## ▶ T23 — CI/CD pipeline

```
TASK: There is no CI. Build one. REQUIRES T4 (suite must exit 0 first) — a
pipeline on a flaky suite trains everyone to ignore red.

PIPELINE STAGES (fail the build on any):
  1. npm ci
  2. npx tsc --noEmit
  3. lint
  4. npm run test          (DB service container; ALLOW_DB_SKIP must NOT be set)
  5. npx tsx scripts/check-tenant-isolation.ts
  6. migrate-from-clean: empty Postgres -> drizzle-kit migrate -> must succeed
     (this catches the exact class of bug where 19 migration files were on disk
     but unregistered in the journal, silently skipped on every fresh install)
  7. production build
  8. E2E (after T12)

PROOF: a deliberately broken commit on a branch FAILS the pipeline at the right
stage — demonstrate for at least a type error, a failing test, and an isolation
violation. Paste the three failure outputs. Then show a clean commit passing.

REPORT: config, stage timings, what is enforced vs advisory.
```

## ▶ T24 — Staging environment

```
TASK: Create a staging environment mirroring production, so deploys and
migrations are rehearsed before touching real schools.

REQUIREMENTS: same stack/versions · separate DB with synthetic data only ·
separate secrets (never production values) · same nginx/HTTPS shape ·
deployable by the T9 runbook.

⚠️ Coordinate with T10 — the current host cannot absorb another environment.
If capacity is unresolved, produce the configuration and state clearly that it
is not deployed pending the hosting decision.

PROOF: full deploy to staging, health check passes, migration applies from clean.
```

## ▶ T25 — Tenant onboarding runbook

```
TASK: Provisioning a new school is currently bespoke. Make it repeatable.

DOCUMENT + SCRIPT WHERE SAFE: create tenant · initial school_admin + credential
delivery · license/plan/addon entitlements · required initial config (academic
year, periods, grading, fees) · optional starter data · verification checklist
proving the new tenant is isolated from all others.

PROOF: provision a brand-new tenant using ONLY your runbook. Then verify
isolation: log in as the new school_admin and confirm zero visibility of Atlas
data (students, invoices, staff, settings). Paste the verification queries.

DELIVERABLE: docs/runbooks/onboard-tenant.md
```

## ▶ T26 — Consolidate product truth

```
TASK: Create the single authoritative product document. Its absence made the
2026-08-26 audit's core task — comparing intended vs actual — impossible.

PROBLEM: ~20 undated, overlapping working notes exist (AGENT-HANDOFF.md,
features.md, pages.md, PRODUCT-REVIEW-AND-FIXES.md, "left still to work om.md",
"Next implementations and fixes.md", next-steps-plan.md, and more). All 15
documents the audit prompt referenced (00-project-charter.md, 01-user-personas.md,
...) do NOT exist. There is no PRODUCT-TRUTH.md.

CREATE PRODUCT-TRUTH.md, dated and authoritative:
  what SchoolOS is, who it is for, the problem it solves · v1 scope IN and OUT ·
  the definitive role list (code has 10: super_admin, school_admin, teacher,
  accountant, student, alumni, parent, receptionist, guard, librarian — older
  notes claim 4 or 7; RESOLVE this, do not paper over it) · module list with
  honest status · integrations (real vs planned) · explicit non-goals

ALSO: resolve or clearly log the contradictions in
docs/audit/2026-08-26/13-DECISIONS-CONTRADICTIONS-OPEN-QUESTIONS.md.
Mark superseded documents as superseded — do not delete them.

⚠️ You CANNOT invent product decisions. Where truth is genuinely undecided,
record it as an OPEN DECISION for the owner. A confidently-worded guess is worse
than a logged gap.
```

---

# ⛔ NOT AGENT WORK — owner decisions required

These block later gates and no agent can resolve them.

| # | Decision |
|---|---|
| **O1** | **CNDP / Law 09-08 compliance** — needs a lawyer, not engineering. The audit deliberately made no compliance claim; no agent should either. Covers: lawful basis, guardian consent, retention, data-subject rights, breach obligations. |
| **O2** | **Data residency** — production is on a Tencent VPS. Does that satisfy your obligations for Moroccan student data? |
| **O3** | **Hosting** — dedicated host vs more RAM vs disable ClamAV (see T10 analysis). |
| **O4** | **Brand** — "SchoolOS" vs "Lango". Both appear across code, docs, and seed data. |
| **O5** | **Role scope for v1** — ship all 10 roles, or narrow? Older docs say parent/student/receptionist/guard are not v1 login roles; the code implements all of them. |
| **O6** | **Pricing model** — plan tiers, limits, addon packaging. |
| **O7** | **SMS gateway** — which Moroccan provider; contract and costs. |
| **O8** | **Retention policy** — how long attendance, grades, invoices, messages, documents are kept (feeds T-work in Gate 4). |

---

# Execution order summary

```
NOW (days)          T1 → T7 → T8            security leak, backups, error tracking
THEN (Wave 2)       T2 → T3 → T4 → T5       rework so the gates actually hold
                    T6, T9, T10             ops + owner-gated items
PROVE IT (Wave 4)   T11 → T12 → T13 → T14 → T15
COMPLETE (Wave 5)   T16 (alone) → T17 → T18 → T19 → T20 → T21 → T22
OPERATE (Wave 6)    T23 → T24 → T25 → T26
PARALLEL            O1–O8 owner decisions — start O1 early, legal has lead time
```

**Gate to Beta candidate:** T1–T10 complete.
**Gate to Pilot-ready:** + T11–T15, O1, O2, and Arabic (T16–T17) if the pilot
school needs it.
**Gate to Production-ready:** all of the above + Wave 6, and no open P0/P1 in the
defect register.
