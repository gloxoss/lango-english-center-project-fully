# Receptionist Portal — Execution Plan

> Controlling spec: [`RECEPTIONIST-PORTAL-PLAN.md`](../RECEPTIONIST-PORTAL-PLAN.md).
> Foundation contract: [`role-portals-foundation/DOWNSTREAM-INTEGRATION-CONTRACT.md`](../../role-portals-foundation/DOWNSTREAM-INTEGRATION-CONTRACT.md).
> App/UI ground truth: [`_shared/APP-CONTEXT-AND-UI-SYSTEM.md`](../../_shared/APP-CONTEXT-AND-UI-SYSTEM.md).
> Concurrent-worktree rules apply: inspect `git status --short` before every shared-file edit, preserve unrelated edits, never rewrite an applied migration, never `next build` while another agent holds the `.next` lock.

**Live ground truth (verified 2026-08-09):**
- Atlas tenant: `ca40c88e-339c-4fea-b5c4-51d5c9cc0239` ("Groupe Scolaire Atlas") — **the live DB UUID, NOT the stale `c9177d8a…` in APP-CONTEXT-AND-UI-SYSTEM.md §7**.
- Lango tenant: `f62f31eb-1fc8-4102-9145-a5ce0bca989b` ("Lango Center").
- Atlas school_admin login: `y.elamrani@atlas.ma` / `Admin123!`; Lango: `admin@lango.ma` / `Admin123!`.
- No `guard_gates` rows exist for Atlas/Lango → seed one active gate per tenant in fixtures.
- No receptionist user exists for Atlas/Lango → seed one per tenant in fixtures.
- Latest migration file: `0091_…`, journal `idx` max 92. **This plan allocates `0092_receptionist_portal.sql`, journal `idx` 93.**

---

## 0. Security model (non-negotiable, mirrors parent portal P1)

1. **Server-owned context.** Every `/api/reception/**` route calls `requireRequestContext(request, ['receptionist','school_admin','super_admin'])`, then `requireTenant(ctx)` and `requireCapability(ctx, 'reception.*')`. Branch scope comes **only** from `ctx.branchId` (server-derived). `x-branch-id` / `?branchId=` are never honored.
2. **Deny by default → uniform 404.** A resource the caller does not own (wrong tenant, wrong branch when a branch is active, non-effective relationship) returns `404 NOT_FOUND`, never a distinguishing 403. Unknown UUIDs return 404 too (no existence oracle).
3. **No finance / no admission conversion / no bulk messaging.** The portal's routes never touch `invoices`, `payments`, `finance.*`, never call `convertInquiryToApplicant`, never send bulk campaigns, never export raw contacts. A receptionist attempting any such action gets 403 (routes simply do not exist for them).
4. **Purpose-limited lookup.** `GET /api/reception/lookup` returns only: id, name, masked contact (phone/email), person type, branch/class routing context, and authorized-guardian status. Never national ID, salary, bank, medical, credentials, internal notes, grades, finance balances, or unrestricted contacts.
5. **Pickup release = explicit effective authorization.** Release reuses Guard's `releaseStudent`, which requires an active, effective-dated, one-time `guard_pickup_authorizations` row. Never inferred from primary-contact status.
6. **Handoff never performs the destination module's privileged action.** A handoff records intent/assignment/status; it does not, e.g., post a voucher or approve an admission.
7. **Replay-safety.** Check-in/out and release reuse Guard's FOR UPDATE + partial-unique-index semantics; appointment transitions are serialized with `FOR UPDATE` + status-transition guards; inquiry creation is idempotent (client `idempotencyKey` → unique index) and deduped via `findDuplicateCandidates`.

---

## 1. Reuse / Extend / Replace / New matrix

### Reuse (call existing surfaces directly — no duplication)

