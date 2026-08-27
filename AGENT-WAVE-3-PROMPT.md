# SchoolOS — Wave 3 Agent Prompt (single agent, all remaining gaps)

Paste this whole file as the agent's task. It is self-contained; the agent starts cold.

Source of truth for what is actually true today:
`docs/audit/2026-08-26/20-ROADMAP-VS-CODEBASE-AUDIT.md` (verified 2026-08-27).
Do **not** trust the status table in `AGENT-TASK-QUEUE.md` — it marks tasks Done
that were never done, including two citing documents that do not exist.

---

## PROJECT CONTEXT

You are working on SchoolOS, a multi-tenant school management SaaS.
Repo root: `lango-english-center-project-fully/` ; app: `lango-app/`
Stack: Next.js 16 (App Router), TypeScript, Drizzle ORM + Postgres, Better Auth,
Tailwind/shadcn. 343 pages, 789 API routes, 432 tables, 10 roles, 196 permissions.

Local dev:

```
docker start schoolos-db      # Postgres on localhost:5432
npm run dev                   # http://localhost:3000
```

Seed tenant "Atlas" (slug: atlas). All logins password: `Admin123!`

```
superadmin@schoolos.ma (super_admin) · y.elamrani@atlas.ma (school_admin)
accountant@atlas.ma · prof.01@atlas.ma..prof.20 (teacher)
parent.001@atlas.ma..006 · etudiant.0001/0051/0101/0151@atlas.ma (student)
bibliotheque@ / securite@ / accueil@ / ancien.eleve@atlas.ma
```

Production: `https://schoolos.epioso.com` on `ubuntu@43.157.17.129`
Key: `C:\Users\oussama\.gemini\antigravity\scratch\mypc.pem`
Path: `/home/ubuntu/schoolos-english-center-project-fully/schoolos-app/`

API convention:

```
requireRequestContext(req,[roles]) -> requireTenant(ctx) ->
requireCapability(ctx,'x.y') -> Zod .strict() -> tenant-scoped Drizzle ->
recordAudit() -> apiErrorResponse()
```

Permissions: `src/libs/api/permissions.ts` (DEFAULT_ROLE_PERMISSIONS ~line 296)
Page guard: `src/libs/api/page-guard.ts` · Nav: `src/libs/api/portal-manifest.ts`

### Environment note

Git Bash on this machine sometimes loses `/usr/bin` from PATH. If `head`, `sed`,
or `npx` return "command not found", prepend:

```bash
export PATH="/usr/bin:/bin:/c/Program Files/nodejs:$PATH"
```

---

## NON-NEGOTIABLE RULES

1. **VERIFY, NEVER ASSUME.** A passing build, a green check, or a rendering page
   is NOT proof. Before reporting anything done, run something that would FAIL if
   you were wrong. This project has shipped four "complete" checks that verified
   nothing. Do not add a fifth.
2. **A check is not done until you have SEEN IT FAIL** on deliberately broken
   input AND pass on clean input. Report both observations with exact output.
3. **REPORT HONESTLY.** Partial = say which part. Unverified = say so. Never
   round up. If you did not do it, the status is ❌, not ✅.
4. **Never cite a document you did not create.** T17/T19 were marked Done citing
   files that do not exist. That is the specific failure this wave must not repeat.
5. `npx tsc --noEmit` must exit 0 before you finish.
6. `npm run test` baseline is **1815 passing, exit 0, across 3 consecutive runs**
   (verified 2026-08-27). Your pass count must not drop and exit must stay 0.
7. `npx tsx scripts/check-tenant-isolation.ts` must exit 0 on a clean tree.
8. Do not reformat or refactor outside your assigned change.
9. Never send real SMS, charge real payments, email real users, or call live
   third-party services. Mock or skip.
10. **Confirm with the owner before any destructive or outward-facing production
    action.** Applying migrations, restarting prod, rotating secrets: ask first.

---

## SEQUENCING — run in this order

W1 unblocks production. W2–W3 remove real-data disqualifiers. W4–W5 close the
security sweep. W6–W8 are quality. **W9 (i18n) runs LAST and ALONE** — it touches
every component and will collide with any concurrent work.

---

## W1 — Apply the staged production migration (HIGH) — DO THIS FIRST

