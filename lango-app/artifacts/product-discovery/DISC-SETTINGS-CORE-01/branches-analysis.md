# Branches / multi-site analysis

## State (dev and VPS, 2026-09-25)

- Atlas: `tenants.max_branches = 1`, plan `trial` on dev / `standard` on VPS, **2 active branches** (Siège, Annexe Maarif), **no `multi-branch` entitlement**.
- `/settings/branches` redirects to `/settings/entitlements?addon=multi-branch` (all 3 variants). The branches page is unreachable for the school.
- The Subscription page shows "Campus inclus 2 / 1 — Au-delà du forfait" (`/api/settings/addons` returns `maxBranches` = 1 and the active count = 2).
- Yet the header campus selector lists both branches, and demo data (students, classes, staff pins) uses both.

**Verdict:** seed/entitlement inconsistency. The school operates 2 campuses it is neither licensed for nor able to manage.

## Behaviour

- `GET /api/settings/branches`: readable by school_admin, super_admin, teacher, accountant, receptionist, guard, librarian (projection only: id, name, code, city, active; used by the header selector). Proven 200 for teacher/receptionist/accountant.
- Create: blocked when `totalBranches >= tenant.maxBranches` (`branches/route.ts:98`).
- Update/delete (`/api/settings/branches/[id]`): school_admin/super_admin + `settings.organization.manage`. Delete is a soft deactivate (`isActive: false`, line 101). Cross-tenant: Lango admin got 404 on PUT and DELETE of an Atlas branch.
- Branch scope of data: covered by the separate BRANCH-SCOPE-01 plan (`.ultraplan/branch-scope/`). Only 123 of 836 API routes use the server branch; the selector is browser-only today. A branch-limited admin was **not** tested here (no such user exists; BRANCH-SCOPE B1 creates the test fixture).

## Risks

- Branch closure (soft deactivate) does not check for students, classes, staff pins, open invoices or hostel/transport assets on that branch.
- `setting_values` has a branch dimension (`tenant_id, branch_id, key`), but no settings page exposes per-branch values.
- `tenants.max_branches` and the `multi-branch` add-on are two independent gates: max_branches=1 blocks creation, the add-on hides the page. Neither stops the seed from creating 2.

## Recommendation (not implemented)

Owner decision: either grant Atlas `multi-branch` + `max_branches ≥ 2` (demo school showcasing multi-site), or deactivate Annexe Maarif. Then one rule: the Branches page is visible whenever a tenant has more than one branch, even without the add-on, in read-only mode with an upgrade prompt.
