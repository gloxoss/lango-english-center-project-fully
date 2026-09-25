# SchoolOS — Post-Audit Work Plan (2026-09-25)

Source: the 2026-09-25 full audit (claude-finance), cross-checked against three other agents' reports.
Every fact below was measured on disk or in the local DB on 2026-09-25; re-measure before acting on a number.

## Where the app stands

| Gate | State on 2026-09-25 |
|---|---|
| Typecheck (`npx tsc --noEmit -p lango-app`, ignore `.next/`) | 0 errors |
| Unit + DB tests (`npx vitest run --project unit`) | all green after 0160 fix + grade-entry test fix (re-run full suite in S01 on schoolos_audit) |
| `npm run check:isolation` | pass (63 transitive warnings) |
| `npm run check:ui` | 4 dead icon controls, 0 mock screens, 29 unlinked pages, 5 orphaned components |
| `npm run check:i18n` / `check:i18n:keys` | pass / 0 missing |
| `npm run check:i18n:hardcoded` | FAILING: 1 246 vs baseline 1 211 (regression, see S03) |
| Git | 620 uncommitted changes on `student-directory-hardening`; 27 unmerged branches |
| Agent hub | 41 fixes done but unverified; 22 antigravity-1 verifications unreliable |
| DB | `schoolos-db` on localhost:5433, db `schoolos`, 162 migrations, 439 tables; no `schoolos_audit` db |

## Rules every agent follows (non-negotiable)

1. Read `.agent-hub/PROTOCOL.md`. Join: `node .agent-hub/hub.mjs join --agent <tool>-<n> --tool <tool>`.
2. Claim before editing: `node .agent-hub/hub.mjs claim task:<section-slug> --agent <you> --files a,b`. Exit 3 = someone holds it: do not edit.
3. Never run `git stash`, `git reset --hard`, `git checkout -- <file>`, `git restore`, `git clean`, `git switch` in this tree. Do not commit or push unless the section says so (only S13 commits).
4. Tests that touch the DB run ONLY against `schoolos_audit` once S01 is done: `DATABASE_URL=postgresql://<user>:<pass>@localhost:5433/schoolos_audit npx vitest run ...`. Never run DB tests against `schoolos`.
5. Never build or deploy on the VPS. Never kill another agent's process or another project's container.
6. Finish with `hub.mjs done task:<slug> --summary "..." --files ... --verify "<command> -> <result>"`. The verify string must be a command you actually ran and its real output.
7. A fix is not verified until a DIFFERENT agent runs `hub.mjs verify` with its own evidence. Never verify your own work.
8. Locale files (`lango-app/locales/*.json`) are CRLF with mixed history: any script that inserts keys must match `\r?\n`, must never insert at the first CRLF, and must re-check for duplicate or nested top-level namespaces afterwards.
9. Migrations: next free number is 0161. Every new `.sql` MUST also get an entry in `lango-app/migrations/meta/_journal.json` (0160 was missed and broke PDFs and 22 tests).

## Decisions only the owner can make (gate the marked sections)

| ID | Decision | Recommended default | Gates |
|---|---|---|---|
| D1 | How to land the 27 branches: merge one by one into `student-directory-hardening`, or start from `release/REL-INTEGRATE-01` (59 commits, 703 files, stale) | One by one, smallest first, full gates after each | S13 |
| D2 | S-15: merge the two director dashboards (`/dashboard` home vs `/dashboard/analytics` = leadership view) or keep both | Keep `/dashboard` as the home, make analytics a tab of leadership, redirect the duplicate | S15 |
| D3 | 2025/2026 Moroccan payroll figures (IR brackets, professional allowance, employer AMO) confirmed by an accountant, with the source text | Do not change rates until signed | S09 |
| D4 | Retire the legacy `POST/GET /api/academics/assessments` (no screen calls it) | Retire: return 410 Gone, keep the table | S06 |
| D5 | Delete the one leftover test tenant `gl-status-bc4222f4-05fb-4999-acd1-6ba0756eb9dd` in db `schoolos` | Delete | S01 task 01-03 |
| D6 | Menu placement for the 8 pages that need a sidebar entry (see S08) | As listed in S08 | S08 |
| D7 | Bot protection provider for public forms | Cloudflare Turnstile, enforced only when `TURNSTILE_SECRET_KEY` is set | S07 |

## Section map

See `sections/index.md` for batches, dependencies and owners. 15 sections, 29 tasks.

## Out of scope for this plan

CMI / Sage / DAMANCOM / bank-file adapters (disabled until certified), BigBlueButton certification, self-service password reset, new features.

## Review notes (self-check of this plan)

- Every audit finding from 2026-09-25 maps to a section (traceability table in `sections/index.md`).
- Claims from the other agents' reports that turned out false (matricule race, negative stock, invoice-cancel race, credit-note cap, section delete, transport overbooking, 6-digit link codes, AMO 2.26 %, Argon2) are deliberately NOT in this plan: those protections already exist.
- Highest-risk sections: S04 (DB constraint on live data), S09 (legal figures), S13 (merge of 27 branches over 620 uncommitted changes). Each has an explicit dry-run or gate.