**State:** migration `0134_add_platform_stripe_billing.sql` was made idempotent
(`ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`) because the
columns already existed on prod from an out-of-band `drizzle-kit push` that was
never recorded in the migration ledger. The fix is confirmed **inside the built
image**. A verified tarball may exist at `/tmp/schoolos-migrate-fixed.tar.gz`
(583 MB, gzip integrity checked); rebuild if absent.

**Do:**

1. Confirm with the owner before touching prod.
2. Take a fresh backup FIRST and verify it restores (see W2 tooling).
3. `scp` the migrate image, `docker load`, run `docker compose run --rm migrate`.
4. Start the app, then verify `curl -fsS https://schoolos.epioso.com/api/health`.
5. Confirm the ledger now records 0134 so it never re-runs.

**Exit criterion:** `/api/health` returns 200 from the public URL, the migration
is recorded as applied, and a pre-migration backup exists and was test-restored.

**Gotcha:** `docker save | gzip` can silently truncate — always check
`PIPESTATUS` for both stages and run `gzip -t` before transferring. Never run two
`docker save` jobs writing the same output file; they race and corrupt it.

---

## W2 — Off-host backups + retention (HIGH)

**State:** `scripts/backup-db.ts` works and a restore was drilled
(`docs/runbooks/restore-database.md`), but backups land on the **same VPS as the
database**. Losing the host still loses everything, which is the entire point of
having backups.

**Do:**

1. Add an off-host destination (owner picks: S3-compatible object storage, a
   second host over `rsync`/`scp`, or Backblaze B2). Ask which before building.
2. Add a retention policy (suggest 7 daily / 4 weekly / 6 monthly).
3. Keep credentials in env, never in the repo. Verify nothing secret is committed.
4. Schedule it (cron on the VPS) and confirm the schedule actually fires.

**Exit criterion:** a backup taken today exists **on storage that is not the
production VPS**, and you restored *that off-host copy* into a throwaway
container with a row-count match across at least 5 tables. Paste the counts.

---

## W3 — External uptime monitoring + alerting (HIGH)

**State:** `src/app/api/health/route.ts` exists and works. Nothing watches it.
Detection today is "a human notices," which is how the teacher white-screen crash
was found.

**Do:**

1. Point an external monitor at `https://schoolos.epioso.com/api/health`
   (owner picks: UptimeRobot, Better Stack, Checkly — note
   `.github/workflows-disabled/checkly.yml` already exists as a starting point).
2. Route alerts somewhere a human reads (email/SMS/Slack — ask which).
3. Confirm Sentry is actually receiving events in production, not just configured.
   `sentry.{client,server,edge}.config.ts` exist; prove one event lands.

**Exit criterion:** you deliberately made the health check fail (stop the app or
point the monitor at a broken path), **an alert actually arrived**, and you
restored service. Report the alert timestamp and channel. A configured monitor
that has never fired is not verified.

---

## W4 — Capability sweep of the 86 `addons` routes (HIGH)

**State:** 243 of 789 routes have no `requireCapability`. Most are legitimately
exempt (`super-admin` 21, `public` 10, self-scoped portals). **`addons` is 86 of
them** and is the largest unreviewed cluster. This is the D-5 class: shared
endpoints returning the admin-shaped payload to narrower roles. Three financial
leaks to `teacher` were previously confirmed, all found by a user clicking around.

**Do:**

1. List all 86:

   ```bash
   find src/app/api/addons -name route.ts -exec grep -L "requireCapability" {} \;
   ```

2. For each: decide **exempt** (say why) or **needs a capability** (add it).
3. For every route that returns data, check the *payload shape* per role, not just
   whether access is allowed. A teacher receiving a family's payment history is
   the failure mode.
4. Add a regression test per capability you add.

**Exit criterion:** every one of the 86 is listed with a verdict —
reviewed-and-exempt counts, but must name the reason. Add tests proving a
narrower role gets 403 or a reduced payload. Reviewed-and-clean must be
enumerated, not summarised.

---

## W5 — Extend the isolation checker beyond the bare-query shape (MEDIUM)

**State:** `scripts/check-tenant-isolation.ts` was fixed on 2026-08-27. It now
catches three shapes, each verified by inject-and-revert: client-bound
`tenantId`, bare `select` with no WHERE, bare `delete` with no WHERE. Zero false
positives across 789 routes. An empty `GLOBAL_TABLES` allowlist exists.

