-- Director must be tenant-wide: a branch-pinned admin is confined by the API
-- (requested branch != context.branchId -> 403), which would block the demo.
UPDATE "user" SET branch_id = NULL
WHERE tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
  AND email = 'y.elamrani@atlas.ma';
