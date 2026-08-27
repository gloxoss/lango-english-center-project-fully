# SchoolOS — Production Readiness Roadmap (2026-08-26)

Companion to `01-EXECUTIVE-STATUS.md` and `11-DEFECT-AND-RISK-REGISTER.md`.
This document answers two questions: **why the current verdict is what it is**,
and **what stands between here and production**.

---

# PART 1 — Why "Partially functional, not for real data"

## The verdict is not mainly about the 9 findings

It would be easy to read the defect register and conclude "fix these 9 things and
we're done." That is not what the verdict says.

The audit verified **structure**: does authentication resolve correctly, are
routes guarded, is tenancy scoped, do migrations apply, do tests pass. Structure
came out **good** — better than typical for this stage.

The audit did **not** verify **behaviour**: whether anything actually works.

- No screen was ever opened.
- No workflow was executed end to end.
- No student was enrolled, no attendance marked, no invoice paid, no grade
  entered, no report card generated, no academic year rolled over.
- ~780 of 788 API routes were never exercised.

So the honest statement is not "the app has 9 problems." It is:
**"the app has 9 known problems and an unmeasured number of unknown ones,
because the part that would find them was never run."**

That distinction is the whole verdict.

## The three specific disqualifiers for real data

A school entrusting SchoolOS with real students, guardians, and money is
trusting three properties. Today, none of the three is established.

### 1. Nothing can be restored if it is lost

**Verified on the production VPS on 2026-08-26:** no backup cron, no backup
directory, no dump tooling anywhere in the repo.

```
crontab: NO_BACKUP_CRON
~/backups: NO_BACKUP_DIR
```

The database lives in a single Docker volume on a 2 GB shared VPS that **already
became completely unreachable once during this session** and required an
out-of-band reboot. If that volume is lost or corrupted, every student record,
invoice, payment, and grade is gone permanently.

This alone disqualifies real data, independent of any code quality question. It
is also the cheapest thing on this entire roadmap to fix.

### 2. Nobody would know if it broke

`@sentry/nextjs` is in `package.json` — but **no Sentry config exists** (no
`sentry.*.config.ts`, no `SENTRY_DSN` referenced anywhere in `src`). The
dependency is installed and unused.

There is no general health endpoint, no uptime monitoring, no alerting, no log
aggregation. The only health routes are `super-admin/health` and one addon's.

Concretely: the white-screen crash that hit `teacher` on the student detail page
was discovered because **a human clicked it and reported it**. In production,
with real schools, that is the entire detection mechanism.

### 3. Two defect *generators* are still active

Most findings are individual bugs. Two are patterns that keep producing bugs:

- **D-1** — 226 pages gate on hardcoded roles while navigation gates on
  capability, with nothing keeping them in sync.
- **D-5** — shared endpoints return the admin-shaped payload to narrower roles.
  Three financial-data leaks to `teacher` were confirmed. **All three were found
  by a user clicking around, not by review.** ~780 routes remain unswept.

D-5 is the one that matters for real data: the failure mode is a teacher seeing a
family's payment history. Under Moroccan Law 09-08 that is a personal-data
incident, not a UI bug.

## What the app *is* ready for

Supervised partner testing with synthetic data — exactly its current use.
Partners can evaluate scope, workflows, and UX, and their feedback is genuinely
the fastest way to find the behavioural unknowns. Nothing below should block
that; it is already deployed and working at `https://schoolos.epioso.com`.

---

# PART 2 — The roadmap

Six gates. Each has an explicit exit criterion. **A gate is not passed because
work was done — it is passed when its criterion is demonstrably true.**

Effort is relative (S / M / L / XL), not calendar time, because I have no
knowledge of team capacity.

---

## GATE 0 — Where you are today

| Property | Status |
|---|---|
| Architecture, permission model, tenancy design | Sound |
| 1772 automated tests | Passing |
| Migration chain on a clean DB | Fixed and verified |
| Deployed with HTTPS + security headers | Live |
| Behaviour | **Unverified** |
| Operations (backup, monitoring, alerting) | **Absent** |
| Compliance posture | **Unassessed** |

---

## GATE 1 — Stop the bleeding *(prerequisite for everything else)*

Goal: the codebase stops generating new defects of known classes, and the tools
that are supposed to catch problems can be trusted.

> **Status after Agent Wave 1 (verified 2026-08-26 — see
> `14-AGENT-WAVE-1-VERIFICATION.md`): 3 of 5 tasks complete. Gate NOT passed.**