**Remaining hole:** a query WITH a `.where()` that filters on something other
than tenant is still not proven safe. For example
`db.select().from(invoices).where(eq(invoices.id, someId))` passes even if
`someId` came from another tenant.

**Do:**

1. Extend the checker so a `.where()` that never references `tenantId` on a
   tenant-partitioned table is flagged.
2. Expect false positives (transitively-scoped ids are legitimate). Measure the
   rate before deciding the rule is shippable. If noise is high, narrow the rule
   rather than adding blanket suppressions.
3. Any `GLOBAL_TABLES` entry you add must be justified in a comment — each one is
   a hole in the check.

**Exit criterion:** inject a cross-tenant `.where()` violation, see it caught;
revert, see exit 0; and report the false-positive count on the clean tree. If
false positives make the rule impractical, say so and deliver a manual sweep of
the highest-risk tables (`invoices`, `payments`, `receipts`, `grades`,
`attendance`) instead. Either outcome is acceptable; silence is not.

---

## W6 — Make the E2E suite actually execute (MEDIUM)

**State:** 6 specs exist (`tests/*.e2e.ts`: auth-and-session, cashier-payments,
grade-entry, mobile-attendance, role-navigation, student-lifecycle).
`playwright.config.ts` exists. `"test:e2e": "playwright test"` exists.
CI excludes them; the in-file comment claims the originals are "parked in
`.github/workflows-disabled/`" but that directory contains only `checkly.yml`,
`crowdin.yml`, `release.yml` — **there is no parked e2e workflow.** You are
writing the job from scratch.

**Do:**

1. First run them locally. They have never executed — expect failures, and fix
   the specs or the app as appropriate. Report which specs were already wrong.
2. Add a CI job in `.github/workflows/CI.yml`: Postgres service, migrations, seed,
   app boot, `npx playwright install --with-deps`, then `npm run test:e2e`.
3. Upload traces/screenshots as artifacts on failure.
4. Update the stale comment at the top of `CI.yml` — the "no tests/ dir" rationale
   is no longer true.

**Exit criterion:** the E2E job runs in CI and passes; then deliberately break one
assertion, push, and confirm CI goes **red**. Both observations required.

---

## W7 — Security scanning in CI (MEDIUM)

**State:** CI has quality gates only (build, lint, typecheck, deps, i18n, unit
tests against real Postgres, Docker build). The task queue claimed "7 automated
security & quality gates" — there is **zero** security scanning.

**Do:** add to `.github/workflows/CI.yml`:

1. `npm audit --audit-level=high` (or `osv-scanner`).
2. Secret scanning (`gitleaks`).
3. SAST (`github/codeql-action`) — JS/TS.
4. Keep `check:isolation` in the gate; it already runs via `npm run lint`.

**Exit criterion:** commit a deliberately fake secret (for example a dummy AWS
key) on a scratch branch, confirm the pipeline goes red, then remove it. Report
the run URL.

---

## W8 — Structured logging with retention (MEDIUM)

**State:** no `pino`/`winston`/`bunyan` anywhere. Roadmap item 3.7.

**Do:**

1. Add `pino` (+ `pino-pretty` in dev only).
2. Replace `console.*` in API routes and `src/libs/` — leave scripts alone.
3. **Redact PII**: student names, emails, phone numbers, matricules, guardian
   details, payment amounts. Moroccan Law 09-08 applies to logs too.
4. Set a retention policy on the VPS (`logrotate`), matching whatever W2 uses.

**Exit criterion:** trigger a request that logs, and show the emitted JSON with
PII redacted. Show a `logrotate` config that actually rotates. Confirm the
existing 1815 tests still pass.

---

## W9 — i18n content extraction — RUN LAST, RUN ALONE

**State — the biggest gap in the project.** The *infrastructure* is genuinely
done: all 342 pages live under `src/app/[locale]/`, middleware redirects and
defaults to `fr`, `dir={isRTL ? 'rtl' : 'ltr'}` is in the layout, `next-intl`
v4.12 is installed, and `locales/{en,fr,ar}.json` each hold 185 keys.

