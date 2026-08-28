# Wave 3 Execution Report — 2026-08-28

Single-agent execution of W1–W10 per `AGENT-WAVE-3-PROMPT.md`, with the brief's rules enforced: every check shown failing on broken input and passing on clean input; lower status chosen whenever in doubt.

**Concurrency note:** a second reviewer/agent worked in this tree during the same window. Their contributions are credited inline (grade-entry negative tests, the lint `&&` gating fix, backup-retention test, monitoring compose file); they also committed the combined tree in `5d064ca`, `9052c2f`, `6fd5c50`. Final green state (2026-08-28, after all edits): unit **1830/1830, exit 0** (134 files); Playwright **16/16, exit 0**; tsc exit 0; isolation exit 0.

## Status table

| Task | Status | Evidence (command + observed output) |
|---|---|---|
| W1 prod migration | **not-done** | Blocked on owner approval (brief rule 10). Nothing was touched on `43.157.17.129`. |
| W2 off-host backups | **not-done** | Blocked on owner decision (destination). Reviewer added a retention policy + unit test (`backup-retention.test.ts`, commit `6fd5c50`) — retention logic now exists and is tested; **nothing is scheduled, nothing leaves the host, no off-host restore drill exists.** |
| W3 uptime monitoring | **not-done** | Blocked on owner decision (alert channel). Reviewer added `docker-compose.monitoring.yml` (self-hosted monitor, not yet running anywhere proven). No external monitor points at `/api/health`; no alert has ever fired; Sentry prod delivery still unproven. |
| W4 addons sweep (86 routes) | **done** | 86/86 enumerated and verdict-listed (§ Addons below; 4 parallel review agents; every route named). 7 defects found, each fixed with a regression test proven both ways (below). |
| W5 isolation checker extension | **done** | Injected cross-tenant WHERE → `ISOLATION_EXIT=1` with `select on invoices has a WHERE without tenantId (high-risk table)`; reverted → `exit 0`, `Measured: 75 non-failing WHERE-without-tenantId warning(s)`; no GLOBAL_TABLES entries added. 2 real fixes fell out (sandbox route). Reviewer follow-up (`9052c2f`): the checker never actually gated because `lint`'s `eslint . &&` short-circuited on 2475 pre-existing errors — fixed so the check now enforces. |
| W6 E2E actually executes | **done locally / partial overall** | Suite had never run: pglite webServer crashed (`ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`) and `scripts/run-db-migrate.cjs` (referenced by `db-server:*`, `build-local`) does not exist. Rewired to real Postgres; fresh-DB CI simulation: `MIGRATE_EXIT=0`, `SEED_EXIT=0` (37 accounts), suite **15 passed / exit 0**. Red-proof: broken health assertion → `exit 1, 1 failed`; restored → green. CI job added to `.github/workflows/CI.yml` (Postgres service, migrate, `seed-full`, playwright, artifacts on failure). **CI has never executed it — needs push (owner-gated).** Hollow assertions rewritten to real authenticated ones (also done concurrently, better, by the reviewer for grade-entry). |
| W7 security scanning in CI | **partial** | Jobs written in `CI.yml`: `npm audit --audit-level=high` (non-blocking, ponytail-commented), blocking gitleaks, CodeQL JS/TS. Proven locally: `npm audit` → `exit 1, 14 vulnerabilities (7 high, 7 moderate)`; gitleaks without config → `exit 1, leaks found: 10`; with `.gitleaks.toml` → `exit 0, no leaks found` (all 10 hits individually inspected: test fixtures, idempotency keys, doc examples — each allowlisted with justification). **Never run on GitHub — needs push.** |
| W8 structured logging + retention | **done (app) / not-done (VPS)** | pino + pino-pretty(dev) installed; `src/libs/logger.ts` with Law 09-08 redaction; **all 10 `console.*` calls in `src/app/api` + `src/libs` replaced (9 files); scripts untouched.** Both-ways proof: bare pino emitted `"email":"parent@example.com","phone":"+212612345678"`; shipped config emits `[REDACTED]` (regression test `logger-redaction.test.ts` green). `infra/logrotate/schoolos-app.conf` written; **not installed on the VPS (prod action).** |
| W9 i18n extraction | **partial: pipeline + 1/343 pages** | The audit's "infrastructure genuinely done" was **false**: no provider, no request config, no plugin, 0 `useTranslations` — every `/ar` render 500ed once exercised. Wired all three, then extracted `login-client.tsx` (31 new keys × en/fr/ar, human-written Arabic). Proof: `/fr/login`, `/ar/login`, `/en/login` → HTTP 200; `/ar/login` contains `dir="rtl"` + Arabic strings + `تسجيل الدخول إلى حسابك`; screenshot `assets/login-ar-375-rtl.png`. **342 pages remain.** |
| W10 audits 17 & 19 | **done (scoped, real evidence)** | `17-ARABIC-RTL-AUDIT.md` + `19-RESPONSIVE-VIEWPORT-AUDIT.md` written at the cited paths with screenshots (`assets/`, 10 PNGs) and measured overflow: **0px @ 320/375/768/1440** on attendance + student directory. RTL doc explicitly scoped: full bidi pass deferred until W9 covers more pages. Correction banners added to `AGENT-TASK-QUEUE.md` and the two unverifiable `lango-app/docs/.../1[79]-*-VERIFICATION.md` files. |
| Law 09-08 (not an agent task) | **evidence gathered only** | `23-LAW-0908-EVIDENCE-PACK.md`: PII inventory by table, audit coverage (382 route files call recordAudit), CNDP tracker + anonymize + exports findings, hosting facts, **no compliance verdict**. |

