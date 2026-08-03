# Critical Review: "SchoolOS Attendance System Enhancement" Master Handoff Prompt

**Reviewed 2026-07-31**, by checking every factual claim in the prompt against the actual repository — not by trusting the prompt's own framing.

## Verdict

The prompt is **usable but has one dangerous gap and two smaller factual errors**. The good news: the attendance work it describes is real and substantial (not vaporware) — a full elaborate schema, routes, and a UI with QR-scanner/quick-action buttons already exist. The bad news: **none of the new schema has ever been migrated to the live database**, and the prompt's own "Verify & Validate" section (`tsc --noEmit` + `docker compose up -d --build`) will not catch that, because it's exactly the class of bug this codebase has already been bitten by twice this session.

## Factual errors in the prompt (fix before handing it to a fresh agent)

1. **Wrong "project root."** The prompt tells the agent to read `PRODUCT-TRUTH.md` "in the project root," but the working directory it also specifies is `lango-app/`. `PRODUCT-TRUTH.md` and the whole `attendance-plan/` directory actually live **one level above** `lango-app/`, at `Documents/lango/` (a sibling of `lango-app`, `insperations/`, etc.), not inside it. A fresh agent literally following "project root = working directory" will fail to find either.
2. **`SCHOOLOS_ATTENDANCE_DESIGN.md` doesn't exist under that name anywhere in the tree.** The real design tokens live at `attendance-plan/02_DESIGN_SYSTEM.md`. Minor, but a fresh agent will burn a turn searching for a file that isn't there.
3. Everything else file-path-wise checks out: `attendance-plan/00_MASTER_INDEX.md` through `05_RESEARCH_ANALYSIS_REPORT.md` and `sections/section-01` through `section-05` all exist exactly as listed.

## What's actually already built (verified directly, not assumed)

- **Schema**: all 6 claimed tables (`attendanceRegisters`, `attendanceEntries`, `attendanceSummary`, `attendanceExcuses`, `attendanceFlags`, `attendanceAuditEvents`) genuinely exist in `src/models/Schema.ts`, with real relations wired in `Relations.ts` (29 references).
- **Routes**: `src/app/api/attendance/summary/route.ts` and `src/app/api/attendance/excuses/route.ts` are real, non-trivial implementations (GET/POST/PUT, tenant-scoped, real Drizzle queries against the new tables) — not stubs.
- **Helper**: `src/libs/api/attendance-summary.ts` (the claimed `recalculateStudentAttendanceSummary` utility) exists.
- **UI**: `attendance-view.tsx` genuinely has the QR scanner modal (state + modal markup), "Tout Présent"/"Tout Absent" quick-action buttons, and calls `/api/attendance/summary` on load — this is real, built UI, not a mockup.

This means whoever built this did real, substantial work — the prompt isn't describing fiction. That makes the one real gap below more dangerous, not less: it's easy to assume "this all obviously works" and skip checking it.

## The one thing that will actually break in production

**Grepped every migration file in `migrations/*.sql` — zero of them create `attendance_registers`, `attendance_entries`, `attendance_summary`, `attendance_excuses`, `attendance_flags`, or `attendance_audit_events`.** These tables exist only as TypeScript schema definitions, never applied to the live Postgres database. `GET /api/attendance/summary` and `GET/POST/PUT /api/attendance/excuses` will fail with a `relation "attendance_summary" does not exist`-class error the moment they're called against the real database — this is not a guess, it's the same deterministic failure mode already documented twice in this repo's own `MIGRATION-NOTES.md` (once for the Section 8-12 pass, once for the V2 roadmap pass). I wasn't able to hit this live just now (Docker Desktop isn't running on this machine at the moment), but the migration-file grep is conclusive on its own — a missing `CREATE TABLE` is not ambiguous.

**The prompt's own verify steps won't catch this:**
- `npx tsc --noEmit` passes fine — this is a runtime/schema-migration gap, not a type error.
- `docker compose up -d --build` builds images; it does not, on its own, guarantee the `migrate` service actually ran against a fresh image (see this repo's own documented incident: `app` and `migrate` are separate Docker images with independent build caches).

**Fix for the prompt, concretely — replace its "3. Verify & Validate" section with:**
1. `npx drizzle-kit generate` (if a migration for these tables genuinely doesn't exist yet — confirm first) then `docker compose build migrate` explicitly (not just `docker compose build app`).
2. `docker compose up migrate` and read its output for `[✓] migrations applied successfully!` — then independently confirm via `docker compose exec db psql -U schoolos -d schoolos -c "\dt"` that `attendance_summary` etc. actually appear as real tables, not just trust the migrate log.
3. Only then hit `GET /api/attendance/summary` and `GET /api/attendance/excuses` with a real logged-in session and confirm `200`, not the current guaranteed failure.
4. Confirm tenant isolation on both new routes the same way every other route in this app has been checked (second tenant's session sees none of the first tenant's rows) — the prompt's success criteria mentions tenant isolation as a requirement but names no concrete way to verify it.

## One architectural question the prompt never addresses

There are now **two attendance data models** in the same schema: the original simple `attendance` table (id, tenantId, studentId, date, status — what the rest of the app, dashboard summary, class-results roster, and analytics already depend on) and the new elaborate 6-table model. `attendance-view.tsx` itself straddles both — it POSTs daily marks to the old `/api/attendance` (simple table) but reads its summary stats from the new `/api/attendance/summary` (new table). **Nothing in the prompt or the section files (as far as this review checked) states whether `attendanceSummary` is meant to be a materialized/derived view fed by the old `attendance` table, or a fully separate parallel system.** Before building further on this, whoever picks it up should confirm: does `recalculateStudentAttendanceSummary` in `src/libs/api/attendance-summary.ts` actually read from the old `attendance` table and write into the new `attendanceSummary` table (a real bridge), or are they currently disconnected? This wasn't fully traced in this review pass — flag it as the first thing to check before adding more features on top.

## Unverified skill references

The prompt tells the agent to apply `/next-best-practices` and follow `/ultraplan`. `/ultraplan` is a real, available skill (used earlier this session). `/next-best-practices` was not found in this environment's available-skills list — a fresh agent instructed to "apply" a skill that doesn't exist may either silently skip it or hallucinate its contents. Worth removing or replacing with concrete written rules (RSC boundaries, async `params`, etc. — just state them directly in the prompt rather than delegating to an unverified skill name).

## Bottom line for whoever runs this prompt next

Fix the two path errors, and — most importantly — **do not trust that this module "already works" just because the code looks complete.** Run the migration-and-live-verify sequence above first, before touching any of the enhancement tasks in section 2 of the prompt. If the tables are missing, generating and applying that one migration is probably a 15-minute fix that unblocks everything else in the prompt.
