# Section Index

15 sections · 29 tasks · 4 batches. Sections in the same batch can run in parallel by different agents.
Hub item for each section = `task:up-<NN>-<slug>` (e.g. `task:up-01-test-db`).

## Batch 1 — start now (parallel, no dependencies)

| # | Section | Risk | Best agent | Gate |
|---|---|---|---|---|
| 01 | Test database isolation + leftover tenant | yellow | any careful agent | D5 for task 01-03 only |
| 02 | Verification sweep (41 unverified + redo 22) | yellow | 2–3 agents who did NOT write the fixes | none |
| 03 | Hardcoded-French ratchet regression | green | cheap/fast agent, after codex-4 releases `task:pdf-document-system` | none |
| 05 | Alumni transition closes hostel / transport / fees | yellow | backend agent | none |
| 06 | Retire legacy grade route | green | any agent | D4 |
| 07 | Public forms bot protection | yellow | backend agent | D7 |
| 11 | UX cleanup (alerts, silent errors, dead icons, orphans) | green | cheap/fast agent | none |

## Batch 2 — after Batch 1

| # | Section | Risk | Depends on | Gate |
|---|---|---|---|---|
| 04 | Timetable double-booking guard (app + DB) | red | 01 (needs schoolos_audit to test the migration) | none |
| 08 | Navigation: 8 real pages into menus, 21 marked intentional | green | codex-4 releases `sidebar.tsx` | D6 |
| 10 | i18n backlog (1 211 strings + 213 fr-FR formats) | green | 03 | none |
| 12 | End-to-end smoke tests (Playwright) | yellow | 01 | none |

## Batch 3 — owner decisions

| # | Section | Risk | Depends on | Gate |
|---|---|---|---|---|
| 09 | Payroll 2025/2026 regulation pack | red | none in code | D3 |
| 15 | S-15 director dashboards | green | 08 | D2 |

## Batch 4 — release

| # | Section | Risk | Depends on | Gate |
|---|---|---|---|---|
| 13 | Land the 27 branches + commit | red | 01, 02, 03, 04, 05 | D1 |
| 14 | Post-merge on-screen sweep | yellow | 13 | none |

## Traceability (audit finding → section)

| Audit finding (2026-09-25) | Section |
|---|---|
| Tests ran against dev DB `schoolos`; no `schoolos_audit` DB; 1 leftover test tenant | 01 |
| 41 fixes unverified; antigravity-1 verifications cite non-existent code | 02 |
| Hardcoded-French ratchet failing (1 246 vs 1 211) | 03 |
| Timetable double-booking only checked in app code | 04 |
| Alumni transition leaves hostel / transport / fee records open | 05 |
| Legacy `/api/academics/assessments`: no term lock, unused | 06 |
| Public inquiry / signup: no captcha (honeypot + in-memory rate limit only) | 07 |
| 29 unlinked pages | 08 |
| Payroll figures are 2024 and unvalidated | 09 |
| 1 211 hardcoded French strings; 213 hardcoded `'fr-FR'` formats | 10 |
| 87 browser alert/prompt, 156 console.error in screens, 4 dead icon controls, 5 orphaned components | 11 |
| 0 end-to-end tests | 12 |
| 620 uncommitted changes, 27 unmerged branches | 13 |
| 140 pages fixed but not re-checked on screen | 14 |
| S-15 two director dashboards | 15 |
