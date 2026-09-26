# BRANCH-SCOPE-01 c6 — full screen sweep (B6-02)

Scope: every static dashboard page (`src/app/[locale]/(dashboard)/dashboard/**/page.tsx` → 296 routes; dynamic `[id]` detail pages excluded — they need a record id, the sweep covers their list parents) × 4 users, via `scripts/visual-sweep.mjs` against a dev server on :3233 (DB schoolos_audit, BETTER_AUTH_URL=http://localhost:3233).

Users:
1. `s1-director-all` — y.elamrani@atlas.ma (whole-school director), active branch **null** ("Tous les sites")
2. `s2-director-maarif` — same director switched to **Annexe Maarif** via POST /api/portal/branch (reset to null after)
3. `s3-accountant-maarif` — accountant@atlas.ma (**locked** to Annexe Maarif)
4. `s4-lango-admin` — admin@lango.ma (single-branch school)

## Numbers vs `check:branch-parity` (API-level, verified 2026-09-26)

| User | data.studentDistribution.totalActiveStudents | Parity expectation | Result |
|---|---|---|---|
| director, Tous les sites | **200** | 149 Siège + 51 Maarif + 0 unassigned = 200 (invariant 3) | ✅ |
| director, Annexe Maarif | **51** | Maarif subset = 51 | ✅ |
| accountant (locked Maarif) | summary API 403 (capability `dashboard.view` not in accountant defaults — role noise, not branch) | their scoped finance data: invoices total = **51** (verified live, bs-c1) | ✅ |
| Lango admin | **2** | single-branch unchanged vs B0 baseline (invariant 4) | ✅ |

Invoices cross-check (locked accountant, Maarif): GET /api/finance/invoices → exactly **51** rows, total meta = 51 — zero Siège rows.

## Per-page sweep results

Sweeps run in 3 concurrent shards per user (a/b/c); each writes `sweep-<role>-fr-<shard>.json` + one screenshot per page in its directory.

### s1 — director, "Tous les sites" (296/296 pages)

- **5xx pages: 0** — no server error on any page or API call.
- **Branch blockers: 0.** No cross-campus data visible (the director sees everything by design; the numbers check above pins the split: 200 all, 51 on Maarif).
- 235 pages fully clean. The rest carry only attributed non-branch noise:
  - `IntlError MISSING_MESSAGE Navigation.parentGrades` console error on ~235 pages — grc-05 (claude-finance) added a sidebar entry without the locale keys. Attributed, not branch-related. Trivial locale fix for the owner.
  - `GET /api/settings/logo → 404` on every page — cosmetic, settings ownership, no branch component.
  - 58 redirects, all role/entitlement by design: 20 → `/dashboard/access-denied` (role gates), 15 → `/dashboard/settings/entitlements` (add-on not enabled), 12 → `/dashboard` (role landing), 11 → feature redirects (collection-desk, readiness, exam-master, grading policies, etc.).
  - 3 × broadcast API 403 from communication pages — add-on entitlement (ADDON_NOT_ACTIVATED/capability), requests refused, nothing leaked.
  - `raw i18n key «SMS.ma»` on /dashboard/settings — text-check false positive (brand name).
- `class-subjects` grep across s1 JSONs and the server log: no class-subjects failures (the picker API is called from exam-planning/marksheet pages; its branch-limit 500 needed the count-join fix — pinned by `class-subjects-count-join.test.ts` instead).

### s2 — director switched to Annexe Maarif (296/296 pages)

- **5xx pages: 0.**
- **Branch blockers: 0.** Summary = 51 students, activeBranchName "Annexe Maarif"; every scoped page renders Maarif data only.
- 236 pages fully clean; same noise profile as s1 (same locale-key error, same logo 404, same redirect families, broadcast 403s).
- Director branch was reset to null after this sweep (verified 200).

### s3 — locked accountant (Annexe Maarif, hard lock) (296/296 pages)

- **5xx pages: 0** — the owner's key concern (a campus-limited caller hitting the class-subjects count-query 500) is closed: the fix landed before this pass and every finance/academics page the accountant can reach renders without a server error. The regression is also pinned by `src/app/api/__tests__/class-subjects-count-join.test.ts` (3/3: branch-limited caller 200, ?search= 200, no-match 200/0).
- **Branch blockers: 0.** Every finance page shows Maarif-only data (invoices total = 51, verified API-side above).
- Redirects, all role-based by design: 211 → `/dashboard/access-denied` (accountant role gates on students/academics/HR pages), 28 → `/dashboard/finance` (accountant role landing), 2 → collection-desk, 1 → inventory overview.
- 9 flagged pages, all one pattern: the shell page renders (200) while one capability-gated API inside answers 403 — `workforce/payroll/config`, `workforce/punches`, `workforce/payments`, `accounting periods reopen-requests`. That is the documented maker/checker separation (accountant is payroll-review-only), not branch scope; nothing leaked, nothing crashed.
- First attempt at this pass was discarded: the dev server died mid-run (exit 127), so partial results would have been garbage. This is the clean rerun after the restart; the compile cache made it fast.

### s4 — Lango admin (single-branch school) (296/296 pages)

- **5xx pages: 0.**
- **Branch blockers: 0.** Invariant 4 verified at the API level: summary `totalActiveStudents` = **2**, `branchScope: all`, `availableBranches: []` (no selector) — identical to the B0 baseline. Lango's two pages of real content render unchanged; nothing branch-related changed for single-branch schools.
- 287 pages redirect to `/dashboard/settings/onboarding` — **attributed, not branch-scope**: this is the SETTINGS-CORE-FIX-01 onboarding gate (`features/settings/services/onboarding-completeness.ts`, requires logo + address + a current session year) finding the Lango dev tenant incomplete. bs-1's earlier sweep predated that gate's landing in the tree. Follow-up for the settings owners: complete Lango's logo/address/year in dev, or re-baseline the tenant.
- 2 console noise flags: `Navigation.attendance-appel` missing from locales (attendance-reform sidebar entry, claude-agentb's claim) — same class as the `parentGrades` noise above.

### s5 — attendance re-sweep after merge f10b77ac (11 pages × 3 users = 33 page visits)

Re-sweep of all 11 attendance-related dashboard routes after the attendance reform merge (`f10b77ac`) and the bs-c7 campus guard pass across 10 attendance route files. Tested against dev server on :3233 backed by `schoolos_audit`.

Routes swept (11):
`/dashboard/attendance`, `/dashboard/attendance/audit`, `/dashboard/attendance/badges`, `/dashboard/attendance/excuses`, `/dashboard/attendance/flags`, `/dashboard/attendance/qr-reports`, `/dashboard/attendance/scanner`, `/dashboard/attendance/suivi`, `/dashboard/parent/attendance`, `/dashboard/settings/attendance`, `/dashboard/workforce/timeclock`.

1. **s5a — director, "Tous les sites" (y.elamrani@atlas.ma, active branch null):**
   - **5xx pages: 0** — zero server errors.
   - **Branch blockers: 0.**
   - 10 pages rendered directly (200). 1 redirected to `/fr/dashboard/access-denied`: `/dashboard/parent/attendance` (school_admin lacks parent role; expected RBAC).
   - Only failure recorded: `GET /api/settings/logo → 404` (cosmetic missing asset on audit DB, non-blocking).
   - Text defects: 0. Horizontal scroll: 0.

2. **s5b — director switched to Annexe Maarif (branch `41a9816d-3467-4e6e-a39c-5f80f12faeb0`):**
   - **5xx pages: 0.**
   - **Branch blockers: 0.** Renders strictly Maarif-scoped attendance data, zero cross-campus leak.
   - 10 pages rendered directly (200). 1 redirected: `/dashboard/parent/attendance` → `/fr/dashboard/access-denied` (expected RBAC).
   - Only failure recorded: `GET /api/settings/logo → 404`.
   - Text defects: 0. Horizontal scroll: 0.

3. **s5c — locked accountant (accountant@atlas.ma, hard lock to Annexe Maarif):**
   - **5xx pages: 0.**
   - **Branch blockers: 0.**
   - 3 pages rendered (200): `/dashboard/attendance/audit` (36 nodes), `/dashboard/attendance/badges` (36 nodes), `/dashboard/attendance/flags` (36 nodes), plus `/dashboard/workforce/timeclock` (206 nodes).
   - 8 pages redirected to `/fr/dashboard/access-denied`: accountant role is properly locked out from school attendance management (`/attendance`, `/excuses`, `/qr-reports`, `/scanner`, `/suivi`, `/settings/attendance`, `/parent/attendance`).
   - Flags: `403 /api/workforce/punches` on `/dashboard/workforce/timeclock` (accountant role maker-checker boundary), `403 /api/settings/logo`.
   - Text defects: 0. Horizontal scroll: 0.


## Verdict

**1217 page visits (s1–s4 296 × 4 + s5 11 × 3): 0 blocking rows.** Zero 5xx anywhere, zero cross-campus data visible to campus-limited users, Lango's single-branch numbers identical to the B0 baseline. Every non-clean flag is attributed to a named owner outside branch scope (locale keys: grc-05 + attendance-reform; onboarding redirect: settings-core + Lango dev data; capability 403s: maker/checker and add-on entitlements; role redirects: page guards).

Blockers for release: **none from this sweep.**


## NOT DONE

The following branch-scope follow-ups remain outside the scope of bs-c6 / bs-c7:

1. **Add-on route families pending branch scoping (bs-c3, ~271 routes):**
   - Broadcast (`/api/addons/broadcast/**`): automations, campaigns, connections, templates, worker.
   - Hostel (`/api/addons/hostel/**`): hostels, rooms, allocations, roll-calls, applications.
   - Guard & Reception (`/api/guard/**`, `/api/reception/**`): gate scanning, kiosk sessions, visitor passes, handoffs, student pickups.
   - Library (`/api/addons/library/**`): catalog, circulation, loans, charges, stocktakes.
   - Transport (`/api/transport/**`): vehicles, routes, stops, allocations, rider events.
   - Inventory (`/api/addons/inventory/**`): stores, products, stock movements, purchases, transfers, adjustments.
   - Events (`/api/addons/events/**`): events, audiences, communications.
   - Remaining baseline routes recorded in `scripts/branch-scope-baseline.json`.

2. **Registry review items awaiting subsystem alignment (`src/libs/api/branch-scope-registry.ts`):**
   - Routes marked `mode: 'review', review: true`, such as `/api/academics/exam-schedules`, `/api/academics/exam-schedules/staff`, and `/api/academics/subject-teachers`.

3. **Student admission / creation form campus picker:**
   - Add explicit campus selection on new student registration/admission wizard when multiple branches exist in the tenant.

4. **Teacher assignments exemption follow-up:**
   - Per product owner ruling: "TEACHER RULE = ASSIGNMENTS WIN". Admin assignment manager remains campus-locked; teacher-facing assessment/grading endpoints (`marksheet`, `online-exam`, `homework`) to receive assignment exemptions in a dedicated wave so teachers assigned to cross-campus classes can grade their assigned students.
