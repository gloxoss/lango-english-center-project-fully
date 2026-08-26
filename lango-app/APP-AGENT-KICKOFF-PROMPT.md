# Kickoff prompt for a new agent picking up SchoolOS cold

Copy everything in the fenced block below and give it to a fresh agent (new
session, background `Agent` call, or worktree-isolated session — the prompt
is fully self-contained, assumes no prior conversation context). This is the
whole-app entry point, current as of 2026-07-31. It supersedes the older
`V2-AGENT-KICKOFF-PROMPT.md` and `ATTENDANCE-AGENT-KICKOFF-PROMPT.md` (both
executed; kept for history, see `AGENT-HANDOFF.md`'s doc index).

---

```
You are working on SchoolOS, a Next.js 16 App Router + Drizzle ORM +
PostgreSQL 17 + Better Auth multi-tenant school-management SaaS, built for
Moroccan K-12 schools and language centers (French/Arabic/English UI).

Working directory:
c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app

## Read these first, in this order, before writing any code

1. `CLAUDE.md` — project rules: multi-tenant isolation is mandatory on every
   query, layered feature architecture (model/data/ui/api), no static
   placeholders, never `cd` in commands, run builds in the background.
2. `AGENT-HANDOFF.md` — THE canonical current-state document. Read the top
   status section fully before doing anything else. It has a full doc index
   at the bottom telling you which of the ~28 other root `.md` files are
   live vs historical — don't waste turns reading superseded planning docs.
3. `ARCHITECTURE.md` — the security/multi-tenancy model every route must
   follow, plus a documented open security gap (account lockout) and two
   reusable patterns (lock+reopen, severity+assignment) from the attendance
   module worth reusing rather than reinventing.
4. `MIGRATION-NOTES.md` — read before touching any migration. Contains
   three documented incident writeups you will otherwise repeat: (a) `app`
   and `migrate` are separate Docker images with independent build caches —
   `docker compose build app` does NOT rebuild `migrate`; (b) a
   hand-written migration once desynced drizzle-kit's snapshot chain,
   causing `generate` to silently re-declare already-existing tables in a
   later migration — the fix pattern (apply statement-by-statement,
   catching `duplicate_object`/`duplicate_table`/`duplicate_column`, then
   manually recording the migration hash in `drizzle.__drizzle_migrations`)
   is documented there if it happens again; (c) never trust `tsc --noEmit`
   or a migrate-log "success" message alone — verify via
   `docker compose exec db psql -U schoolos -d schoolos -c "\dt"` and real
   HTTP against a real logged-in session.

## Current state (condensed — full detail in AGENT-HANDOFF.md)

**Done and live-verified**: multi-tenant core (students, teachers,
academics, finance, timetable/scheduling with conflict detection, exams,
assessments/grading engine, CNDP compliance tracking, super-admin platform
tools), and a full attendance module (intake, register lock/reopen
lifecycle, real QR camera scanning, excuses with document upload and
mandatory reject-reasons, flag detection with severity/assignment/notes,
director audit dashboard, student heatmap).

**One open security gap**: account lockout is half-built —
`failedLoginCount`/`lockedUntil` columns and the manual-unlock admin route
exist, but nothing increments the counter on an actual failed login. See
`ARCHITECTURE.md` section "Known open gap" for the fix shape.

**Known-hardcoded, plan exists but was never executed** —
`UX-INTERACTIVITY-AUDIT-AND-FIX-PLAN.md` diagnosed these in detail and
none have been fixed as of 2026-07-31:
- Global header search (`header.tsx:78-80`) — fully decorative, no
  `value`/`onChange`.
- `users-manage-view.tsx` — fake pagination (`"Affichage de 1 à..."`
  hardcoded text, no real paging, no `DataTable`).
- `users-roles-view.tsx` — 100% fabricated data, currently unreachable
  (nothing routes to it) — either delete it or build it for real, don't
  leave it as a landmine.
- `report-card-generator-view.tsx` — zero `fetch()` calls, fully fake,
  despite real grade data existing since Section 9 of the V2 roadmap.
- ~10 other tables with no pagination at all (list in the plan file) —
  fine at small scale, not fine once a tenant has hundreds of rows.

**Deliberately deferred, not gaps**: dashboard trend deltas, charts,
activity feeds, a redesigned SMS queue page, a dedicated audit-journal
page, a teacher "today's agenda" landing view — see
`attendance-ui-comparison/00-index.json` for the reasoning per item.

## Conventions (established, don't reinvent)

- Every route: `requireRequestContext(request, allowedRoles)` →
  `requireTenant(context)` → Zod `.strict()` schema
  (`src/libs/api/validation.ts`) → tenant-scoped Drizzle query →
  `parsePagination` on GET → `recordAudit()` on mutations →
  `apiErrorResponse()` catch-all.
- Teacher-scoped reads: `getTeacherClassSectionIds` from
  `src/libs/api/teacher-scope.ts`.
- File uploads: `src/libs/api/uploads.ts`, tenant-namespaced
  (`/app/uploads/{tenantId}/{subfolder}/{filename}`), always verify tenant
  ownership before streaming bytes back.
- SMS/notifications: log-only via the real `smsMessages` table
  (`status: 'sent'` written immediately, no real carrier call, ever) — this
  is an intentional, honest convention, not a stub to "finish later". Any
  UI surfacing these must show a simulation indicator.
- "Dead LMS boilerplate" tables (`courses`, `programs`, `academicYears`,
  `academicTerms` — and formerly `studentGroups`, `timetableSlots`,
  `attendanceRegisters`/`attendanceEntries`/`attendanceAuditEvents` in
  their original form) are a recurring trap: schema exists, nothing real
  writes to it, and a stray FK sometimes still points at one. Before
  wiring a new feature to an existing column, grep for real writers first
  — don't assume a column's FK target is correct just because it compiles.
- Never trust `npx tsc --noEmit` alone. Authoritative check:
  `docker compose build app` AND `docker compose build migrate`
  (both, explicitly, every time a migration changes) in the foreground,
  then live-verify with real HTTP against a real logged-in session, then
  clean up any test data you create.
- Ponytail/simplicity discipline governs this codebase: no speculative
  abstractions, no config for values that never change, surgical diffs
  that trace directly to the request.

## Test accounts (all share one password: `Admin123!`)
- `y.elamrani@atlas.ma` — school_admin, Atlas tenant
- `admin@schoolos.ma` — school_admin, SchoolOS tenant
- `superadmin@schoolos.ma` — super_admin (cross-tenant, `tenantId: null` by design)
- A teacher account exists per tenant — check `src/scripts/seed.ts` for the exact email if you need `role: 'teacher'` specifically.

## Keeping this handoff current — do this every session, not just at the end

1. **Update `AGENT-HANDOFF.md`'s top status section** when you complete
   meaningful work — add a new dated section above the previous one, don't
   silently edit history. Move genuinely superseded content down into the
   "Historical" band, don't delete it.
2. **Add a real entry to `CHANGELOG.md`** (top of the file, above the `---`
   separator that marks the boilerplate history) — Added/Fixed/Migrations
   style, matching the existing entries.
3. **Update `MIGRATION-NOTES.md`** for anything migration-related,
   including incidents/gotchas you hit, not just the happy path.
4. If you find a real, previously-undocumented bug or gap (like the
   `studentGroupId` FK issue found this session), document it in
   `AGENT-HANDOFF.md` even if you fix it in the same session — future
   agents need to know it existed and why, not just that it's fixed now.

## If you hit a decision only the project owner can make

Stop and ask rather than guessing — don't invent a business rule that
isn't stated anywhere in the docs above. Past examples of this in practice:
the attendance register-lifecycle architecture decision, the "how strict
should unjustified-absence detection be" threshold, whether excuse
documents need real upload vs a URL field.
```