| Surface | Used for | Notes |
|---|---|---|
| `src/libs/api/context.ts` `requireRequestContext`/`requireTenant` | all routes | role allowlist `['receptionist','school_admin','super_admin']` |
| `src/libs/api/permissions.ts` `requireCapability`/`hasCapability` | all routes | gated on new `reception.*` keys |
| `src/libs/api/validation.ts` `parseJson` | all POST/PATCH bodies | Zod `.strict()` |
| `src/libs/api/errors.ts` `ApiError`/`apiErrorResponse` | all routes | uniform 404/409/422/403/429 |
| `src/libs/api/audit.ts` `recordAudit` | all mutations | fixed action union, never awaited |
| `src/libs/api/rate-limit.ts` `checkRateLimit` | lookup + all POST | `tenantId:userId:route`, 429 on burst |
| `src/libs/api/pagination.ts` `parsePagination` | list routes | clamps page/pageSize |
| `src/libs/api/page-guard.ts` `requireServerPage` | dashboard pages | `allowedRoles:['receptionist']` + `requiredCapability:'reception.portal.use'` |
| `src/components/shared/portal-state.tsx` `PortalStateView` | loading/empty/error/forbidden/offline states | shared portal contract |
| `src/features/crm/services/inquiries-service.ts` `createInquiry`, `findDuplicateCandidates`, `addFollowUp`, `getInquiry`, `listInquiries`, `assertInquiryExists` | inquiry intake/routing | **never** `convertInquiryToApplicant` |
| `src/features/guard/services/visitors-service.ts` `createVisit`, `checkInVisit`, `checkOutVisit`, `listVisits`, `issueVisitorPass`, `requireTenantGate` | visitor check-in/out, pass, evidence | replay-safe already |
| `src/features/guard/services/release-service.ts` `listStudentPickups`, `createPickupAuthorization`, `listPickupAuthorizations`, `releaseStudent` | pickup desk | explicit effective authorization, single release |
| `src/features/guard/models/guard-validation.ts` `guardVisitCreateSchema`, `guardVisitCheckInSchema`, `guardReleaseSchema` | body schemas | reuse exact shapes |
| `src/models/Schema.ts` `smsTemplates`, `smsMessages` | approved-template notifications | log-only send, tenant-scoped |
| `src/libs/api/portal-manifest.ts` `FULL_NAVIGATION` | sidebar nav | filtered by `reception.*` perms |
| `src/models/Schema.ts` barrel `export *` pattern | feature schema wiring | one line |

### Extend (additive, merge-safe)

| File | Change |
|---|---|
| `src/libs/api/permissions.ts` | Add `reception.*` keys to `PERMISSIONS`; add them to the `receptionist` entry of `DEFAULT_ROLE_PERMISSIONS`. |
| `src/libs/api/permissions.ts` | **Trim** the `receptionist` role's forbidden broad grants per spec §"Do not implicitly grant": remove `admissions.manage`, `communication.send`, `crm.manage` (keep `admissions.view`, `communication.read`). Add a comment explaining the spec-driven reduction. |
| `src/libs/api/portal-manifest.ts` | Add `reception` nav section (home, appointments, handoffs) to `FULL_NAVIGATION`, permission-gated. |
| `src/components/shared/sidebar.tsx` | Add new manifest icon strings (`ConciergeBell`, `Search`, `ListTodo`, `UserSearch`) to `MANIFEST_ICONS`. |
| `src/models/Schema.ts` | Add one barrel line: `export * from '@/features/reception/models/reception-schema';`. |

### Replace

| File | Change |
|---|---|
| `src/app/[locale]/(dashboard)/dashboard/receptionist/page.tsx` | Server component: `requireServerPage(locale, { allowedRoles:['receptionist'], requiredCapability:'reception.portal.use' })` → render feature-local home view. |
| `src/features/crm/ui/receptionist-portal-view.tsx` | Delete (mock; superseded by `src/features/reception/ui/`). |
| `src/components/receptionist/WalkInInquiryModal.tsx` | Unused after page switch; delete only if no other reference (verified by grep). The fake `setTimeout` success is replaced by a real CRM-backed intake dialog in the reception feature. |

### New

