-- Backfill the multi-branch entitlement from the bespoke tenants.hasMultiBranchAddon
-- boolean so switching POST /api/settings/branches over to requireAddon() does not
-- silently revoke access from tenants that already paid for it.
--
-- tenants.has_multi_branch_addon is deliberately left in place and still written by
-- the super-admin branches route; it is the source of truth until that route is
-- migrated too. This migration only makes addon_entitlements agree with it.
INSERT INTO "addon_entitlements" ("tenant_id", "addon_id", "is_enabled", "note")
SELECT "id", 'multi-branch', true, 'backfilled from tenants.has_multi_branch_addon'
FROM "tenants"
WHERE "has_multi_branch_addon" = true
ON CONFLICT ("tenant_id", "addon_id") DO NOTHING;
