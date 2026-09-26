# `/dashboard/settings/audit-logs`
<!-- swept: 2026-09-24 claude-finance | school_admin(fr+ar) sweep :3466 schoolos_audit 2026-09-24: loads, no failed API, no h-scroll, no text defects -->

**Status: NEEDS FIX (P2)** · Module: `settings` · Source: [`src/app/[locale]/(dashboard)/dashboard/settings/audit-logs/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/settings/audit-logs/page.tsx>)

**Progress (2026-09-26):** S-23 PARTIAL






















































































































































































Guard: `requireServerPage` · capability `audit.read`

**Verdict:** 1 finding(s), worst P2. 1 sweep run(s): 1 clean or expected, 0 flagged. 1 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-23](../../findings/S-23.md) | P2 | Audit log shows internal names and writes rows on view | Human labels; no audit on plain views; skip audit on idempotent replay. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/settings/audit-logs` | expected: harness: warm-up request aborted by the measured reload (page renders its data) |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/settings/audit-logs`

![school_admin fr](../../shots/A__school_admin-fr-settings__audit-logs.jpg)

## Plan

- [ ] **S-23 (P2)** Audit log shows internal names and writes rows on view
  - [ ] Label map.
  - [ ] Remove GET audit.
  - [ ] Guard replay.
  - [ ] Accept: One row per real action with readable labels.
- [ ] Re-run this page: `echo "/dashboard/settings/audit-logs" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/done/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
