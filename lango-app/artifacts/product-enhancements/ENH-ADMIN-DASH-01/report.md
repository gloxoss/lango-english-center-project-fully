# ENH-ADMIN-DASH-01 — Report

**Campaign:** Admin Shell + Director Dashboard Product Enhancement
**Agent:** opencode-2 · **Date:** 2026-09-25
**Status:** IMPLEMENTATION COMPLETE — READY FOR USER PRODUCT REVIEW

## Provenance

| | |
|---|---|
| Source branch | `student-directory-hardening` |
| Source SHA | `17945212` (+ 626 uncommitted reviewed changes snapshotted as `3d78a159`, record-only `git stash create`) |
| Implementation branch | `enhancement/agent-a/ENH-ADMIN-DASH-01` |
| HEAD | `cdf0dcc9` |
| Worktree | `C:\Users\OMEN\AppData\Local\Temp\opencode\enh-admin-dash-01` |
| Dashboard route | `/[locale]/dashboard` → `DashboardView` → `GET /api/dashboard/summary` |
| Relevant APIs | `/api/dashboard/summary`, **new** `/api/dashboard/notifications`, `/api/portal/search`, `/api/settings/branches`, `/api/settings/logo` |
| Dev server | http://localhost:3455 (port claimed as `task:port-3455`) |

## Business fixes
1. **P0 branch-context zeroing** — root cause: every Atlas row (200 students, 25 staff, 4 classes, 200 invoices, 160 payments, 1600 attendance, 20 applicants) had **NULL branch_id**; per-branch queries filter `user.branchId` → zeros. Data fixed coherently (SQL evidence in `evidence/`): **Siège 149 / Maarif 51 = 200**, finance/attendance/admissions reconcile exactly; director unpinned (tenant-wide). Also fixed two real query bugs found on the way (applicants filtered on unjoined `user` table).
   **⚠ Scope of the data fix:** it was applied to the DEV database (`schoolos` @ 5433) as one-off UPDATEs and to `seed-full.ts` for future seeds — **it is not a migration**. If VPS/production rows also have NULL `branch_id`, per-branch dashboards will show zeros there until the same backfill runs. **A one-off backfill IS needed on production**; the ready-to-run SQL is `evidence/p0-branch-data-fix2-accent-safe.sql` (+ `unpin-admin.sql` for tenant-wide directors, optional per deployment choice).
2. **Seed now assigns branches** — Annexe Maarif created up-front; classes/students/teachers/applicants get branch assignments; no duplicate branch row for the library transfer.
3. **Attendance truth** — the assiduité card can no longer show green "Aucune absence injustifiée" while pointage is unfinished: explicit `incomplete` state ("Pointage incomplet") driven by expected-vs-marked sections.
4. **Finance truth** — monthly cash receipts (`Encaissements reçus ce mois`) decoupled from invoice-cohort recovery (`Recouvrement des factures – {period}`, "Encaissé sur ces factures"); the misleading "153% du montant attendu" class of number is gone; rate mathematically ≤ 100 (test pinned).
5. **Notification truth + privacy** — bell aggregates only real sources, capability-gated, canonical overdue definition shared with the KPI (40 = 40). **Announcements are audience-filtered** exactly like the announcements surfaces: role targeting (`target_role` null or = viewer role) AND class targeting (`target_class_section_id` null or = viewer's section; sectionless viewers only see school-wide). A parent can no longer read a teachers-only note. Test pins the compiled SQL (role + section params).

## UI/UX changes
1. **Tenant branding** — sidebar = school logo/name + "Propulsé par SchoolOS"; initials fallback; FR/EN/AR coherent; zero hardcoded tenant strings.
2. **Single authoritative branch selector** in the shell (server-derived scope; pinned users get a locked static pill; dashboard refreshes reactively without reload).
3. **Dashboard hierarchy** — Action Center → 4 KPI cards → Finance | Attendance week → Agenda | Payments → Absenteeism | Admissions; page shorter and operational; student distribution retired from the daily page (Admissions widget in its place); visual refinement stays within the SchoolOS language (white/Carrara surfaces, Deep Cerulean, hairline borders, 12px cards).

## Search — PASS
"yousse" returns only Youssef* (8, first 5 shown) grouped **ÉLÈVES / PERSONNEL / FACTURES** with `class · matricule` lines and totals; "Voir tous les résultats" deep-links; accent-insensitive; branch-scoped with server-side validation (a branch ID from another tenant → 403). **Pinned-admin semantics (precise):** the dashboard summary REJECTS (403) a pinned admin's cross-branch request; the SEARCH route silently confines them to their own branch's results (requested branch ignored, no error) — safe either way. Parent/self scoping preserved (tests pin all of these).

## Merge notes (for the integrator)
- This branch sits ON TOP of snapshot `3d78a159` (other agents' WIP). **Do NOT merge the branch as a whole** — cherry-pick only the real commits: `cdf0dcc9` (feature), `4c9632a8` (report), plus the review-fix commits on top.
- The `tsconfig.json` `.next-enh-dash` include lines slipped into `cdf0dcc9`; a follow-up commit reverts them (private build folder, not for the shared tree).
- Helper scripts (`.capture-before.mjs`, `.check-alignment.cjs`, `.verify-api.mjs`) were never committed; the live-verification script lives at `evidence/live-api-verification.mjs`.

## Gates & tests
- Focused vitest suites: **25/25** (`dashboard-formatters` payment dates + recovery ≤100 bound; `portal-search` tenant/branch/pinned/parent/self; `notifications` aggregation + capability gating; pre-existing summary security tests still green)
- `check:types` 0 errors · `check:isolation` pass · `check-missing-i18n-keys` exit 0 · `check:ui` pass (retired card removed, baseline intact) · ESLint 0 errors on all touched app files (2 accepted warnings: pre-existing hook-deps pattern; deliberate `<img>` for the binary logo endpoint)
- Live verification: `evidence/live-api-verification.mjs` (branch reconcile, search scope, notifications)

## Before / After
- `before/` — 9 captures of the reviewed state (raw timestamps, 153%, duplicate selectors, green-next-to-incomplete contradiction, hardcoded platform branding)
- `after/` — 9 captures: dashboard FR/AR/mobile, sidebar branding, branch selector, notification center, profile menu, search "yousse", header strip

## Manual test base
http://localhost:3455 · `manual-test-guide.md` (14 tests with exact expected values)

## Honest gaps (next steps)
1. Notification read/unread persistence exists only for announcements; operational items are derived state (cleared when work is done). A notifications table is the next architecture step.
2. No "Voir toutes les notifications" page exists → link omitted rather than dead.
3. `studentDistribution` still computed by the API for a future Analytics page (`analytics-view.tsx` exists but is unwired — pre-existing debt).
4. A few "(s)" pluralization fallbacks in FR copy.
5. `sidebar.tsx` is also held by codex-4 (PDF nav entries) — coordinate when merging to the shared tree.

**READY FOR USER PRODUCT REVIEW: YES**
**READY FOR INDEPENDENT VERIFICATION: YES** (worktree branch `enhancement/agent-a/ENH-ADMIN-DASH-01` @ `cdf0dcc9`)
**OPEN CLAIMS:** `task:ENH-ADMIN-DASH-01` + `task:port-3455` (held for manual testing)
