# Checkpoint — DISC-SETTINGS-CORE-01

Agent: claude-finance · 2026-09-25 · hub item task:DISC-SETTINGS-CORE-01 · commit audited: 54d386a4 (clean worktree `.worktrees/DISC-SETTINGS`, so the branch-scope agent's uncommitted edits in the main folder were not audited).

## Done
- Route discovery from route tree, sidebar and hub config: 41 routes (37 under /settings + 4 core-config pages) → page-inventory.md, route-api-db-map.md, evidence/page-map.json
- Playwright: 123 full-page captures (desktop FR, mobile 390 FR, desktop AR) + 11 interaction/save-state captures, automatic rejection checks → playwright-results.md
- Server-side isolation and role tests: 18 read APIs × 5 users, 10 cross-tenant writes, 5 wrong-role writes → permission-analysis.md
- Persistence round trips with DB check and restore: pass mark, session-year end date, semester name, numbering name, custom-field label; UI "save unchanged" on 3 pages
- Consumer tracing for all 44 registry keys + legacy `school_settings` columns → settings-consumer-map.md
- Specific investigations: academic year, active year, languages 0/1, modules, translation key, attendance settings, grading, numbering, matricules, custom fields

## Data touched (dev DB `schoolos` only), all restored
- `academic.passThreshold` 10 → 11 → 10 (versions now 2)
- Atlas 2026-2027 end date 2027-06-30 → 2027-07-15 → 2027-06-30
- Atlas "Semestre 1" → "Semestre 1 PROBE" → "Semestre 1"; also once accidentally → "x" by a format probe, restored immediately
- Numbering "Matricule élève" and custom field "N° matricule" renamed and restored (their versions tables gained rows)
- Organisation page "save unchanged" via the real UI: rewrote Atlas `school_settings.languages` / `presence_modes` from the seed's wrong array shapes to the object shapes the app expects (content equivalent). Not reverted, because the old shape is the bug. The VPS still has the old shape.
- No VPS writes. VPS reads only (entitlements, addon definitions, audit rows, crontab).

## Not done
- Load or concurrency tests (1,000+ students, parallel saves), module-plan downgrade, branch closure: architectural review only (scalability-analysis.md)
- Branch-limited admin: no such user in the data (BRANCH-SCOPE-01 B1 adds the fixture)
- Deep audit of notifications, domain, exports, payment methods, live classrooms, access reset, audit-logs pages (visual capture only)
- Validation copy of the "add academic year" modal (submit button not found by role)

## Code changes
None to application code. Only this artifacts folder.
