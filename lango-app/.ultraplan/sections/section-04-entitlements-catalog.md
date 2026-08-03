# Section 04: Tenant Entitlements Catalog

## Overview
`entitlements-catalog-view.tsx` shows a hardcoded `MOCK_MODULES` array and static quota text. A real entitlements system exists (`addonEntitlements` table, `src/addons/registry.ts`, `src/app/api/super-admin/entitlements/route.ts`) but that API is super-admin-scoped (cross-tenant management). This page needs a tenant-facing "what add-ons does MY school have" read view - a different, narrower endpoint, not a copy of the super-admin one.

## Risk: [yellow] - security-sensitive (must not let a tenant read/modify another tenant's entitlements or the super-admin-only fields), otherwise straightforward

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: GET /api/settings/entitlements (new, tenant-scoped) returns only the calling tenant's addonEntitlements rows, never another tenant's
- Test: this route is read-only - no PATCH/POST (entitlement changes stay super-admin-only via the existing route) - assert POST returns 405
- Test: a tenant with zero addonEntitlements rows gets the addon registry's defaults, not an empty list (matches hasAddon()'s existing fallback logic)

## Tasks

<task type="auto" id="04-01">
  <name>Build read-only /api/settings/entitlements route</name>
  <files>src/app/api/settings/entitlements/route.ts (new)</files>
  <action>
    GET only. requireRequestContext(['school_admin']), requireTenant. Join src/addons/registry.ts's ADDON list against this tenant's addonEntitlements rows (reuse the same hasAddon()-style resolution already in src/libs/api/entitlements.ts rather than re-implementing it) to return { id, name, description, enabled, expiresAt } per addon. No mutation endpoints - entitlement grants stay exclusively in super-admin's route, this is read-only by design.
  </action>
  <verify>curl as a school_admin from tenant A, confirm tenant B's entitlements never appear; curl POST, confirm 405</verify>
  <done>Route returns real per-tenant addon status, provably can't leak or mutate cross-tenant</done>
</task>

<task type="auto" id="04-02">
  <name>Wire entitlements-catalog-view.tsx to the real route, remove MOCK_MODULES</name>
  <files>src/features/settings/ui/entitlements-catalog-view.tsx</files>
  <action>
    Replace MOCK_MODULES with a real fetch to GET /api/settings/entitlements. Remove the static "840/1200 (70%)" quota text entirely unless a real quota concept exists in the schema (it doesn't, per the audit) - if the design needs a quota number, that's a new feature decision outside this remediation's scope, so just remove the fake number rather than inventing a quota system.
  </action>
  <verify>tsc --noEmit clean; page shows real enabled/disabled state matching the addonEntitlements table for a test tenant</verify>
  <done>No MOCK_MODULES reference remains; no fabricated quota text remains</done>
</task>