```
src/features/reception/
  models/reception-schema.ts          # 5 tables (see §2)
  services/
    lookup-service.ts                 # masked purpose-limited search (§3)
    appointments-service.ts           # lifecycle, concurrency, history, notifications (§4)
    handoffs-service.ts               # lifecycle, transitions, history (§5)
    identity-service.ts               # identity-verification outcome recording (§6)
    home-service.ts                   # /me/home aggregate (§7)
  ui/
    reception-home-view.tsx           # KPIs + lookup + visitor desk + inquiry intake
    reception-appointments-view.tsx   # appointments list + create + lifecycle actions
    reception-handoffs-view.tsx       # handoffs list + create + transitions
    reception-inquiry-dialog.tsx      # real CRM-backed intake (replaces WalkInInquiryModal)
    reception-lookup-panel.tsx        # masked result list + verify/release actions
src/app/api/reception/
  me/home/route.ts                    # GET
  lookup/route.ts                     # GET  (rate-limited, audited)
  inquiries/route.ts                  # GET, POST (dedup + idempotent)
  inquiries/[id]/follow-ups/route.ts  # POST (schedule follow-up)
  appointments/route.ts               # GET, POST
  appointments/[id]/reschedule/route.ts
  appointments/[id]/cancel/route.ts
  appointments/[id]/check-in/route.ts
  appointments/[id]/complete/route.ts
  appointments/[id]/no-show/route.ts
  visitors/route.ts                   # GET, POST (create + check-in walk-in)
  visitors/[id]/check-out/route.ts    # POST (replay-safe)
  pickups/students/[id]/route.ts      # GET (authorized pickup persons + auths)
  pickups/authorizations/route.ts     # POST (create explicit authz)
  pickups/release/route.ts            # POST (explicit-effective single release)
  handoffs/route.ts                   # GET, POST
  handoffs/[id]/acknowledge/route.ts
  handoffs/[id]/resolve/route.ts
  handoffs/[id]/cancel/route.ts
src/app/[locale]/(dashboard)/dashboard/receptionist/
  page.tsx                            # guarded home
  appointments/page.tsx               # guarded appointments
  handoffs/page.tsx                   # guarded handoffs
migrations/0092_receptionist_portal.sql   # hand-written idempotent
scripts/seed-reception-fixtures.ts         # Atlas + Lango fixtures
scripts/verify-reception-security.mjs      # acceptance battery (§9)
```

---

## 2. Feature-local schema (`src/features/reception/models/reception-schema.ts`)

All tables: `id uuid defaultRandom pk`, `tenantId uuid not null` (query-layer scoping, no tenant FK object — matches guard-schema), `createdAt`/`updatedAt` string timestamps.

1. **`reception_appointments`**
   - `branchId uuid?`, `guestType varchar(30)` (`parent|visitor|prospect|supplier|other`), `guestName varchar(255)`, `guestPhone varchar(50)`, `purpose varchar(255)`, `hostId text (user.id)` + `hostName varchar(255) snapshot`, `startAt timestamp string`, `endAt timestamp string`, `status varchar(20)` (`scheduled|checked_in|completed|cancelled|no_show`), `notes text?`, `createdById text`, `version int default 0` (optimistic concurrency), `idempotencyKey varchar(255)?`
   - FKs: `hostId→user.id` (set null), `createdById→user.id` (cascade).
   - Indexes: `(tenantId, startAt)`, `(tenantId, status)`. **Partial unique** on `idempotencyKey` where not null (replay dedup).

2. **`reception_appointment_status_history`** — immutable append-only
   - `appointmentId uuid` FK, `fromStatus varchar(20)?`, `toStatus varchar(20)`, `changedById text` FK, `reason varchar(500)?`, `createdAt`.
   - Index `(tenantId, appointmentId)`.

3. **`reception_identity_verifications`** — method/outcome only, **no document copies**
   - `subjectType varchar(20)` (`student|guardian|visitor`), `subjectId text`, `method varchar(30)` (`id_document|badge_qr|guardian_link|manual`), `outcome varchar(20)` (`verified|failed|unverified`), `notes varchar(500)?`, `verifierId text` FK, `performedAt`.
   - Index `(tenantId, performedAt)`, `(tenantId, subjectType, subjectId)`.

