# Parent / Guardian Portal — Execution Plan

> Companion to `future-implementation/parent-guardian-portal/PARENT-GUARDIAN-PORTAL-PLAN.md`
> and the Role Portals Foundation. This file is the atomic, gate-per-phase working
> plan, grounded in the **current real state** of the repo (audited 2026-08-08,
> live tree on :3002, Postgres via Docker, tenants Atlas
> `ca40c88e-339c-4fea-b5c4-51d5c9cc0239` and Lango `f62f31eb-1fc8-4102-9145-a5ce0bca989b`).
> See `DOWNSTREAM-INTEGRATION-NOTES.md` for the Foundation contract conformance +
> gap documentation required by the wave rules.

## 0. Real-state audit result

### 0.1 Working-tree baseline (`git status --short`, 2026-08-08)

The tree is shared with several concurrent agents. Relevant concurrent state:

- Shared contracts currently modified by others: `src/models/Schema.ts`,
  `migrations/meta/_journal.json`, `src/libs/api/permissions.ts`,
  `src/libs/api/portal-manifest.ts`, `src/components/shared/sidebar.tsx`,
  `src/app/[locale]/(dashboard)/dashboard/layout.tsx`, `src/middleware.ts`,
  `src/app/[locale]/(dashboard)/dashboard/parent/page.tsx`.
- Migration journal max observed: **idx 86 = `0085_office_accounting_foundation`**
  (a newer migration than earlier plans assumed). The Parent Portal migration is
  allocated **`0086_parent_guardian_portal`** at integration time, from the
  actual current journal (never `drizzle-kit generate`; hand-written SQL).
- Everything untracked under `future-implementation/**`, `src/features/portal/**`,
  `src/app/api/portal/**`, `src/libs/api/{portal-scope,page-guard}.ts`,
  `src/components/shared/{portal-role-switcher,portal-state}.tsx`,
  `scripts/verify-portal-foundation.mjs`, `scripts/apply-0083.mjs`,
  `DOWNSTREAM-INTEGRATION-CONTRACT.md` is Foundation-owned.

**Shared-file rule applied:** before every shared-file edit I rerun
`git status --short`, read the file fresh, preserve concurrent changes, and
avoid broad formatting.

### 0.2 Foundation status (verified by direct code read — not assumed)

The Role Portals Foundation is **shipped and hardened in the current tree**:

- `resolveActiveContext` (src/features/portal/services/active-context.ts) REBINDS
  the stored context to the authenticated user (`row.userId !== principal.id` →
  row dropped), REVALIDATES `activeBranchId` against `principal.branchId` and the
  tenant-owned branch row, and re-checks `isRoleAssignable` before serving.
  Stale/forged contexts are deleted, never silently kept.
- `portal_active_contexts` is keyed by the Better-Auth session id; role switching
  only through `POST /api/portal/role` → `isRoleAssignable`; `DELETE /api/portal/role`
  resets. Never in a cookie / localStorage / query param.
- `getServerUserContext` (src/libs/auth/server-context.ts) mirrors
  `requireRequestContext` for server components; `requireServerPage` (page-guard.ts)
  enforces `allowedRoles` + `requiredCapability` on pages.
- `DOWNSTREAM-INTEGRATION-CONTRACT.md` is **published** at the repo root and
  current; it documents the `/api/portal/*` shapes, §4 "Building a new role
  portal", and §5 verification baseline. This resolves the earlier "downstream
  contract not yet published" dependency: it exists now and the Parent Portal
  builds against it.

**The one remaining gap this workstream must close — WITHOUT patching Foundation
primitives:** `hasGuardianIdentity`, `isGuardianOfStudent`, `portal-home.parentHome`
and `portal-search` treat **any** `guardians.userId → guardian_students.studentId`
row as valid access. They do **not** enforce an *effective* relationship state
(status / effective_from / effective_to), per-relationship rights
(`academic`, `attendance`, `finance`, `pickup`, `medical`, `communication`),
custody/legal restrictions, or financial responsibility. Per the wave rules I do
**not** modify those primitives to add the behavior; the Parent Portal adds its
own **feature-local** `relationship-resolver.ts` and enforces it on every
`/api/guardian/**` route.

### 0.3 Authoritative identity chain

