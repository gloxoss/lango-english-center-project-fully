# Section 02: Branch Management APIs & Context Integration

## Overview
Builds the REST API endpoints for Branch CRUD, Super Admin branch controls, and integrates active branch selection into `requireRequestContext`.

## Risk: [green] — Standard REST handlers + Drizzle queries

## Tasks

<task type="auto" id="02-01">
  <name>Create Tenant Branch REST API Endpoints</name>
  <files>src/app/api/settings/branches/route.ts, src/app/api/settings/branches/[id]/route.ts</files>
  <action>
    Implement GET (list tenant branches), POST (create branch with maxBranches validation check), PUT (update branch info), DELETE (soft-deactivate branch unless default).
    Enforce tenant isolation via `requireRequestContext(req)`.
  </action>
  <verify>Curl or fetch `/api/settings/branches` with session cookie to verify JSON response.</verify>
  <done>Full CRUD REST API active for tenant branch management.</done>
</task>

<task type="auto" id="02-02">
  <name>Create Super Admin Branch Management Endpoint</name>
  <files>src/app/api/super-admin/schools/[id]/branches/route.ts</files>
  <action>
    Implement GET and PATCH endpoints under Super Admin to view branches of any tenant school and toggle `hasMultiBranchAddon` flag / set `maxBranches` quota.
  </action>
  <verify>Test Super Admin API endpoint with super_admin role session.</verify>
  <done>Super admin can configure multi-branch addon entitlement per client school.</done>
</task>

<task type="auto" id="02-03">
  <name>Extend Request Context with Active Branch Scope</name>
  <files>src/libs/api/context.ts</files>
  <action>
    Update `requireRequestContext` to parse `x-branch-id` header or `activeBranchId` query param and attach `branchId?: string` to the request context object.
  </action>
  <verify>Run typecheck and verify `ctx.branchId` is available in downstream route handlers.</verify>
  <done>Request context cleanly exposes active branch scope.</done>
</task>