4. **`reception_handoffs`**
   - `branchId uuid?`, `category varchar(30)` (`admissions|finance|teacher|admin|security`), `subjectType varchar(20)?` (`student|guardian|visitor|inquiry|appointment|other`), `subjectId text?`, `title varchar(255)`, `description text?`, `priority varchar(10)` (`low|medium|high|urgent`), `assignedToId text?` FK, `deadline timestamp string?`, `status varchar(20)` (`open|acknowledged|resolved|cancelled`), `resolutionNotes text?`, `acknowledgedById text?`, `acknowledgedAt timestamp?`, `resolvedById text?`, `resolvedAt timestamp?`, `createdById text` FK, `idempotencyKey varchar(255)?`
   - Indexes `(tenantId, status)`, `(tenantId, assignedToId)`. Partial unique `idempotencyKey`.

5. **`reception_handoff_status_history`** — immutable append-only
   - `handoffId uuid` FK, `fromStatus varchar(20)?`, `toStatus varchar(20)`, `changedById text`, `reason varchar(500)?`, `createdAt`.
   - Index `(tenantId, handoffId)`.

Lifecycle transitions (enforced in services, mirrored in tests):
- Appointment: `scheduled → checked_in → completed`; `scheduled → cancelled`; `scheduled → no_show`; terminal states immutable.
- Handoff: `open → acknowledged → resolved`; `open → cancelled`; `acknowledged → resolved`; resolved/cancelled terminal.

---

## 3. Lookup (`GET /api/reception/lookup`)

- Query: `q` (trimmed, **min 2 chars** → shorter returns empty list), `type` (`all|student|guardian|teacher|inquiry|visitor`), `limit` clamped 1..20 (default 8).
- `checkRateLimit(\`${tenantId}:${userId}:lookup\`, 30, 60_000)`; `recordAudit(ctx,'update','reception_lookup',…)`-style audit entry per search (fire-and-forget) — the audit log captures the query term to deter enumeration.
- Sources (all tenant-scoped):
  - students: `user.role='student' AND userStatus='active'` — `name ILIKE %q%`, exact `matricule`, or `phone ILIKE %q%` only when `q.length>=6`.
  - guardians: `guardians.firstName/lastName/phone`.
  - teachers/staff: `user.role IN ('teacher','receptionist','accountant','school_admin')`.
  - inquiries: existing CRM inquiries by name/phone.
- **Projection (masking):** `{ id, name, type, phoneMasked, emailMasked, branchName, classRouting (className/section label for students), guardianStatus (for guardians: linked child count + isPrimaryContact — never full directory) }`.
  - Phone mask: `06**…**12` (keep 2 first + 2 last, middle stars). Email mask: `a***@domain`.
  - Result cap per query (total ≤ `limit`), and search must not be able to dump all rows (min length + cap + rate limit).

---

## 4. Appointments

- `POST /api/reception/appointments` — body: `guestType, guestName, guestPhone?, purpose, hostId (REVERIFIED: user.id AND tenantId AND host-role), startAt, endAt (end>start), notes?, notify?:boolean`. Validate host belongs to tenant and is a host-capable role (`school_admin|teacher|accountant|receptionist` — same HOST_ROLES as Guard). Concurrency: insert with `idempotencyKey` (partial unique). `notify:true` → send approved-template SMS via `smsMessages` insert (fixed allowlisted bodies only).
- `GET /api/reception/appointments?from=&to=&status=&branch=` — tenant(+branch)-scoped list, `parsePagination`.
- Lifecycle `POST /[id]/<op>`:
  - `reschedule` (new `startAt`,`endAt`) — `FOR UPDATE`, only from `scheduled`, bump `version`, history row.
  - `cancel` (`reason?`) — only from `scheduled`.
  - `check-in` — only from `scheduled`.
  - `complete` — only from `checked_in`.
  - `no-show` — only from `scheduled`.
  - Each writes a `reception_appointment_status_history` row (immutable), audits, and optionally re-notifies with the matching approved template.