**Baseline compliance:** `npm run test` → **1830 passed / exit 0** (baseline 1815; +15 net new regression tests incl. reviewer's retention tests); `npx tsc --noEmit` → **exit 0**; `check:isolation` clean-tree → **exit 0** (75 measured warnings); `check:i18n` → "No undefined keys found" (exit 1 solely from pre-existing unused boilerplate keys, unchanged, non-blocking in CI); Playwright → **16/16, exit 0**.

## Verification log (both observations per check)

1. **W4 regressions** (`wave3-addons-guard.test.ts`, real Postgres, handlers mounted): pre-fix run → **6/6 failed** (`expected '0612345678' to be '06…78'`; `expected 200 to be 403`; `expected undefined to be defined` for the audit row; unmasked `sk-live` config). Post-fix → **6/6 passed**. BBB signature: pre-fix `2 failed` (`expected true to be false` — junk HMAC accepted); post-fix 4/4 green incl. wrong-secret rejection via timing-safe compare.
2. **W5**: `src/app/api/__wave5-inject/route.ts` with `db.select().from(invoices).where(eq(invoices.id, '1111…'))` → `INJECT_EXIT=1` + per-line message naming invoices; file removed → `CLEAN_EXIT=0`, warnings measured at **75** (203 before the table-qualified narrowing).
3. **W6 red-proof**: `sed` health assertion to `'deliberately-broken'` → `RED_EXIT=1, 1 failed`; restored to `'healthy'` → green. Fresh-DB CI simulation: empty scratch DB → migrate 0 → seed-full 0 → suite 15/15 (see status table).
4. **W7**: gitleaks both ways documented above; `npm audit` true exit captured (`AUDIT_EXIT=1`).
5. **W8**: bare-pino vs redacted line quoted above; committed test asserts 6 PII keys redacted + 2 non-PII keys intact.
6. **W9**: three-locale 200 proof + RTL assertion + screenshots (2026-08-28); the pre-fix state (500 on all locales) was observed live during wiring.
7. **Environment honesty**: an interleaved stale dev server (pre-session build) silently served old UI to early e2e runs; all node servers killed, `.next/dev` purged, results re-taken on the current tree. The "213 failures" unit run was a Docker restart mid-suite; clean re-run 1826/1826.

## Numbers

- tests: **1830 passing / exit 0** (baseline 1815, exit 0)
- tsc --noEmit: **exit 0**
- check:isolation: clean **exit 0** / injected violation **exit 1** / **75** measured warnings
- addons routes reviewed: **86/86** (verdict per route: 75 OK · 5 exempt-with-reason · 7 NEEDS-FIX → all 7 fixed & tested; +1 bonus `circulation/issue` which self-guards an override key)
- i18n pages extracted: **1/343** (login) + full pipeline; `/en` serves French by clamp — owner decision pending

## What I did NOT do

- W1, W2, W3 in full (owner-gated; nothing was deployed, restarted, or exposed).
- CI red/green on GitHub for W6/W7 (needs push authorization).
- logrotate installation on the VPS (W8 host-side half).
- W9 beyond the login page (342 pages remain; must run alone per brief).
- Portal-wide RTL/bidi verification (impossible until W9 covers more pages — documented in doc 17).
- Sentry production-event proof (folded into W3).
- No `GLOBAL_TABLES` entries were added to the isolation checker.

## New defects found (added to register, all fixed unless noted)

1. **CRITICAL — BBB webhook accepted any non-empty `x-bbb-signature`** (forgeable attendance). Fixed + tested.
2. Broadcast `connections/[id]` GET returned raw row (secret config bypassed masking). Fixed + tested.
3–5. `campaigns/[id]/recipients`, `segments` PUT search, `segments/[id]/preview` exposed unmasked names/phones/emails (incl. guardian contacts) under `broadcast.read`. Fixed + tested (masking mirrors the CSV-export convention).
6. Stocktake `adjustments/apply` gated by `stocktake.manage` instead of the admin-only `stocktake.approve` (broke maker/checker). Fixed + tested.
7. Stocktake apply returned silent 200 on unknown/other-tenant stocktake id. Now 404. Tested.
8. `library/members` POST had no `recordAudit`. Fixed + tested.
9. Sandbox payments summed/updated `payments`/`invoices` with client-supplied id and no tenant predicate. Fixed (defense-in-depth; was transitively safe).
10. E2E infrastructure never worked: Windows pgltite `--run` quoting crash + `scripts/run-db-migrate.cjs` missing. Config rewired; **`db-server:memory`/`build-local` still reference the missing script — open item.**
11. **next-intl was never wired** (no plugin/request/provider): with the provider added pre-fix, every `/ar|/fr|/en` login render 500ed. Fixed; proven.
12. **Seed gap:** `seed-full` never set `tenants.logo_url`, so every freshly seeded tenant bounces its admin into the onboarding wizard from every dashboard route. Fixed in seed + local DB.
13. `BETTER_AUTH_URL` pinned to :3000 in `.env` → sign-in POST `INVALID_ORIGIN` on the E2E port. Fixed via webServer env.
14. Stale zombie dev servers + `reuseExistingServer` served an outdated build to e2e, producing misleading reds/greens. Process fix documented (kill node servers + purge `.next/dev` before trusting results).
15. Docker daemon instability on this host (died once; DB container restarted mid-suite once). Environment risk — reinforces W2/W3.

## Owner decisions still needed

Off-host backup provider (W2) · alert channel/provider (W3) · production migration window (W1) · push-to-GitHub authorization to let CI prove W6/W7 (incl. the deliberate red runs) · Law 09-08 legal input on `23-LAW-0908-EVIDENCE-PACK.md` §4 (incl. Tencent region) · host right-sizing (doc 16) · ClamAV keep-or-drop · triage of the 7 high `npm audit` findings before flipping that job to blocking · `/en` locale: serve properly or drop · W9 module order confirmation (nav/shared → dashboard → students → finance → academics → attendance → portals).
