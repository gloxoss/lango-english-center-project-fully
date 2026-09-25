# ENH-ADMIN-DASH-01 — Checkpoint

**Date:** 2026-09-25
**Agent:** opencode-2
**Campaign:** Admin Shell + Director Dashboard Product Enhancement
**Worktree:** `C:\Users\OMEN\AppData\Local\Temp\opencode\enh-admin-dash-01`
**Branch:** `enhancement/agent-a/ENH-ADMIN-DASH-01`
**Base:** snapshot commit `3d78a159` (record-only `git stash create` of the reviewed working tree on `student-directory-hardening` @ `17945212` + borrowed untracked files from codex-4)
**Dev server:** http://localhost:3455 (NEXT_DIST_DIR `.next-enh-dash`, DB `schoolos` @ localhost:5433)

## State: IMPLEMENTATION COMPLETE — awaiting user product review

## What is done

### P0 — Branch selection zeroed the dashboard (root-caused + fixed)
- Provenance table proved **every Atlas row had NULL branch_id** (students 200, staff 25, classes 4, invoices 200, payments 160, attendance 1600, applicants 20). Per-branch queries filter `user.branchId = X` → 0 rows. Broken assignment, not empty branches.
- Data fixed coherently (SQL in `evidence/`): Siège = 149 students (classes 1ère, 2nde, Terminale), Maarif = 51 (3ème); staff 18/7; applicants 14/6; director unpinned (tenant-wide). Totals reconcile exactly.
- Seed script (`src/scripts/seed-full.ts`) fixed so fresh seeds create Annexe Maarif early and assign branches to classes/students/teachers/applicants; library transfer reuses the branch instead of duplicating it.

### Implemented (all verified live on :3455)
1. **Tenant branding** — sidebar shows tenant name + uploaded logo (`/api/settings/logo`) with initials fallback; "Plateforme Multi-tenant" removed → "Propulsé par SchoolOS". Works FR/EN/AR, no hardcoded school.
2. **Single authoritative branch selector** — page-level select removed from dashboard; shell `header-campus-switcher` is the one authority; scope server-derived (`meta.branchScope` in `/api/settings/branches`); pinned users get a static pill (no menu); dashboard refreshes reactively (no reload on dashboard pages).
3. **Profile menu** — session name/email + role badge + "Paramètres de l'établissement" + logout. No fake "Mon profil" (no real route exists — documented).
4. **Notification center** — new `/api/dashboard/notifications` aggregates REAL sources, grouped À traiter / Mises à jour / Système, capability-gated, unread count, mark-all-read for announcements (existing persistence), click-through destinations.
5. **Global search P0** — grouped ÉLÈVES/PERSONNEL/FACTURES rendering, class · matricule lines, totals, "Voir tous les résultats" deep-link, accent-insensitive matching, branch-scoped with server validation, pinned-user confinement.
6. **Action center truth** — unjustified-absences card has explicit `incomplete` state ("Pointage incomplet") when marking is unfinished; never green next to missing pointage.
7. **KPI semantics** — "+N depuis le début du mois" only when meaningful; "Encaissements reçus ce mois" with honest vs-prev-month delta (no recovery %); incomplete marking shows "Pointage incomplet ({done}/{total} classes)" instead of "—".
8. **Finance panel** — retitled "Recouvrement des factures – {period}" with explicit single-cohort subtitle; "Encaissé sur ces factures"; cohort math unchanged (already reconciled).
9. **Weekly attendance** — per-day completionState (complete rate / no_class / Pointage incomplet); ops chips (week unjustified, week late, today missing classes).
10. **Agenda** — renamed from "À venir"; birthdays demoted to one subtle line.
11. **Recent payments** — human dates ("Aujourd'hui · 09:42" / "11 sept. 2026 · 14:20"); rows link to invoice detail or student page.
12. **Absentéisme à surveiller** — explicit "X cette semaine · Y ce mois" per student; attendance-only queue.
13. **Admissions en attente** — actionable widget (to review / interviews today / converted) replacing student distribution on the daily page.
14. **i18n** — new keys in fr/en/ar (insertion script kept CRLF; JSON validated); check-missing-i18n-keys green.
15. **Dashboard hierarchy** — Action Center → 4 KPIs → Finance | Attendance week → Agenda | Payments → Absenteeism | Admissions; shorter, operational.

## Verification status
- `npm run check:types` — **0 errors**
- Focused vitest suites — **25/25 passed** (formatters/payment-dates/recovery-bound, portal-search scoping, notifications aggregation, pre-existing summary security tests)
- `npm run check:isolation` — pass
- `node scripts/check-missing-i18n-keys.mjs` — pass (exit 0)
- `npm run check:ui` — pass (orphaned StudentDistributionCard removed with the campaign's blessing — it was replaced; analytics hosting is a documented gap)
- ESLint on all touched app files — **0 errors** (2 acceptable warnings: pre-existing hook-deps pattern; `<img>` is deliberate for the binary logo endpoint)
- Live API verification — branch scopes reconcile (200 = 149 + 51; 767 500 = 608 000 + 159 500; 13 = 10 + 3; 12 = 9 + 3 (+1 marked today); absenteeism 8 = 6 + 2)
- BEFORE/AFTER screenshots in `before/` and `after/` (9 each)

## Known gaps / next technical steps
1. **Notification persistence** — operational blocks are derived state (they clear when work is done); only announcements have read/unread persistence. A `notifications` table + per-item read state is the next architecture step.
2. **"Voir toutes les notifications" page** — omitted (no such page exists; no dead links).
3. **Student distribution on daily page** — replaced by Admissions per campaign; `studentDistribution` still computed by the API for a future Analytics page (`analytics-view.tsx` exists but is unwired — pre-existing debt).
4. **Pluralization** — a few "(s)" fallbacks in FR strings; polish later.
5. **`sidebar.tsx` merge note** — codex-4 holds the shared-tree copy for PDF nav entries; my worktree base already includes their in-progress change; coordinate on merge.

## Open claims
- `task:ENH-ADMIN-DASH-01` (opencode-2) — will be closed with `done` after user review.
- `task:port-3455` (opencode-2) — kept alive for manual testing.