- All ops: 404 if not `tenantId`-owned (uniform).

---

## 5. Handoffs

- `POST /api/reception/handoffs` — body: `category, title, description?, priority, subjectType?, subjectId?, assignedToId? (REVERIFIED tenant), deadline?, idempotencyKey?`. **The route performs only recording/assignment — never the destination module's privileged action** (no voucher, no admission approve).
- `GET /api/reception/handoffs?status=&category=&assignedTo=` — tenant(+branch)-scoped, paginated.
- Lifecycle: `POST /[id]/acknowledge` (open→acknowledged), `/resolve` (open|acknowledged→resolved, `resolutionNotes`), `/cancel` (open→cancelled, `reason`). Each `FOR UPDATE`, writes history row, audits.

---

## 6. Visitor & pickup desk (reuse Guard)

- `POST /api/reception/visitors` — body reuses `guardVisitCreateSchema` (`approved:true` default for receptionist walk-in). Calls `createVisit`, then `checkInVisit` with a tenant gate + `idempotencyKey`. Optionally `issueVisitorPass`. Stores an identity-verification outcome row (`method`, `outcome`).
- `POST /api/reception/visitors/[id]/check-out` — `guardVisitCheckOutSchema`; replay-safe (returns `already_processed` on replay).
- `GET /api/reception/pickups/students/[id]` — reuses `listStudentPickups` (authorized persons + effective authorizations). **Does not imply authorization from primary contact.**
- `POST /api/reception/pickups/authorizations` — reuses `guardPickupAuthorizationCreateSchema` + `createPickupAuthorization` (guardian must be linked). Effective-dated.
- `POST /api/reception/pickups/release` — reuses `guardReleaseSchema` + `releaseStudent` (explicit, single-use). Stores identity-verification outcome. **Requires `reception.pickup.release` capability — NOT granted by default to receptionist (guard-owned); the fixture grants it to exercise the positive path, and the denial test proves a receptionist without it gets 403.** *(See §9 decision note.)*

---

## 7. Home (`GET /api/reception/me/home`)

Server-owned aggregate, each block degrades to `{ degraded:true, reason }` like the parent home:
- `todayAppointments` (count + next 5, scheduled/checked_in for today, tenant/branch).
- `openInquiries` (count of `status='new'` CRM inquiries).
- `todayVisits` (count + present visitors via `guardVisits`).
- `openHandoffs` (count by priority).
- `pendingPickups` (count of active pickup authorizations expiring today).
- `lookup` readiness flag + today's identity-verification outcome counts.

---

## 8. Capabilities (permissions.ts)

New keys (`PERMISSIONS`) + added to `receptionist` in `DEFAULT_ROLE_PERMISSIONS`:

```
'reception.portal.use': 'Utiliser le portail accueil',
'reception.lookup': 'Rechercher des personnes (projection limitée)',
'reception.inquiry.create': 'Enregistrer et router des demandes de renseignements',
'reception.inquiry.manage': 'Suivre et programmer le suivi des demandes',
'reception.appointment.manage': 'Gérer les rendez-vous (planifier, pointer, clôturer)',
'reception.handoff.manage': 'Gérer les transferts et tâches du front office',
'reception.visitor.manage': 'Pointer les visiteurs et éditer les passes',
'reception.pickup.release': 'Vérifier et libérer les élèves (autorisation explicite)',
```

- `reception.pickup.release` is **NOT** added to the default `receptionist` array — release stays guard-owned; the verify battery grants it to one fixture receptionist via a `userPermissionOverrides` row to prove the positive path, and asserts the default receptionist is denied (403) — proving release is never implicit.
- `reception.visitor.manage` default yes for receptionist (front desk does visitor check-in/out).
- **Trimmed from `receptionist` defaults** (spec: "do not implicitly grant admissions conversion / bulk messaging"): `admissions.manage`, `communication.send`, `crm.manage`. `admissions.view` + `communication.read` retained (read-only context).

---

