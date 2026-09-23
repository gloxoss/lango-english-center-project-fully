# `/dashboard/events`

**Status: NEEDS FIX (P3)** · Module: `events` · Source: [`src/app/[locale]/(dashboard)/dashboard/events/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/events/page.tsx>)

Guard: `requireServerPage` · capability `events.read`

**Verdict:** 1 finding(s), worst P3. 4 sweep run(s): 3 clean or expected, 1 flagged. 4 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-57](../../findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | Translate enums; one MAD formatter; check active year; move the widget. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass A | school_admin | `/dashboard/events` | expected: → /fr/dashboard/settings/entitlements (add-on off or access denied, correct gating) |
| Pass A | teacher | `/dashboard/events` | expected: → /fr/dashboard/teacher (denied, sent to the role's own home; fine unless the sidebar shows this link, see S-32)<br>**S-41**: 429 /api/auth/get-session<br>**S-41**: 429 rate-limited |
| Pass B | school_admin | `/dashboard/events` | ok |
| Pass B | teacher (prof.01) | `/dashboard/events` | ok |

## Screenshots

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · school_admin · fr · `/dashboard/events`

![school_admin fr](../../shots/A__school_admin-fr-events.jpg)

**Pass A · main DB (:3111/:3222), 2026-09-22/23** · teacher · fr · `/dashboard/events`

![teacher fr](../../shots/A__teacher-fr-events.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · school_admin · fr · `/dashboard/events`

![school_admin fr](../../shots/B__school_admin-fr-events.jpg)

**Pass B · seeded audit DB, all add-ons, 2026-09-23** · teacher · fr · `/dashboard/events`

![teacher fr](../../shots/B__teacher-fr-events.jpg)

## Plan

- [ ] **S-57 (P3)** Raw enum values, two money formats, stale "current" year, overlapping widget
  - [ ] Enum label maps.
  - [ ] Single formatter.
  - [ ] Accept: No raw enum values on these pages.
- [ ] Re-run this page: `echo "/dashboard/events" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs teacher r.txt`

## Cross-cutting findings that also show here

- [S-41](../../findings/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
