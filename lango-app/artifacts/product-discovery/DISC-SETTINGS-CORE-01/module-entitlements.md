# Module entitlements

## Server-side truth

| | Dev (`schoolos`) | VPS (live) |
|---|---|---|
| Atlas plan | trial | standard |
| `max_branches` / active branches | 1 / 2 | 1 / 2 |
| Enabled entitlements | 12: advanced-reporting, card-management, certificate-management, event-management, hostel, human-resources, inventory, lead-crm, library, live-classrooms, payroll-workforce, transport | 12: same minus live-classrooms, plus broadcast-messaging |
| `addon_definitions` rows | 18 (whatsapp and online-examinations disabled) | 19: the same plus **`test` / "test"**, `enabled = false`, created 2026-09-21 11:16 |

Dev and VPS entitlements differ (live-classrooms vs broadcast-messaging). The screenshot of 2026-09-25 was taken on the VPS.

## The "test" module

- A row `addon_definitions(id='test', name='test', enabled=false)` exists **only on the VPS**, created 2026-09-21 11:16:39 through the super-admin "addon definitions" API (`POST /api/super-admin/addon-definitions`). Three `addon_entitlement` delete events were logged in the same minute (11:17:37–11:17:49).
- The school catalogue lists every definition; disabled ones are shown as "À venir" (coming soon). So a super-admin test row is visible to every school as an upcoming module.
- Verdict: test data leaked to production through a real admin feature. Nothing is broken, but schools see a module called "test".

## "Campus inclus 2 / 1"

Real data, not a rendering bug: `tenants.max_branches` = 1, active branches = 2 (see branches-analysis.md).

## How entitlements are enforced

- `hasAddon(tenantId, addonId)` (`libs/api/entitlements.ts`) in page guards (redirect to `/settings/entitlements?addon=…`), sidebar visibility and add-on APIs.
- Redirects observed: `/settings/branches` (multi-branch), `/settings/website`, `/menu`, `/news`, `/pages` (school-website-cms).
- Module-plan downgrade: plan limits and `includedAddons` exist (`/api/super-admin/plan-limits`); a downgrade test was not run (would mutate the tenant's plan). Existing tests: `features/subscriptions/__tests__/plan-downgrade.test.ts` (5 tests, passing in the integration suite).

## Recommendation (not implemented)

Hide disabled definitions from the school catalogue unless flagged "announce"; add an environment guard so super-admin test definitions cannot be created in production (or a `visibility` column); reconcile dev and VPS entitlement seeds.