```
Better-Auth session userId
  → user row      (role='parent', tenantId, userStatus='active', branchId)
  → guardians row (userId=session user, tenantId)        ← the guardian ENTITY
  → guardian_students (guardianId→guardians.id, studentId→user.id, tenantId,
                       relationshipType, isPrimaryContact, isEmergencyContact,
                       canPickup, + [NEW] lifecycle/rights columns)
  → user row      (id=studentId, role='student', tenantId, userStatus)   ← child
```

No client-selected child id, localStorage, cookie, or query parameter is ever
authorization. Every request re-derives the effective relationship server-side.

### 0.4 Requirement classification (spec → real state)

| Spec journey | Real state | Class |
|---|---|---|
| Guardian identity / relationship authz | Foundation exists; NO effective-state/rights; only staff `access-reset` links accounts; no self-service invite | **present-but-insecure / must-build** |
| Household home + child switcher | `ChildContextSwitcher` (hardcoded mocks), `parentHome` (unscoped), `/dashboard/parent/page.tsx` renders the STAFF `ParentsGuardiansView` with no page guard | **must-replace** |
| Child overview / academics (results/homework) | No parent results endpoint; `resultPublications`+`moderationState='published'` exist; homework GET is unscoped (IDOR) | **present-but-insecure / genuinely-new** |
| Attendance / excuses | summary/heatmap/excuses parent-callable but **no guardian-link check** (IDOR); excuse submit exists parent-side unscoped; approval workflow exists (staff PATCH) | **present-but-insecure** |
| Parent Finance | statements unscoped (IDOR); invoices/payments staff-only; `parents/[id]/payments` gated on `guardians.read` (parent lacks); `invoices` links `studentId` | **present-but-insecure / gated** |
| Communication / meetings | announcements GET parent-callable but `targetClassSectionId` ignored (class leak); `meeting-slots/book` correctly link-gated | **present-but-insecure / reusable** |
| Requests / documents / consents | nothing parent-facing; token pattern exists (`accountSetupTokens`, `regenerate-access` invite_link); uploads.ts/blob-store/malware-scan exist | **genuinely-new** |
| Settings / preferences | `portal_preferences` allowlist (locale/theme/navCollapsed/notificationsEnabled); sessions API exists | **reusable + extend allowlist** |
| Integrations (narrow adapters) | transport self-service/guardian, hostel guardian/me, live-class join, meeting book — all link-gated and reusable; hostel leave-pass guardian approver logic exists but no route | **reusable + narrow additions** |
| UI / accessibility | French app-wide, `[locale]` routing; no Arabic/RTL surface for parents; existing portal views (PortalStateView) to reuse | **genuinely-new** |

### 0.5 Existing parent-accessible surfaces to REUSE (never rebuilt)

- `GET /api/transport/self-service/guardian` (parent + `transport` addon, link-gated)
- `GET /api/addons/hostel/guardian/me` (parent + `hostel` addon, link-gated)
- `POST /api/academics/meeting-slots/book` (guardian resolved via `guardians.userId`, link verified)
- `POST /api/academics/assignments/submit` (parent submits for a linked child)
- Live-classrooms `join-service.ts` parent viewer path (link-gated)
- `POST/DELETE /api/portal/role`, `GET /api/portal/{me,manifest,home,search,activity,preferences}`
- Staff guardian ledger `GET /api/students/parents/[id]/payments` (household invoices+payments)

### 0.6 Insecure surfaces the Parent Portal must NOT reuse as-is

These are callable by a `parent` today with an arbitrary `studentId` and only a
tenant check — a cross-student IDOR class. The Parent Portal builds its **own**
relationship-scoped endpoints and does **not** change the shared routes (they
serve staff; other roles depend on their authz):

- `GET /api/finance/statements`
- `GET /api/attendance/summary`, `GET /api/attendance/heatmap`, `GET/POST /api/attendance/excuses`
- `GET /api/academics/homework`
- `GET /api/communication/announcements` (class-section leak)

## 1. Scope decision

**In scope (fully implemented + live verified):**
- Effective guardian relationship lifecycle + per-relationship rights + custody
  restrictions (migration 0086).
- Feature-local relationship resolver + authorization gate used by every
  `/api/guardian/**` route.
- Guardian self-service account link flow (secure token; no password exposure).
- Household home, child switcher (real data), child overview, academics
  (published results + homework), attendance + excuses, finance, communication +
  meetings, requests/documents/consents, settings/preferences, narrow addon
  integrations (transport/hostel/events/meetings/live-class), FR + Arabic/RTL,
  mobile-first, WCAG 2.2 AA.