| # | Task | Finding | Effort | Status |
|---|---|---|---|---|
| 1.1 | Migrate pages to `requiredCapability` | D-1 | L | ✅ **Done** — 203 migrated, 23 correct exceptions, capabilities verified |
| 1.1b | Parity test must compare page capability **against nav permission** | D-1 | S | ❌ **Rework** — current test never imports the nav manifest; cannot detect drift |
| 1.2 | Sweep multi-role API routes for field leaks | D-5 | L | ⚠️ **~1.5% done** — 5 of 334 sites; **D-12 found in the remainder** |
| 1.3 | Fix the tenant-isolation checker | D-2 | M | ⚠️ **Improved, gate RED** — catches real violations (proven), but false-positives on clean tree |
| 1.4a | DB as hard test precondition | D-3 | M | ✅ **Done** — verified live |
| 1.4b | Suite exits 0 | D-4 | M | ❌ **Not achieved** — exit 1; 5 timeouts now in the isolation suite |
| 1.5 | Rotate world-readable VPS secrets | D-8 residual | S | ⬜ Not started |
| **1.6** | **Fix `/api/search` — unauthorised roster + invoice exposure** | **D-12** | **S** | 🔴 **New — urgent** |

**Measured baseline after Wave 1:**
```
npx tsc --noEmit  → exit 0   ✅
npm run test      → exit 1   ❌   Tests 5 failed | 1781 passed (1786)
check-tenant-isolation → exit 1 ❌ (false positive on clean tree)
```
Pass count 1781 vs 1772 baseline (+9, Agent 2's new tests). No regressions.

**Rework queue** — see doc 14 §"Required rework" for R1–R5.
**Do 1.6 first.** It is an unauthenticated-in-effect endpoint exposing the full
roster and invoice amounts to every logged-in user, live in production.

**Exit criterion (unchanged, none yet met in full):**
- `npm run test` exits **0** — verified over **three consecutive runs**, not one.
- `check:isolation` exits **0** on a clean tree **and** has been *observed
  failing* on injected violations. Both halves required.
- Running with the DB down fails fast. ✅ *met*
- The parity test **fails** when a page's capability diverges from its nav
  permission. Prove it by deliberately introducing a mismatch.
- Every route reviewed in 1.2 is listed — reviewed-and-clean counts, not just fixed.

---

## GATE 2 — Prove it actually works *(the largest genuine unknown)*

Goal: convert "we believe it works" into "we have executed it."

This is the gate the audit could not perform, and the one most likely to change
your understanding of where the product stands.

| # | Task | Effort |
|---|---|---|
| 2.1 | Execute the full school-year lifecycle end to end on a clean tenant: provision → configure → import users/students/guardians → classes/subjects/timetable → enrolment → fees → attendance → grading → report cards → year close → rollover | L |
| 2.2 | Per-module behavioural verification: for each module confirm server-side persistence, authorization, validation, error paths, and downstream effects — replacing the structural inventory with a real one | XL |
| 2.3 | Build the E2E suite. `test:e2e` and Playwright are configured but **zero test files exist**. Cover the critical paths from 2.1 | L |
| 2.4 | Financial correctness tests: partial payments, overpayment, duplicate submission, concurrency/idempotency, rounding, reconciliation | M |
| 2.5 | Grading correctness tests: coefficients, averages, rounding, missing grades, boundary values, report-card consistency | M |
| 2.6 | Import/export hardening: malformed CSV, duplicates, CSV formula injection, oversized files, partial-commit vs all-or-nothing | M |

**Why 2.4 and 2.5 are called out separately:** an access-control bug shows a
wrong screen; an arithmetic bug silently produces wrong money and wrong grades,
and schools will not catch it until a parent disputes an invoice or a transcript.

**Exit criterion:** the full lifecycle in 2.1 has been executed at least once
against a clean database with every step's persistence verified — and a written
record exists of what passed, what failed, and what is not implemented.

---

## GATE 3 — Operational readiness *(disqualifiers for real data)*

Goal: data can survive a failure, and failures are noticed by someone other than
a user.

| # | Task | Effort | Note |
|---|---|---|---|
| 3.1 | **Automated database backups** — scheduled `pg_dump`, off-host storage, retention policy | S | ✅ Done (T7) — cron-scheduled, drill-verified 2026-08-27. **Gap:** backups still land on the same VPS as the DB, not off-host yet — see `docs/runbooks/restore-database.md` |
| 3.2 | **Practise a restore.** An unrestored backup is a hypothesis, not a backup | S | ✅ Done (T7) — restored into a throwaway container, exact row-count match across 5 tables |
| 3.3 | Configure Sentry — it is installed but never wired; add `SENTRY_DSN` + config | S | ✅ Done (T8) — wired through `docker-compose.yml` + VPS `.env`; deliberately did not add the webpack plugin (see `15-WAVE2-T1-T6-EXECUTION-REPORT.md`-adjacent T8 notes) |
| 3.4 | General health endpoint + uptime monitoring + alerting | S | ✅ Health endpoint done (T8, pre-existing + verified). Alerting/uptime monitoring itself not yet configured — no external monitor is watching `/api/health` |
| 3.5 | Move SchoolOS off the shared VPS, or add RAM | M | Analysis done (T10, see `16-T10-HOSTING-OPTIONS-ANALYSIS.md`); **not executed** — awaiting owner decision |
| 3.6 | Decide whether ClamAV is needed for pilot (frees ~25% of host RAM) | S | Analysis done (T10) — only 2 real consumers (`attachments/asset-service.ts`, `guard/incidents-service.ts`), narrower blast radius than assumed; recommendation given in `16-T10-HOSTING-OPTIONS-ANALYSIS.md`; **not executed** — awaiting owner decision |
| 3.7 | Structured logging with retention | M | No `pino`/`winston` present |
| 3.8 | Documented deploy + rollback procedure | S | ✅ Done (T9) — `docs/runbooks/deploy.md`, including an honest no-image-versioning / no-tested-down-migration gap |

**Exit criterion:** you can lose the production host entirely and restore
service, with data, from backups — **and you have actually done it once as a drill**.

Items 3.1–3.4 are the highest value-per-effort on this entire roadmap. They are
mostly S-effort and they remove two of the three real-data disqualifiers.

---

## GATE 4 — Compliance and data lifecycle *(legal gate, not engineering)*

Goal: holding Moroccan student and guardian data is defensible.

| # | Task | Effort |
|---|---|---|
| 4.1 | CNDP / Law 09-08 assessment — **needs legal input, not engineering judgment.** The audit deliberately made no compliance claim | M |
| 4.2 | Resolve data residency. Production is currently on a Tencent VPS; verify whether that satisfies your obligations | S (decision) |
| 4.3 | Data-subject rights: export and deletion for a student/guardian on request | M |
| 4.4 | Retention policy: how long are attendance, grades, invoices, messages, documents kept | M |
| 4.5 | Verify audit-log coverage of sensitive actions (`recordAudit` is widely used — confirm it covers what regulators would ask about) | M |
| 4.6 | Guardian consent model for SMS and data processing | M |
| 4.7 | Historical-data immutability across year rollover — closed periods must not be silently mutable | M |

**Exit criterion:** a written, legally-reviewed position on what data is held,
where, for how long, on what basis, and how a subject exercises their rights.

**Do not let engineering answer 4.1.** The audit explicitly refused to make a
compliance claim, and so should any agent.

---

## GATE 5 — Product completeness for a real pilot

Goal: a paying school is not blocked by gaps mid-year.

| # | Task | Finding | Effort |
|---|---|---|---|
| 5.1 | i18n extraction across 354 components — `/ar` and `/en` currently render **French** | D-6 | XL |
| 5.2 | Arabic RTL verification with real Arabic content (direction already flips correctly) | D-6 | M |
| 5.3 | Accessibility pass: contrast, focus, keyboard, screen-reader names, touch targets | — | L |
| 5.4 | Responsive verification, prioritising **teacher attendance marking on a phone** | — | M |
| 5.5 | Seed history for librarian/guard/receptionist/alumni portals (they authenticate but appear empty) | — | M |
| 5.6 | Close the 7 unbuilt + 6 partial items in `BUCKET-4-CURRENT-STATE.md` | — | L |
| 5.7 | Resolve the 5 product decisions in `13-DECISIONS...md` (role scope, parent portal, brand, hosting, ClamAV) | — | S (decisions) |
| 5.8 | Performance under realistic volume — never tested | — | M |

**On 5.1:** the i18n *infrastructure* is correct (next-intl wired, locale
routing works, RTL direction flips). Only the content layer is missing, so this
is mechanical extraction rather than re-architecture — but it is 354 components,
hence XL. For a Moroccan-market product, Arabic is not optional polish.

**Sequencing note:** run 5.1 **alone**. It touches every component and will
collide with any concurrent work — which is why it was excluded from the
three-agent wave.

---

## GATE 6 — Production operations *(before the second school)*

| # | Task | Effort |
|---|---|---|
| 6.1 | CI/CD pipeline running the full gate (types, lint, tests, isolation check, build, migrate-from-clean) | M |
| 6.2 | Staging environment matching production | M |
| 6.3 | Tenant onboarding runbook — provisioning a new school should be repeatable, not bespoke | M |
| 6.4 | Support process: how a school reports a problem and how it is triaged | S |
| 6.5 | Incident response: who is paged, what the rollback is | S |
| 6.6 | Load/capacity testing for multi-school scale | M |
| 6.7 | Consolidate product truth into one dated `PRODUCT-TRUTH.md` (C-1, C-5) | M |

**On 6.7:** the audit's central task — comparing intended vs actual — was
**impossible** because all 15 referenced product documents are absent and ~20
undated overlapping working notes exist instead. Until one authoritative document
exists, every future audit has the same blind spot.

---

# Recommended order

Not strictly sequential — but these dependencies are real:

```
GATE 1 (stop bleeding) ──┬──> GATE 2 (prove it works)
                         │
GATE 3 (ops) ────────────┘   ← start 3.1–3.4 NOW, in parallel; they are S-effort
                                and remove real-data disqualifiers

GATE 4 (compliance) ← start 4.1 legal conversation early; it has external lead time

GATE 5 (completeness) ← informed by partner feedback; run 5.1 alone

GATE 6 (operations) ← before onboarding school #2
```

**If you do only four things next** *(revised after Wave 1)*:

1. **Fix `/api/search`** (1.6 / D-12) — S effort, hours. An endpoint that lets any
   logged-in student read the full roster and other families' invoice amounts is
   live right now. Nothing else on this list outranks it.
2. **Automated backups + a practised restore** (3.1, 3.2) — S effort, removes the
   single largest real-data disqualifier.
3. **Configure Sentry** (3.3) — S effort, and it means partner-testing bugs get
   captured automatically instead of depending on someone reporting them.
4. **Wave 1 rework** (R1–R5 in doc 14) — finish the three incomplete tasks before
   starting new work, so the gates you rely on actually hold.

Items 1–3 are days of work, not months, and move the verdict materially.

### A method lesson worth institutionalising

Wave 1's three gaps — a parity test that never imports the nav manifest, a sweep
covering 1.5% of its surface, a checker failing on clean code — were **all**
reported-complete work that did not hold. Each took minutes to disprove by
*running* something rather than reading a summary.

This is now the third instance of the same pattern in this project (D-2's
rubber-stamp checker, D-3's silently-skipping suite, Wave 1). Bake it into the
definition of done:

> **A check is not done until it has been observed failing on a deliberately
> broken input, and passing on a clean one.** Both halves. Every time.

---

# What changes the verdict

| Verdict | Requires |
|---|---|
| `Partially functional` (today) | — |
| `Beta candidate` | Gate 1 complete + Gate 3.1–3.4 (backups, restore drill, Sentry, monitoring) |
| `Pilot-ready with conditions` | + Gate 2 lifecycle executed + Gate 4 legal position + Arabic if the pilot school needs it |
| `Production-ready` | + Gate 5 + Gate 6, and a defect register with no open P0/P1 |

**Realistic near-term target: `Beta candidate`.** It is achievable with Gate 1
(already dispatched) plus four small operational tasks, and it is the point at
which a friendly pilot school with real-but-low-stakes data becomes defensible.

---

# Two findings added by this document

These emerged while grounding the roadmap and were **not** in the original
register. They should be added to `11-DEFECT-AND-RISK-REGISTER.md`:

**D-10 — No database backups exist (P0 for real data).**
Production VPS: no backup cron, no backup directory, no dump tooling in the repo.
Single Docker volume on a host that already became unreachable once. Total
unrecoverable loss is a single-volume failure away.

**D-11 — Error tracking installed but not configured (P1).**
`@sentry/nextjs ^10.53.1` is a dependency, but no `sentry.*.config.ts` exists and
`SENTRY_DSN` is referenced nowhere in `src`. Production has no error capture; the
current detection mechanism for crashes is a user noticing and reporting.

Both are S-effort. Both are in Gate 3.
