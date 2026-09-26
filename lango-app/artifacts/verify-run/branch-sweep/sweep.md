# BRANCH-SCOPE-01 c6 — full screen sweep (B6-02)

Scope: every static dashboard page (`src/app/[locale]/(dashboard)/dashboard/**/page.tsx` → 296 routes; dynamic `[id]` detail pages excluded — they need a record id, the sweep covers their list parents) × 4 users, via `scripts/visual-sweep.mjs` against a dev server on :3233 (DB schoolos, BETTER_AUTH_URL=http://localhost:3233).

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

### s4 — Lango admin (single-branch school)

(filled when the pass completes — invariant 4: identical numbers to before the campaign, no selector, no visible change)

