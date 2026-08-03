# Role Portals — Shared Foundation and Master Plan

Status: planned. Admin and Super Admin remain current priorities; these portals are future implementations.

## Portal inventory

| Portal folder | Identity today | Product boundary |
|---|---|---|
| `teacher-portal` | Existing `teacher` role | Assigned teaching work only |
| `student-portal` | Existing `student` role | Authenticated learner self-service |
| `parent-guardian-portal` | Existing `parent` role + guardian links | Authorized household/child access |
| `accountant-portal` | Existing `accountant` role | Finance operations and controlled accounting |
| `librarian-portal` | Not yet in role enum | Library operations; depends on Library add-on |
| `receptionist-portal` | Existing `receptionist` role | Front desk, inquiries, visitors and appointments |
| `employee-self-service-portal` | Staff users exist; no general employee role | Own HR/payroll/leave/documents |
| `guard-security-portal` | Existing `guard` role | Gate/check-in/incident tasks only |
| `school-leadership-portal` | Permission profile, not new hard role | Principal/director/department oversight |
| `alumni-portal` | Not modeled | Graduated-person community and records |

## Current-state finding

The current sidebar is mostly the same school-admin navigation for every non-super-admin user. APIs often authorize broad role lists, while teacher scoping exists only in selected helpers. Before any portal ships, navigation and APIs must derive from the same capability/scope policy; hiding a menu is never authorization.

## Shared architecture

- Replace reliance on one fixed role enum with roles/templates + permissions + data scopes. Preserve existing role values during migration.
- A user may hold multiple assignments (teacher + department head, parent + employee) and switch active context without duplicating accounts.
- Access decision = tenant status + user status + role/capability + assignment scope + resource relationship + branch + academic/effective period.
- Build a server-owned `PortalManifest` containing allowed navigation, home widgets, quick actions and feature readiness. Client rendering consumes it but APIs reauthorize independently.
- Every portal uses one identity/session system, notifications/preferences, file access service, search, activity timeline, help/support, locale/RTL, accessibility and mobile-responsive shell.
- Add-on cards/routes are registered by the owning add-on and appear only when installed, configured, entitled and authorized.

## Shared data and APIs

- `roles`, `permissions`, `rolePermissions`, `userRoleAssignments`, `assignmentScopes`, `delegations`, `portalPreferences`, `portalConsents`, `portalAnnouncements`, `portalActivityEvents`.
- `GET /api/portal/me`, `/api/portal/manifest`, `/api/portal/home`, `/api/portal/search`, `/api/portal/activity`, `/api/portal/preferences`.
- Domain endpoints expose `.../me` or relationship-scoped services; never accept an arbitrary person ID as proof of access.
- Download links are short-lived and reauthorize; sensitive exports are audited and watermarked where useful.

## Cross-portal UX

- Home: today/next actions, deadlines, unread communications, alerts and module health—not admin KPIs copied to everyone.
- Navigation limited to the role’s jobs; global search limited to authorized entities/fields.
- Consistent loading, error, empty, offline/degraded, permission-denied, relationship-expired and add-on-unavailable states.
- Notification center with category/channel preferences, mandatory transactional exceptions, quiet hours and guardian routing.
- Context switcher for multi-role/multi-child/multi-branch assignments with a persistent visible active context.

## Security and privacy

- Default deny, server-side row/field scoping and automated tenant/relationship tests for every endpoint.
- Students never see staff private contact/payroll; guardians see only explicitly linked children; employees see only self unless assigned management capability.
- No portal exposes passwords, hashes, raw provider secrets, internal audit metadata or unrestricted bulk exports.
- Delegation/substitution is effective-dated, least-privilege, revocable and audited.
- Apply CNDP purpose limitation, retention, access/export/correction workflows and age-appropriate privacy.

## Delivery order

1. Capability/scope model, portal manifest and shared shell.
2. Teacher portal because it exercises assignment scope and existing core workflows.
3. Student and Parent/Guardian portals together because household and publication rules interlock.
4. Accountant portal after Student/Office Accounting foundations are hardened.
5. Receptionist and Guard portals around admissions/visitor/gate workflows.
6. Employee self-service and Leadership after HR/Payroll ledgers.
7. Librarian after Library add-on core circulation.
8. Alumni after graduate lifecycle and consent decisions.

## Shared acceptance

- Permission matrix and negative tests prove no cross-tenant, cross-child, cross-class, salary, finance or private-document leakage.
- Navigation manifest and APIs agree for every capability state.
- Multi-role/context switching never retains stale data from the previous context.
- Mobile, keyboard, screen-reader, Arabic RTL, French and degraded-network flows pass.
- Every role plan’s domain-specific acceptance criteria pass before enabling that portal.

