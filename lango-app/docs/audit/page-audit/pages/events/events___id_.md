# `/dashboard/events/[id]`

**Status: NEEDS FIX (P3)** · Module: `events` · Source: [`src/app/[locale]/(dashboard)/dashboard/events/[id]/page.tsx`](<../../../../../src/app/[locale]/(dashboard)/dashboard/events/[id]/page.tsx>)

**Progress (2026-09-23):** S-52 DONE · S-57 OPEN











Guard: `requireServerPage` · capability `events.read`

**Verdict:** 2 finding(s), worst P2. 2 sweep run(s): 2 clean or expected, 0 flagged. 2 screenshot(s).

## Findings on this page

| ID | Sev | Problem | Fix | Code now |
|---|---|---|---|---|
| [S-52](../../findings/done/S-52.md) | P2 | Parents and students can read any event by ID (drafts, staff-only) | Non-staff: only published events whose audience includes them, else 404; route them to a read-only family view. | STILL OPEN |
| [S-57](../../findings/S-57.md) | P3 | Raw enum values, two money formats, stale "current" year, overlapping widget | Translate enums; one MAD formatter; check active year; move the widget. | Not re-checked since the sweep. |

## Sweep results

| Pass | Role | URL tested | Result |
|---|---|---|---|
| Pass C | school_admin | `/dashboard/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855` | ok |
| Pass C | parent | `/dashboard/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855` | ok, 403 /api/addons/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855/tasks (data blocked, expected)<br>ok, 403 /api/addons/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855/incidents (data blocked, expected)<br>ok, 403 /api/addons/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855/feedback (data blocked, expected)<br>ok, 403 /api/settings/branches (data blocked, expected)<br>ok, 403 /api/addons/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855/communications (data blocked, expected)<br>ok, 403 /api/addons/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855/registrations (data blocked, expected) |

## Screenshots

**Pass C · detail + public pages, 2026-09-23** · school_admin · fr · `/dashboard/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855`

![school_admin fr](../../shots/C__school_admin-fr-events__d8dafbbd-6a97-4a42-a75f-c50a4891e855.jpg)

**Pass C · parent typing staff URLs (expected: blocked)** · parent · fr · `/dashboard/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855`

![parent fr](../../shots/C-idor__parent-fr-events__d8dafbbd-6a97-4a42-a75f-c50a4891e855.jpg)

## Plan

- [ ] **S-52 (P2)** Parents and students can read any event by ID (drafts, staff-only)
  - [ ] Add status + audience filter for non-staff in the GET.
  - [ ] Role-based view selection in the page.
  - [ ] Test: parent GET on a draft event returns 404.
  - [ ] Accept: Parent GET on a draft/staff-only event = 404; no management buttons.
- [ ] **S-57 (P3)** Raw enum values, two money formats, stale "current" year, overlapping widget
  - [ ] Enum label maps.
  - [ ] Single formatter.
  - [ ] Accept: No raw enum values on these pages.
- [ ] Re-run this page: `echo "/dashboard/events/d8dafbbd-6a97-4a42-a75f-c50a4891e855" > r.txt && AUDIT_BASE=http://localhost:3333 node scripts/visual-sweep.mjs school_admin r.txt`

## Cross-cutting findings that also show here

- [S-7](../../findings/S-7.md) (P1) ~1 375 hardcoded French UI strings bypass translation (Arabic UI stays French)
- [S-14](../../findings/S-14.md) (P2) Sidebar lists add-on modules the tenant has not enabled
- [S-18](../../findings/done/S-18.md) (P1) Header claims CNDP compliance on every page; the school has not filed
- [S-25](../../findings/done/S-25.md) (P2) Header shows a fake identity when the session call is slow
- [S-37](../../findings/S-37.md) (P2) Arabic: dashboard widgets stay French; brand renders "OSSchool" in RTL
- [S-41](../../findings/done/S-41.md) (P1) Auth rate limit counts every page's session check, per IP
- [S-44](../../findings/S-44.md) (P2) Staff campus switcher renders for parents, students and super admin (403 on every page)