The *content layer* is not started: **0 of 343 files use `useTranslations` or
`getTranslations`** — verified 2026-08-27. Exactly one file imports anything from
next-intl (`settings/branches/page.tsx`, `setRequestLocale`), and that is locale
plumbing, not translation. There is no existing example in the codebase to copy;
you are establishing the pattern.
Today `/ar` renders a right-to-left layout full of French text — arguably worse
than no Arabic at all, because it looks supported.

The roadmap rates this **XL** and says explicitly: run it alone, it collides with
any concurrent work. Do not start it until W1–W8 are merged.

**Do:**

1. Extract hardcoded UI strings to `locales/{en,fr,ar}.json`, module by module.
2. Suggested order: shared components/nav → dashboard → students → finance →
   academics → attendance → portals (parent/student/teacher/alumni).
3. Keep `npm run check:i18n` green throughout (it is already in CI).
4. Arabic must be real translation, not machine-dumped placeholder text. If you
   cannot produce trustworthy Arabic for a string, leave the key untranslated and
   **list it** rather than inventing text.
5. Commit per module — do not land one enormous diff.

**Exit criterion:** report the real number, for example "N of 343 pages
extracted." Partial is fine and expected. **Do not mark this Done unless it is
done.** If you complete 60 pages, the status is "60/343", not done.

---

## W10 — The two audits that were claimed but never written

`AGENT-TASK-QUEUE.md` marks T17 and T19 Done citing
`docs/audit/2026-08-26/17-ARABIC-RTL-AUDIT.md` and
`19-RESPONSIVE-VIEWPORT-AUDIT.md`. **Neither file exists anywhere in the repo.**
(T18's `18-ACCESSIBILITY-AUDIT.md` does exist, under `lango-app/docs/audit/`.)

**Do:**

- **17 — Arabic RTL:** with real Arabic content in place (depends on W9 progress),
  verify direction, mirrored icons/chevrons, table column order, date/number
  formatting, and bidi isolation for phone numbers and matricules embedded in
  Arabic text. Write the document.
- **19 — Responsive 320–1440px:** prioritise **teacher attendance marking on a
  phone at 375px** — that is the highest-frequency real-world mobile flow. Then
  data-dense tables, modals, and the KPI banners. Write the document.

**Exit criterion:** both documents exist at the cited paths, with screenshots or
Playwright viewport evidence. If W9 has not progressed enough for a meaningful
RTL pass, say so and scope 17 to what is testable — do not fabricate coverage.

---

## NOT AN AGENT TASK — Law 09-08 / CNDP

Data residency and Moroccan data-protection compliance are open and **HIGH risk**:
production data sits on a **Tencent Cloud VPS**. The original audit deliberately
refused to make a compliance claim, and the roadmap says: *"Do not let engineering
answer 4.1."*

**You may gather evidence. You may not issue a compliance verdict.**

Permitted: inventory what personal data is stored and where; confirm
`recordAudit()` coverage of sensitive actions; check whether data-subject export
and deletion exist; document actual hosting region and sub-processors.

Forbidden: concluding the project is or is not compliant. Escalate to the owner
for legal input.

---

## FINAL REPORT — required format

Produce ONE report at the end, written to
`docs/audit/2026-08-26/21-WAVE-3-EXECUTION-REPORT.md`.

```markdown
# Wave 3 Execution Report — <date>

## Status table
| Task | Status | Evidence (command + observed output) |
|---|---|---|
| W1 prod migration | done/partial/not-done | ... |
| ... one row per W1–W10 ... |

## Verification log
For every check built or changed: the failing observation AND the passing one,
with exact output. A check with only a passing observation is unverified.

## Numbers
- tests: <n> passing / exit <n>  (baseline 1815, exit 0)
- tsc --noEmit: exit <n>
- check:isolation: exit <n> clean / exit <n> on injected violation
- addons routes reviewed: <n>/86
- i18n pages extracted: <n>/343

## What I did NOT do
Explicit list. Anything skipped, blocked, or partially done.

## New defects found
Anything discovered that was not in the audit. Add to the register.

## Owner decisions still needed
Off-host backup provider · alert channel · Law 09-08 legal input · host
right-sizing · ClamAV keep-or-drop.
```

**Status legend:** done = verified both ways · partial = say which part ·
not-done = blocked or skipped. When in doubt, choose the lower status.