- Docs + verification: `IMPLEMENTATION-REPORT.md`, `AUDIT-RESPONSE.md`,
  `MANUAL-TESTING.md` (+ this PLAN + DOWNSTREAM-INTEGRATION-NOTES.md).

**Deferred (explicitly, with reasoning):**
- Online payment processing / PSP integration (the school's finance flow is
  cashier-driven; Parent Finance is read + receipt + request, matching source
  state exactly).
- Real-time messaging/Chat inbox (out of scope; announcements + meeting booking
  cover the spec's communication journeys; any future inbox is a new addon).
- Full Arabic *content* translation of every admin surface (Parent Portal ships
  FR + Arabic/RTL for its own pages; the rest of the app remains FR as today).

## 2. Architecture

- **Feature dir:** `src/features/parent/**` (`models/`, `services/`, `data/`,
  `ui/`) following the layered convention.
- **API namespace:** `/api/guardian/**` — the approved parent self-service path.
  Every route: `requireRequestContext` → `requireTenantId` → role must be the
  effective `parent` (allowedRoles `['parent']`) → feature-local relationship
  gate → strict `parseJson` → `recordAudit` on sensitive mutations.
- **Page namespace:** `/dashboard/parent/**` (existing parent pages live here).
  `dashboard/parent/page.tsx` is REPLACED with the real household home + guard;
  `dashboard/parent/live-classes/page.tsx` is kept.
- **Relationship rights:** migration 0086 alters `guardian_students` (adds
  lifecycle + rights columns); the `guardianStudents` pgTable in
  `src/models/Schema.ts` gains the matching columns (coordinated shared-file
  edit). A feature-local `parent-schema.ts` barrel line is not needed if the
  columns live on the existing table — only `Schema.ts` + migration change.
- **New resolver:** `src/features/parent/services/relationship-resolver.ts`
  (`resolveEffectiveChildren`, `assertRelationshipAccess(tenantId, guardianUserId,
  relationshipIdOrStudentId, rights, opts)`) — feature-local; Foundation
  primitives are untouched.
- **Account link flow:** guardian self-link via a one-time hashed setup token
  (reuse `accountSetupTokens` pattern from `regenerate-access`); never returns a
  password to the browser.
- **Addon degradation:** every addon-backed widget/route calls `requireAddon`;
  when disabled the parent page renders the PortalStateView addon-unavailable
  state, never a 500.
- **Docs/documents:** reuse `uploads.ts` / `blob-store.ts` / `malware-scan.ts`
  for submitted evidence and school documents.

## 3. Migration `0086_parent_guardian_portal`

Hand-written SQL; journal idx allocated from the actual current journal at
integration time (currently next is idx 87 = `0086`). Registered in
`migrations/meta/_journal.json`.

Columns added to `guardian_students` (all nullable/backfill-safe, defaults
preserve today's behavior):

| Column | Type | Semantics |
|---|---|---|
| `status` | `varchar(20)` default `'active'` | `active` / `suspended` / `revoked` |
| `effective_from` | `timestamp` | relationship start (null → from creation) |
| `effective_to` | `timestamp` | relationship end (null → open-ended) |
| `can_access_academic` | `boolean` default `true` | results/homework/schedule |
| `can_access_attendance` | `boolean` default `true` | attendance + excuses |
| `can_access_finance` | `boolean` default `true` | invoices/payments/statements |
| `can_access_medical` | `boolean` default `true` | medical/safeguarding documents |
| `can_access_communication` | `boolean` default `true` | announcements/messages/meetings |
| `is_financially_responsible` | `boolean` default `true` | scope of household finance view |
| `has_pickup_authority` | `boolean` default `false` | gated pickup/transport surfaces |
| `custody_restriction` | `varchar(50)` default `null` | e.g. `non-custodial`, `court-ordered` |
| `sensitive_contact_hidden` | `boolean` default `false` | hides private guardian contact/address |

Indexes: `(tenant_id, status)`, `(guardian_id, status, effective_from)`.

Backfill: existing rows keep `status='active'`, all access flags `true` → today's
behavior is preserved exactly until staff set rights. **No data migration risk.**

## 4. Phases and gates

### P1 — Guardian identity / relationship authorization
- Migration **0088** (renumbered from 0086; journal at current tail) applied
  live twice (idempotent) — 12 new `guardian_students` columns + 2 indexes +
  `parent_guardian_link_tokens` table.
- `src/features/parent/services/relationship-resolver.ts` +
  `src/features/parent/api/guard.ts` (deny-by-default gate).
- Guardian self-link flow: `POST /api/guardian/link/start` (staff emits a
  one-time, SHA-256-hashed token) + `POST /api/guardian/link/accept`
  (token → `guardians.userId` bind); single-use, expiring, cross-tenant refused.
- `GET /api/guardian/me` (household identity + effective children) and
  `GET /api/guardian/me/children/[relationshipId]` (redacted child summary +
  granted rights).
- Fixtures: `scripts/seed-parent-fixtures.ts` (PRN- set); live sweep
  `scripts/verify-parent-security.mjs`.
- Gate: migration applies idempotently; `npx tsc --noEmit` 0 for new code;
  relationship authz unit tests green (11/11) + live sweep green (23/23); the
  Foundation/transport/hostel/Finance shared code is untouched.

**STATUS (2026-08-08): DONE + live-verified.**

### P2 — Household home + child switcher
- `GET /api/guardian/me/children` (collection — effective children list) and
  `GET /api/guardian/me/home` (aggregate: active child defaults to primary or
  reauthorized `?child=` id; 6 widgets — alerts / attendanceToday / balances /
  upcoming / homework / messages — each degrades to `{degraded:true, reason}`
  on failure; widget keys are the stable contract later phases fill in).
- Replaced `dashboard/parent/page.tsx` (was rendering the STAFF
  `ParentsGuardiansView` with NO guard) with `ParentHomeView` +
  `requireServerPage({ allowedRoles:['parent'] })`; rewrote `ChildContextSwitcher`
  as a data-driven component consuming the server-derived children list
  (selection is UI-only; every request stays relationship-scoped).
- Gate: pages render 200 en+fr+ar; child switcher list == server-derived
  children; cross-child probe on `/me/home?child=` 404s; non-parent role 307 →
  `/fr`. Non-parent page access now guarded (was an open screen).

**STATUS (2026-08-08): DONE + live-verified.**

### P3 — Child overview / academics
- `GET /api/guardian/me/children/:relationshipId/overview` — identity +
  placement + rights + summary (publishedResults count, openHomework count;
  attendance/balance/nextEvent wired by later phases).
- `GET /api/guardian/me/children/:relationshipId/results` — published results
  only: `assessmentOutcomes.moderationState='published'` AND
  `status IN ('graded','exempted','absent')` (never draft; withheld excluded).
  Projection allowlists title/type/subject/score/max/grade/status — no raw
  internal fields (markerId, sourceReferenceId, revisions).
- `GET /api/guardian/me/children/:relationshipId/homework` — reuses
  `HomeworkService.getHomeworkForStudent` (published + audience-matched) after
  relationship authz. Both results/homework require the `academic` right (403
  when withheld).
- Fixtures: seed now creates published+draft results (published-only gate is
  proven live) and a published broadcast homework with a graded attempt.
- Gate: published-only proven live (draft excluded); cross-guardian 404 on all
  three; academic-right withheld → 403.

**STATUS (2026-08-08): DONE + live-verified.**

### P4 — Attendance + excuses
- `GET /api/guardian/me/children/:relationshipId/attendance` (coverage + today +
  excused/absent/late notices) — relationship-scoped.
- `POST /api/guardian/me/children/:relationshipId/excuses` (evidence via
  uploads) + `GET .../excuses` (status: pending/approved/rejected + correction
  state) — creates rows in `attendanceExcuses` with `reviewedBy` flow.
- Gate: excuse POST for non-linked child 404; revocation mid-session 403.

### P5 — Parent Finance
- `GET /api/guardian/me/children/:relationshipId/finance` — authoritative
  projection from `invoices`+`payments` (tenant + studentId scoped):
  statement (opening/closing balance, transactions), invoices, receipts,
  due balance; only children where `is_financially_responsible`.
- `GET /api/guardian/me/finance` — household roll-up, never another guardian's
  private details or unrelated siblings.
- Gate: cross-child finance 404; financially-non-responsible child excluded;
  amounts match the source tables exactly (live assert).

### P6 — Communication / meetings
- `GET /api/guardian/me/children/:relationshipId/announcements` —
  relationship+class-section scoped (fixes the class leak in the shared route by
  NOT reusing it; this route honors `targetClassSectionId` for the child's own
  class).
- `GET /api/guardian/me/children/:relationshipId/meetings` + reuse
  `POST /api/academics/meeting-slots/book` for booking (link-gated today).
- `GET /api/guardian/me/messages` — communication history under policy (read-only
  projection of communication records scoped to linked children).
- Gate: class-scoped announcement leak test (parent sees only own child's class);
  booking non-linked child 404.

### P7 — Requests / documents / consents
- `POST /api/guardian/me/children/:relationshipId/requests` (profile correction,
  leave/permission, document requests) + `GET .../requests`.
- `GET /api/guardian/me/children/:relationshipId/documents` — school documents;
  custody-gated sensitive fields.
- Consents: extend `portal_preferences` allowlist with parent consent keys
  (`contactConsent`, `mediaConsent`, `transportConsent`, `hostelConsent`,
  `eventConsent`) — PATCH is the only write path (allowlist + tenant/user scope).
- Gate: consent PATCH invalid key 400; documents custody-gated; requests audit
  trail recorded.

### P8 — Settings / preferences
- `GET/PATCH /api/guardian/me/preferences` (own projection over
  `portal_preferences`), language/channel, privacy consent, sessions
  (`/api/security/sessions` reuse for "sessions" view).
- Gate: preferences allowlist enforced; invalid key 400; tenant+user scoped.

### P9 — Integrations via narrow adapters
- Transport: reuse `GET /api/transport/self-service/guardian`; `GET
  /api/guardian/me/children/:relationshipId/transport` adapter (addon-gated,
  `has_pickup_authority` where applicable).
- Hostel: reuse `GET /api/addons/hostel/guardian/me`; add narrow
  `POST /api/addons/hostel/guardian/leave-passes/:id/approve` wiring the existing
  `approverRole:'guardian'` service logic.
- Events/meetings/live-class: reuse meeting book + join-service.
- Each adapter: `requireAddon` → disabled → PortalStateView addon-unavailable.
- Gate: addon-disable sweeps on every parent-visible addon surface; cross-child
  404; no crash when addon disabled.

### P10 — UI / accessibility
- FR + Arabic/RTL for all parent pages (dir switching, `locale` routing),
  mobile-first responsive, keyboard operable, WCAG 2.2 AA contrast/aria,
  `PortalStateView` loading/empty/error/forbidden/offline/addon states.
- Gate: browser pass (en+fr, RTL), keyboard-only pass, mobile viewport pass,
  degraded-network pass.

## 5. Verification suite

### 5.1 Mandatory automated security tests (28)
Script: `scripts/verify-parent-security.mjs` (live, two-tenant, DB-backed)
plus `src/features/parent/services/__tests__/relationship-resolver.test.ts`
(pure) and `src/app/api/guardian/guardian-security.test.ts` (vitest, mocked
session):

1. Anonymous → 401 on every `/api/guardian/**` route.
2. Authenticated non-parent (teacher/student/accountant/receptionist/guard/
   librarian) → 403.
3. Parent of tenant A calling tenant B child → 404.
4. Cross-child: arbitrary `studentId` not linked → 404 (never 403 distinction
   that would confirm existence).
5. Cross-guardian: another guardian's child → 404.
6. Sibling isolation: two children of same household, different guardians → no
   cross leakage.
7. Client-chosen child id ≠ server-derived relationship → 404.
8. Revocation without relogin: `status='revoked'` → next request in same session
   403.
9. Cached role context after revocation: `resolveActiveContext` falls back to
   base role → no parent data served (Foundation behavior verified end-to-end).
10. `effective_to` in the past → no access.
11. `effective_from` in the future → no access.
12. `status='suspended'` → no access.
13. No `can_access_academic` → results/homework 403/empty.
14. No `can_access_attendance` → attendance/excuses 403/empty.
15. No `can_access_finance` → finance 403/empty.
16. No `can_access_medical` → medical documents 403/empty.
17. No `can_access_communication` → messages/announcements 403/empty.
18. No `has_pickup_authority` → pickup/transport-gated surfaces denied.
19. `is_financially_responsible=false` → child excluded from household finance
    roll-up; sibling data hidden.
20. `custody_restriction` non-null → sensitive contact/address fields stripped
    from projections.
21. Parent-search enumeration resistance: search for a non-linked child returns
    empty (no existence oracle); query <2 chars → empty.
22. Excuse POST for non-linked child → 404.
23. Meeting booking for non-linked child → 404.
24. Announcement class-scope leak: parent sees only their child's class
    announcements; other classes hidden.
25. Addon disabled (transport/hostel/events) → 403 `ADDON_NOT_ACTIVATED`, parent
    page renders addon-unavailable, never 500.
26. Preferences: invalid key → 400; consent keys tenant+user scoped.
27. One-time link token: reuse of a consumed/expired token → 403; token hash
    never returned; no password exposure in any response.
28. Branch scope: active `x-branch-id` mismatched to child's branch → 403.

### 5.2 Mandatory functional tests
- Child switcher reflects server-derived children; switching re-issues scoped
  requests; URL child id cannot override server relationship.
- Results reflect source publication state (draft hidden / published shown /
  withdrawn hidden).
- Excuse submit → pending → staff approve → status flips; evidence upload works.
- Finance statements/balances == source `invoices`+`payments` (live assert).
- Household finance roll-up excludes non-financially-responsible children.
- Addon degradation renders graceful states per addon.
- FR + Arabic/RTL rendering; keyboard/mobile passes.

### 5.3 Mandatory release verification steps (20)
1. Migration preflight: `0086` SQL parses; table before/after.
2. Migration applies live (Atlas + Lango tenants); idempotent re-run no-op.
3. Relationship authz unit tests (`relationship-resolver.test.ts`) green.
4. Foundation baseline: `node scripts/verify-portal-foundation.mjs` (40/40).
5. `npx vitest run` for portal + guardian test files green.
6. Authenticated HTTP adversarial sweep (`verify-parent-security.mjs`) green.
7. Two-tenant isolation: Lango untouched by Atlas verify data (DB count 0).
8. Cross-child / cross-guardian / sibling isolation live asserts green.
9. Revocation-without-relogin live assert green.
10. Addon-disable sweep green (transport/hostel/events).
11. `npx tsc --noEmit --pretty false` — 0 errors in parent code; repo-wide only
    pre-existing out-of-scope errors, documented.
12. `npx next build` — parent code compiles; final TS gate only pre-existing
    out-of-scope errors.
13. `npx tsx scripts/check-tenant-isolation.ts` — 0 new flags on `/api/guardian/**`.
14. Browser pass en+fr + Arabic/RTL.
15. Mobile viewport pass.
16. Keyboard-only pass.
17. Degraded-network pass (offline/error states).
18. DB cleanup scan (0 leftover verify fixtures).
19. Docs complete: PLAN, IMPLEMENTATION-REPORT, AUDIT-RESPONSE, MANUAL-TESTING,
    DOWNSTREAM-INTEGRATION-NOTES.
20. Add-ons/pages/roles re-checked after cleanup; final `git status --short`
    diff attributable to this feature only.

## 6. Shared-file collision list (coordinate, preserve concurrent changes)

| File | Change | Risk |
|---|---|---|
| `src/models/Schema.ts` | +guardian_students lifecycle/rights columns | high |
| `migrations/meta/_journal.json` | append idx 87 (`0086_parent_guardian_portal`) | high |
| `migrations/0086_parent_guardian_portal.sql` | new file | high |
| `src/libs/api/permissions.ts` | +parent self-service permission keys (e.g. `guardian.selfservice.*`) if a distinct key is needed | high |
| `src/libs/api/portal-manifest.ts` | +parent "Espace Parent" nav group (permission-gated) | medium |
| `src/components/shared/sidebar.tsx` | render parent nav from manifest (if not already manifest-driven) | medium |
| `src/app/[locale]/(dashboard)/dashboard/layout.tsx` | parent layout hooks (child switcher context) if needed | medium |
| `src/features/portal/services/portal-home.ts` | extend `parentHome` to use effective resolver (coordinate) | medium |
| `src/features/portal/services/portal-search.ts` | parent branch already link-scoped; no change unless required | low |

Non-shared new code (mine): all `src/features/parent/**`, `/api/guardian/**`,
`/dashboard/parent/**` (new pages + replaced home), `parent-schema.ts` columns,
`scripts/verify-parent-security.mjs`, `scripts/verify-parent-addon-gate.mjs`,
docs. No `package.json` dependency changes (crypto via `node:crypto`; QR/PDF
reuse existing libs).

## 7. Honest completion criteria

Relationship authorization is server-enforced on every child endpoint;
cross-child/sibling/guardian isolation tests pass; revocation is immediate
without relogin; publication-state behavior is exact; Parent Finance uses
authoritative projections; optional addon degradation passes; authenticated HTTP
tests pass; migration tests pass; TypeScript and production build pass;
browser/mobile/keyboard/RTL acceptance complete. Remaining manual/external
requirements are explicitly disclosed in `IMPLEMENTATION-REPORT.md`.