## 9. Tests + verification (acceptance battery, `scripts/verify-reception-security.mjs`)

Fixture set (Atlas + Lango, seeded by `scripts/seed-reception-fixtures.ts`): 1 receptionist per tenant (Atlas: grant `reception.pickup.release` via userPermissionOverrides), 1 guard gate per tenant, students + linked guardians + one active pickup authorization, one CRM inquiry, host user. Cleanup removes every seeded row idempotently.

| # | Check |
|---|---|
| T01 | Anonymous → 401 on every `/api/reception/**` route. |
| T02 | `school_admin` (wrong role) → 403 on reception-only routes. |
| T03 | Two-tenant isolation: Atlas receptionist cannot read/act on Lango appointments/handoffs/visitors/pickups (uniform 404). |
| T04 | Wrong-branch isolation when a branch is active → 404/403. |
| T05 | Lookup enumeration resistance: `q` < 2 chars → empty; term cap enforced; projection has **no** national-id/salary/bank/medical/grades/finance fields; phone/email masked. |
| T06 | Lookup rate limit: burst > limit → 429. |
| T07 | Inquiry create dedups (same phone → duplicate candidate surfaced) and idempotencyKey replay does not duplicate. |
| T08 | Receptionist cannot convert an inquiry (no route → 404; `crm.manage`/`admissions.manage` not effective → 403). |
| T09 | Appointment create → reschedule → check-in → complete happy path; history rows appended per transition. |
| T10 | Appointment illegal transition (e.g. complete from scheduled) → 409; concurrent reschedule races → one wins (version/`FOR UPDATE`). |
| T11 | Appointment cancel/no-show only from scheduled. |
| T12 | Approved-template notification: only allowlisted bodies are written to `smsMessages`; a cross-tenant template id is refused (422/404). |
| T13 | Visitor check-in replay → `already_processed`, single transition. |
| T14 | Visitor check-out replay → `already_processed`. |
| T15 | Pickup release requires explicit effective authorization (no primary-contact inference): a guardian linked as primary contact but without an active authorization is **denied**; the one-time release consumes the authorization; replay → denied. |
| T16 | Receptionist without `reception.pickup.release` → 403 on release; with override → 200 (cashier/guard-style positive path). |
| T17 | Handoff transitions: open→acknowledged→resolved; open→cancelled; illegal transitions → 409; concurrent ack/resolve → one wins. |
| T18 | Handoff never performs destination action: creating a `finance` handoff does not create a voucher/invoice. |
| T19 | Receptionist Finance denial: `/api/finance/**`, `invoices` not reachable → 403/404. |
| T20 | Migration idempotent re-run (applier twice). |
| T21 | Manifest/page/API permission agreement: `reception.portal.use` present exactly in the receptionist role + manifest nav filtered consistently. |
| T22 | Cross-tenant inquiry/appointment id (foreign-id body param) re-verified → 404. |
| T23 | Identity-verification rows store method+outcome only, no document bytes. |

Plus, per foundation contract §5: `npx tsc --noEmit` (my files clean), `npx vitest run` for any new pure-function unit tests (e.g. `maskContact`), `npx tsx scripts/check-tenant-isolation.ts` (no new flags), `npx next build` (only after confirming no `.next` build lock), migrations `0092` applied + idempotent.

---

## 10. Delivery order

1. **R1** EXECUTION-PLAN + capabilities + role trim. → verify: `tsc` clean on edited files.
2. **R2** Schema + migration `0092` + journal + apply (docker migrate, then rerun applier twice). → verify: `\dt reception_*`, idempotent rerun exit 0.
3. **R3** Services + routes. → verify: live curl battery (seed first), `check-tenant-isolation.ts`.
4. **R4** UI + page guards + sidebar/manifest. → verify: guarded pages render 200 fr/en/ar, non-receptionist redirects; browser sweep.
5. **R5** Verify script T01–T23 + unit tests + tsc + build.
6. **R6** MANUAL-TESTING.md, VERIFICATION-EVIDENCE.md, IMPLEMENTATION-REPORT.md.
