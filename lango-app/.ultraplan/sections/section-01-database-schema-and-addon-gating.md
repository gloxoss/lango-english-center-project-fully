# Section 01: Database Schema & Addon Licensing

## Overview
Defines the `branches` table, updates `tenants` table with multi-branch addon flags (`hasMultiBranchAddon`, `maxBranches`), and adds optional `branchId` foreign keys to `user`, `classes`, and `invoices`.

## Risk: [green] — Standard Drizzle ORM migrations

## Tasks

<task type="auto" id="01-01">
  <name>Define branches table and tenant addon flags in Drizzle Schema</name>
  <files>src/libs/db/schema.ts</files>
  <action>
    Add `branches` table definition: `id`, `tenantId`, `name`, `code`, `city`, `address`, `phone`, `email`, `isDefault`, `isActive`, `createdAt`, `updatedAt`.
    Add `hasMultiBranchAddon` (boolean, default false) and `maxBranches` (integer, default 1) to `tenants` table.
    Add `branchId` nullable UUID foreign key referencing `branches.id` on `user`, `classes`, and `invoices` tables.
  </action>
  <verify>Run `npx drizzle-kit generate` or `npm run check:types` to confirm schema compiles without errors.</verify>
  <done>Schema defines `branches` table and foreign key relationships cleanly.</done>
</task>

<task type="auto" id="01-02">
  <name>Create Default Branch Auto-Provisioner Migration Helper</name>
  <files>src/libs/db/seed-branches.ts</files>
  <action>
    Implement helper function `ensureDefaultBranch(tenantId: string)` that checks if a tenant has a branch. If none exists, creates `"Campus Principal"` (code `"MAIN"`, `isDefault: true`) and links existing unassigned records (`branchId: null`) to it.
  </action>
  <verify>Run seed script or test helper with a test tenant ID.</verify>
  <done>All tenants have at least 1 default branch and backwards compatibility is preserved.</done>
</task>
