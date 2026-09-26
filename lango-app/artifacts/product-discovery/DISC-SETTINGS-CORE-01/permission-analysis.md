# Permission and tenant-isolation analysis

Method: server-side calls only (`evidence/isolation.mjs`, raw: `evidence/isolation.json`), as 5 real users on the dev server (commit 54d386a4): Atlas director (whole-school school_admin), Atlas teacher `prof.20` (branch-locked), Atlas receptionist, Atlas accountant, Lango school_admin (tenant B). After the run, 0 rows carrying the probe marker `ISOLATION-PROBE` existed in any touched table.

## Reads (HTTP status)

| API | Atlas admin | Teacher | Receptionist | Accountant | Lango admin | Lango response contains Atlas ids |
|---|---|---|---|---|---|---|
| /api/settings | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/values | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/branches | 200 | **200** | **200** | **200** | 200 | no |
| /api/settings/custom-fields | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/numbering | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/providers | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/addons | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/permissions | 200 | 403 | 403 | 403 | 200 | no |
| /api/academics/session-years | 200 | 403 | 403 | 403 | 200 | no |
| /api/academics/semesters | 200 | **200** | 403 | **200** | 200 | no |
| /api/academics/grading-policies | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/security/login-events | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/scheduled-jobs | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/values/accounting.defaults | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/cndp-filing | 200 | 403 | 403 | 403 | 200 | no |
| /api/settings/subscription | 200 | 403 | 403 | 403 | 200 | no |
| /api/audit-logs | 200 | 403 | 403 | 403 | 200 | no |
| /api/users | 200 | 403 | 403 | 403 | 200 | no |

The two non-admin reads are intended: `/api/settings/branches` feeds the header campus selector (projection: no tenant id, no timestamps); semesters are read by teacher and accountant screens.

## Cross-tenant writes (Lango admin on Atlas identifiers)

All refused with **404** and no change: PATCH/GET/DELETE custom field, PATCH/GET numbering series, PUT session year (id in body), PUT and DELETE semester, PUT and DELETE branch. Every handler filters by `id AND tenant_id`.

## Role writes (Atlas, wrong role)

All refused with **403 FORBIDDEN**: teacher PATCH pass mark, receptionist POST organisation, accountant PUT grading policy, teacher POST session year, accountant POST custom field.

## Not tested

- **Branch-limited school_admin**: no such user exists in the data. The branch dimension of settings (`setting_values.branch_id`) is not exposed by any page. Covered by BRANCH-SCOPE-01 B1 (test fixture + helpers).
- Super-admin impersonation into settings (out of scope).

## Page guards vs API guards

Page guards (`requireServerPage` capabilities, page-map.json) match the API capabilities for the pages checked. `/settings/attendance` is guarded by `settings.attendance.manage` but has no API. `/settings/entitlements` needs only `settings.read`.

**Verdict: no tenant or role leak found in the settings surface.**
