# Guard & Security Portal — Verified Execution Plan

> Status: **PLANNED — no code changed yet, as of authoring.** Since implemented; the actual
> migration filed as `0078_guard_security_portal.sql`, not the `0076` reserved below (the
> number shifted before execution). See `GUARD-SECURITY-PORTAL-PLAN.md` top-of-file status and
> `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (#29) for current, verified status.
> This document is kept as the historical execution plan. This document was written after reading the four
> planning files in order (`_shared/APP-CONTEXT-AND-UI-SYSTEM.md`, `_coordination/NEXT-WAVE-AGENT-PLAN.md`,
> `GUARD-SECURITY-PORTAL-PLAN.md`, `.implementation-plan/PLAN.md`), the Advanced HR employee-identity
> contract (`.implementation-plan/EXECUTION-PLAN.md` — **already shipped, phases 1–5 live**), and the
> Hostel contract (`hostel-management/HOSTEL-MANAGEMENT-ADDON.md` + `.implementation-plan/PLAN.md` —
> **planned only, no phase-2 APIs exist yet**). Every assumption in `PLAN.md` was validated against the
> live repository below. Implementation begins only after this plan is internally consistent and after
> owner confirmation of the decisions in §15.
>
> Verification date: **2026-08-08**. Highest migration observed: **`0075_hr_profile_national_id_salary`**
> (`migrations/meta/_journal.json` last `idx = 76`). The next migration to reserve is **`0076`** with
> journal `idx = 77`. Re-confirm this number immediately before writing the migration, per the
> NEXT-WAVE-AGENT-PLAN requirement.

---

## 1. Verified current-state security and scanner inventory

Everything below was read from the repository (dirty worktree: **432 changed/untracked files**, pre-existing
— see §11 R1) or derived from the live schema.

### 1.1 Signed HMAC badge / QR credential infrastructure (REUSE — do not fork)

| Concern | Verified truth | Reuse decision |
|---|---|---|
| Credential table | `identity_badge_credentials` (`src/features/attendance/models/attendance-qr-schema.ts:30`): `id uuid`, `tenant_id`, `user_id` (text FK→user.id), `subject_type` enum `student\|staff\|visitor`, `token_hash`, `display_prefix`, `status` enum `active\|revoked\|expired\|replaced`, `issued_at`, `expires_at`, `revoked_at`, `issuer_id`, `replacement_id`. Re-exported via `@/models/Schema` barrel. | **Single credential store. No second badge format.** |
| Signing | `computeHmacHash(rawToken) = crypto.createHmac('sha256', BETTER_AUTH_SECRET || 'schoolos-qr-secret-key-sentinel').update(rawToken).digest('hex')` — duplicated verbatim in `api/identity-badges/route.ts`, `[id]/replace`, `bulk-issue`, `attendance/qr/verify-and-stage`. | Extract **one shared copy** `src/libs/api/badge-crypto.ts` and reuse it in the guard adapter (§6). Only a hash is stored; raw token returned exactly once at issue. |
| Raw token format | `LANGQR-{SUBJ3}-{32 hex}`; `display_prefix` = first 12 chars. | Same format for visitor passes. |
| Verify contract | Attendance verify resolves **only** by `(tenantId, tokenHash)`, then checks `status === 'active'`, then tenant-scoped `user`. Unknown hash and non-active status both record a `rejection_reason` evidence row. | Guard adapter reuses hash lookup + status check. **Stricter leak policy**: guard endpoint returns a single generic `VERIFICATION_FAILED` and never reveals whether a person exists (§7). |
| Issue / revoke / replace | `POST /api/identity-badges` revokes prior active badge for the user then issues a fresh one; `[id]/replace` links `replacementId`; `bulk-issue` is the idempotent one-active-per-user contract. | Visitor pass issuance reuses `POST /api/identity-badges` (subjectType `visitor`) — no new issuance code. |
| Scan evidence pattern | `attendance_scan_events`: `result_status`, `rejection_reason`, `idempotency_key`, `already_scanned` result, accepted-dedupe query. | Mirror for `guardGateScanEvents` (§3). |

### 1.2 Scanner devices and sessions

- `scanner_devices` (`attendance-qr-schema.ts:58`): `tenant_id`, `device_label`, `branch_id`, `paired_at`,
  `last_seen_at`, `is_disabled`, `secret_key`. Pair route `POST /api/scanner-devices/pair` (school_admin +
  `settings.attendance.manage`), `[id]` PATCH/DELETE. **Attendance-owned but read/written by admins.**
- `scanner_sessions` (`attendance-qr-schema.ts:75`): `tenant_id`, `device_id`, `operator_id` (FK user.id),
  `class_section_id`, `started_at`, `ended_at`, `status`. **Attendance-specific (class-section scoped).**
  Not reused for guard kiosks — guard kiosk sessions bind to *gate*, not class-section (§3).
- The attendance kiosk UI (`src/features/attendance/ui/attendance-scanner-kiosk.tsx`,
  `/dashboard/attendance/scanner`) is the mobile-first pattern to mirror for the guard scanner.

### 1.3 Guard role and permissions (current, verified)

- `role` enum includes `guard` (`Schema.ts:27`; `APP_ROLES` in `context.ts:7`). No guard addon exists in
  `src/addons/registry.ts` — **the guard portal is a core role feature, not an addon.**
- `DEFAULT_ROLE_PERMISSIONS.guard` = `['students.read', 'attendance.read', 'events.read', 'events.checkin']`
  (`permissions.ts:189`). `permissions.test.ts:47` asserts `guardPerms.length <= 5` and contains
  `students.read`/`attendance.read`.
- **Key finding**: `students.read`/`attendance.read` are inert for guard — every students API route uses a
  role allowlist that excludes `guard` (`/api/students` allows `school_admin, teacher, accountant` at
  `students/route.ts:161`, plus `receptionist`/`school_admin` elsewhere). A guard cannot enumerate students
  through existing routes. The capabilities remain but are misleading; §5 replaces them with real
  `guard.*` keys so the sidebar cannot offer dead directory links.
- `requireRequestContext(request, allowedRoles?)` (`context.ts:23`) rejects inactive users and returns
  `context.branchId` resolved from `x-branch-id` header, `?branchId`, or the user's own branch — the
  branch-binding backbone for kiosk sessions.

### 1.4 Student / guardian pickup relationships (REUSE from the student domain)

- `guardian_students` (`Schema.ts:1711`): `guardian_id`, `student_id` (user.id), `relationship_type`,
  `is_primary_contact`, `is_emergency_contact`, **`can_pickup` (already exists)**.
- `guardians` (`Schema.ts:1743`): `first_name`, `last_name`, `email`, `phone`, `user_id`.
- The **authorized-pickup list** for a student = `guardianStudents` rows where `can_pickup = true`, joined
  to `guardians`. Guard reads this list through a narrow, projection-only route (§4, §7). The **one-time /
  time-window pickup authorization** (parent authorizing an uncle for today 16:00–18:00) does not exist yet
  and is added as `guardPickupAuthorizations` (§3).

### 1.5 HR employee identity contract (READ-ONLY dependency, already shipped)

- `employee_profiles` (`Schema.ts:3568`, evolved by migrations 0073–0075): nullable `user_id`,
  tenant-scoped `employee_id`, `branch_id`, `department_id`, `designation_id`, `manager_employee_id`,
  `employment_type`, `employment_status`, dates, workload, archive fields. Addon `human-resources`,
  capabilities `hr.employee.read/manage`, `hr.sensitive.read`, etc.
- **Guard only needs a display identity for staff**: name + photo + (staff label). The credential adapter
  resolves staff via the tenant-scoped `user` row; it does **not** read `employee_profiles` at all, so it
  cannot accidentally expose HR fields. The plan keeps HR as a dependency boundary only (staff subjectType
  already exists on the badge).

### 1.6 Audit, attachments, tenant isolation, session security (current behavior)

- `recordAudit(context, action, entityType, entityId, metadata)` (`src/libs/api/audit.ts`) — fixed action
  union `create|update|delete|login|logout|export|import|settings_change|permission_change|entitlement_change`.
  Guard routes record `create`/`update`/`login`/`logout` events; immutable guard evidence lives in the new
  append-only event tables (§3), not only audit.
- Attachments: `src/libs/api/uploads.ts` (`saveUploadedFile` — tenant-namespaced, magic-byte validation),
  `src/libs/api/blob-store.ts` (immutable content-addressed keys), `src/libs/api/malware-scan.ts`
  (`scanBuffer` via a real ClamAV service). Incident evidence reuses `saveUploadedFile` + optional `scanBuffer`.
- Tenant isolation: `requireTenant` + the shared-context rule that **every foreign id in a request body is
  re-verified `WHERE id=? AND tenantId=?`**; `scripts/check-tenant-isolation.ts` (baseline 3 known files).
- Session/device security: better-auth signed session cookie; `requireRequestContext` rejects non-active
  users; `BETTER_AUTH_SECRET` is set in `.env`. **No existing kiosk auto-lock / expiry mechanism** — it is
  new work in §8. No identity manifests are stored in browser storage today and the guard UI will not add
  any (§8).
- `ROLE_LANDING_PAGE` (`dashboard/page.tsx:9`) currently redirects only `accountant → finance`; the guard
  landing redirect is added (§4).

### 1.7 Shared infra confirmed present

- `namingSeries` + `reserveMatricule` pattern (`src/libs/services/matricule.ts`) → pass numbers
  (`PASS-{year}-####`, §3).
- `branches` table (tenant-scoped, `Schema.ts:76`) → gate/branch binding.
- No `gate`, `shift`(guard), `visitor`, `visit`, `incident`, `pickup-authorization` tables exist today
  (the existing `shifts` table at `Schema.ts:180` is the academic AM/PM shift — **do not reuse it**).

---

## 2. Fake UI removal map

| Fake artifact | Path | Disposition |
|---|---|---|
| Hardcoded decoy arrays `RECENT_SCANS`, `DISMISSAL_PERMITS`, `GATE_LOGS`, `INCIDENTS_TODAY`, `VISITOR_REGISTRY`, `SECURITY_ALERTS` | `src/features/crm/ui/guard-portal-view.tsx` | **Delete the file.** It is referenced only by the portal page (verified via grep). No fake array is preserved as fallback data. |
| Decoy route | `src/app/[locale]/(dashboard)/dashboard/portals/guard/page.tsx` (renders `<GuardPortalView/>`) | Keep the route path per PLAN §4. Re-point the page to the new feature view (server page delegating to `src/features/guard/ui/guard-home-view.tsx`). |
| Missing nav | No sidebar entry today — the route is unreachable to real users. | Add "Sécurité & Gardiens" nav in `sidebar.tsx` + `portal-manifest.ts`, and the guard landing redirect (§4). |

`hr-directory-view.tsx` is **not** guard-owned (pre-existing CRM mock) — untouched, per surgical discipline.

---

## 3. Data model — `src/features/guard/models/guard-schema.ts`

Barrel line added to `src/models/Schema.ts`: `export * from '@/features/guard/models/guard-schema';`
(`src/libs/DB.ts` picks it up automatically). All tables carry `tenantId`; FKs cross-reference the proven
feature-schema pattern (lazy callbacks, re-export — see `certificates-schema.ts`).

### 3.1 Gates / shifts / devices / assignments

**`guardGates`** — `id uuid PK`, `tenantId` NN, `branchId uuid null FK→branches`, `gateCode varchar(30) NN`
(`unique(tenantId, gateCode)`), `gateName varchar(120) NN`, `direction varchar(10) NN` (`entry|exit|both`),
`isActive boolean NN default true`, timestamps. Soft-archive only (`DELETE` → `isActive=false` when referenced).

**`guardShifts`** — `id uuid PK`, `tenantId` NN, `branchId uuid null FK→branches`, `name varchar(120) NN`,
`startTime varchar(5) NN`, `endTime varchar(5) NN` (HH:MM convention, matching timetable slots), `isActive`,
timestamps. Distinct from the academic `shifts` table.

**`guardAssignments`** (the effective-dated guard↔gate↔shift↔device binding) — `id uuid PK`, `tenantId` NN,
`branchId` NN (resolved from the gate), `guardUserId text NN FK→user.id`, `gateId uuid NN FK→guardGates`,
`shiftId uuid NN FK→guardShifts`, `deviceId uuid null FK→scannerDevices` (the paired scanner this guard
operates), `effectiveFrom timestamp NN`, `effectiveUntil timestamp null` (open-ended), `status varchar(20) NN`
(`scheduled|active|expired|cancelled`), timestamps.
- Device scoping: `deviceId` re-verified `scanner_devices.id = ? AND tenant_id = ?`; a device may be bound to
  at most **one** active assignment at a time (`unique(deviceId)` partial index `WHERE status='active'`).
- A guard is **active at a gate only when `status='active'` AND `effectiveFrom <= now < effectiveUntil`**
  (or no `effectiveUntil`). Expired / future / cancelled → **fail closed** (no session, no scans, no release).
  No overlapping active assignments for the same `guardUserId` (partial unique on `(guardUserId)` where
  `status='active'`).

**`guardKioskSessions`** (kiosk session bound to tenant, branch, gate, device, operator) — `id uuid PK`,
`tenantId` NN, `branchId` NN, `gateId` NN, `deviceId uuid null`, `operatorId text NN FK→user.id`,
`assignmentId uuid NN FK→guardAssignments`, `startedAt NN`, `lastSeenAt null`, `expiresAt NN`
(server-set = `startedAt + guardKioskTtlMinutes`, default 240), `lockedAt null`, `status varchar(20) NN`
(`active|locked|closed`), timestamps. §8 covers expiry/auto-lock.

### 3.2 Visitor invitation → approval → pass → visit lifecycle

**`guardVisitorInvitations`** — `id uuid PK`, `tenantId` NN, `branchId uuid null`,
`visitorFirstName varchar(120) NN`, `visitorLastName varchar(120) NN`, `visitorPhone varchar(50) null`,
`visitorEmail varchar(255) null`, `purpose varchar(255) NN`, `hostId text NN FK→user.id` (the host,
role `school_admin|teacher|accountant|receptionist` — validated in service), `expectedDate date NN`,
`expectedStart varchar(5) NN`, `expectedEnd varchar(5) NN`, `status varchar(20) NN`
(`invited|approved|rejected|expired|cancelled`), `approvedById text null FK→user.id`, `approvedAt null`,
`createdById text NN FK→user.id`, timestamps.
- Host approval: `PATCH .../[id]/approve|reject` requires the caller to be `hostId` **or** school_admin
  (`guard.visitors.approve`). Auto-expires when `expectedDate` passes and status is still `invited`.

**`guardVisits`** (the actual visit / pass lifecycle; a walk-in has `invitationId = null`) —
`id uuid PK`, `tenantId` NN, `branchId uuid null`, `invitationId uuid null FK→guardVisitorInvitations`,
`visitorFirstName`, `visitorLastName`, `visitorPhone null`, `visitorEmail null`, `purpose`,
`hostId text null FK→user.id`, `hostName varchar(255) null` (evidence snapshot of the host's name at check-in,
never a credential), `passNumber varchar(30) null unique per tenant` (from `reserveMatricule`-style series
`PASS-{year}-####`), `badgeCredentialId uuid null FK→identityBadgeCredentials` (the visitor pass badge),
`status varchar(20) NN` (`pending|approved|rejected|checked_in|checked_out|no_show|cancelled`),
`checkInAt null`, `checkOutAt null`, `checkInBy text null FK→user.id`, `checkOutBy text null FK→user.id`,
`gateId uuid null`, `createdById NN`, timestamps.
- Walk-in: `POST /api/guard/visits` creates a `pending` visit (guard may approve the walk-in request inline
  or escalate to a host); approval issues a visitor pass = **one `identityBadgeCredentials` row
  (`subject_type='visitor'`, `user_id` = a dedicated visitor user row per tenant)**, raw token returned once.
- Check-in: `POST .../[id]/check-in` transitions `approved → checked_in`, records `checkInAt/By/gateId`, links
  `badgeCredentialId` if scanned. Check-out: `POST .../[id]/check-out` is **replay-safe** (§6). A visit cannot
  be checked in twice or checked out twice (transaction + status guard).

### 3.3 Pickup authorization and release

**`guardPickupAuthorizations`** (effective-dated, one-time pickup permission) — `id uuid PK`, `tenantId` NN,
`studentId text NN FK→user.id` (role `student` validated), `pickupPersonId uuid NN FK→guardians`
(re-verified via `guardian_students` link to the student where `can_pickup=true`, OR a new one-time
relationship), `relationshipType varchar(100) NN`, `authorizedFrom timestamp NN`, `authorizedUntil timestamp NN`,
`reason varchar(255) null`, `status varchar(20) NN` (`active|expired|cancelled|consumed`), `createdById NN`,
`consumedAt null`, timestamps. Created by school_admin / receptionist / parent-facing flows; **read-only to guard**.

**`guardReleaseEvents`** (immutable release evidence) — `id uuid PK`, `tenantId` NN, `studentId text NN`,
`authorizationId uuid NN FK→guardPickupAuthorizations`, `releaseMethod varchar(20) NN` (`badge_qr|manual`),
`operatorId text NN FK→user.id`, `gateId uuid NN`, `deviceId uuid null`, `kioskSessionId uuid null`,
`idempotencyKey varchar(255) null`, `releasedAt NN`, `evidence jsonb NN` (immutable snapshot §6 — never a
credential secret). Append-only; **no UPDATE path in any service.**

### 3.4 Gate scan events (immutable evidence)

**`guardGateScanEvents`** — `id uuid PK`, `tenantId` NN, `kioskSessionId uuid null FK→guardKioskSessions`,
`gateId uuid NN`, `deviceId uuid null`, `direction varchar(10) NN`, `credentialId uuid null
FK→identityBadgeCredentials`, `subjectType varchar(20) null` (`student|staff|visitor`), `studentId text null`,
`visitId uuid null FK→guardVisits`, `resultStatus varchar(20) NN`
(`accepted|rejected|already_processed|released`), `rejectionReason varchar(60) null` (server-side evidence
only — never echoed to the caller verbatim), `idempotencyKey varchar(255) null`, `scannedAt NN`, `actorId text NN`.
- Append-only. Partial unique `unique(idempotency_key)` where `idempotency_key IS NOT NULL`.
- Replay-dedupe for the same credential + direction + gate + date reuses the attendance `already_scanned`
  pattern (a repeat is recorded as `already_processed`, never double-processed).

### 3.5 Incidents, escalation, evidence attachments

**`guardIncidents`** — `id uuid PK`, `tenantId` NN, `branchId uuid null`, `gateId uuid null FK→guardGates`,
`category varchar(50) NN` (e.g. `comportement|objet_perdu|acces|securite|medical|autre`), `severity varchar(20) NN`
(`low|medium|high|critical`), `location varchar(255) null`, `description text NN`, `reportedById text NN FK→user.id`,
`occurredAt NN`, `status varchar(20) NN` (`open|in_progress|escalated|resolved|closed`), `escalatedToId text null
FK→user.id` (leadership), `escalatedAt null`, `resolvedById null`, `resolvedAt null`, `resolutionNotes text null`
(restricted — leadership/incident managers only, never a `guard.*` default), timestamps.

**`guardIncidentActions`** — append-only follow-up/escalation trail: `id PK`, `tenantId`, `incidentId NN
FK→guardIncidents`, `actionType varchar(30) NN` (`note|escalate|assign|resolve|close|reopen`), `notes text null`,
`actorId NN FK→user.id`, `createdAt NN`.

**`guardIncidentAttachments`** — `id PK`, `tenantId`, `incidentId NN FK→guardIncidents`, `storageKey text NN`
(blob-store immutable path), `originalName`, `mimeType`, `fileSize`, `uploadedById text null FK→user.id`, `createdAt NN`.
Uses `saveUploadedFile` (+ `scanBuffer` from ClamAV when available); deletion is **soft-archive** (retain blob).

### 3.6 Emergency procedures / contacts / activation / acknowledgement

**`guardEmergencyProcedures`** — `id PK`, `tenantId`, `branchId uuid null`, `title NN`, `body text NN`, `version NN`,
`isActive boolean NN default true`, `updatedById NN`, timestamps.

**`guardEmergencyContacts`** — `id PK`, `tenantId`, `branchId null`, `name NN`, `role varchar(120) NN`, `phone NN`,
`priority integer NN default 10`, `isActive`, timestamps.

**`guardEmergencyActivations`** — `id PK`, `tenantId`, `activatedById text NN FK→user.id` (**leadership only** —
`guard.emergency.activate`), `activatedAt NN`, `procedureSnapshot jsonb NN` (copy of active procedures at
activation — evidence, not a live join), `status varchar(20) NN` (`active|ended`), `endedById null FK→user.id`,
`endedAt null`, `reason text null`.

**`guardEmergencyAcknowledgements`** — `id PK`, `tenantId`, `activationId NN FK→guardEmergencyActivations`,
`acknowledgedById text NN FK→user.id`, `acknowledgedAt NN`, `deviceId uuid null`, `kioskSessionId uuid null`.
**Unique `(activationId, acknowledgedById)`** → idempotent per guard.

### 3.7 Optional handoff references (deferred — see §9)

No `guardHostelHandoffs` / `guardTransportHandoffs` tables in v1. The adapter boundary exists (§9) and
returns `{ enabled: false }` until the owning addon's APIs are stable.

---

## 4. Permissions and entitlement model

Add keys to `PERMISSIONS` in `src/libs/api/permissions.ts` (code-only — the map + role defaults are the
source of truth; **no DB seed needed**, matching how `events.*` were added):

| Key | French label | Grant |
|---|---|---|
| `guard.portal.use` | Utiliser le portail sécurité | `guard`, `school_admin`, `super_admin` |
| `guard.visitors.manage` | Gérer les visiteurs (check-in/out, pass) | `guard` + admin |
| `guard.visitors.approve` | Approuver les invitations de visiteurs | `school_admin`, `teacher` (host self-approval also enforced by ownership) |
| `guard.pickup.release` | Vérifier et libérer les élèves | `guard` + admin |
| `guard.incidents.manage` | Signaler et gérer les incidents | `guard` + admin |
| `guard.evidence.read` | Consulter la trace des accès et libérations | `guard` + admin |
| `guard.gates.manage` | Configurer portes, postes, affectations | `school_admin`, `super_admin` |
| `guard.emergency.activate` | Activer/terminer le mode urgence | `school_admin`, `super_admin` (leadership) |

**Guard role default set** — replace the inert directory keys with the real operational set:
`['guard.portal.use', 'guard.visitors.manage', 'guard.pickup.release', 'guard.incidents.manage',
'guard.evidence.read', 'events.checkin']` (keeps the existing event check-in duty).
**`students.read` / `attendance.read` / `events.read` are removed from the guard role** — they are inert
(role allowlists already exclude guard) and removing them prevents the sidebar from offering dead
directory links. `permissions.test.ts:47` must be updated to assert this exact set.

**Entitlement model** — the guard portal is **core** (no addon). Only the optional Hostel/Transport
handoff adapters call `requireAddon(tenantId, 'hostel' | 'transport')` (§9). Nothing else is addon-gated.

**Route guard pattern** for every new route:
`requireRequestContext(request, ['school_admin', 'super_admin', 'guard'])` (config routes: admin-only) →
`requireTenant(context)` → `requireCapability(context, 'guard.*')` → body validation → **re-verify every
foreign id** (`WHERE id=? AND tenantId=?`) → transaction → `recordAudit` (fire-and-forget).

---

## 5. Signed credential adapter design (single gate entry point)

`src/features/guard/services/credential-adapter.ts` — the **only** guard code path that touches a badge:

- `computeHmacHash` imported from the new shared `src/libs/api/badge-crypto.ts` (same algorithm/secret as
  attendance — provably the same infrastructure).
- `verifyGateCredential(rawToken, { tenantId, gateId, deviceId, kioskSessionId, direction })`:
  1. `tokenHash = computeHmacHash(rawToken)`; resolve `identityBadgeCredentials` by `(tenantId, tokenHash)`
     only (never by name/id — mirrors attendance).
  2. Hard status gate: `status === 'active'` **and** `(!expiresAt || now < expiresAt)` **and** no `revokedAt`.
     Any failure → record evidence row, return the **single generic** `{ ok: false }` (see §7 leak policy).
  3. Resolve the subject `user` row tenant-scoped; project to the safe whitelist (§7).
  4. Purpose-aware dispatch on `subjectType` + `direction`:
     - **visitor** → must map to a `guardVisits` row with `badgeCredentialId = credential.id` and status
       `approved|checked_in`; otherwise generic failure.
     - **student, direction=entry** → admit; return name/photo + `context: 'student_entry'` (no academic,
       no finance, no medical fields).
     - **student, direction=exit** → require an **active** `guardPickupAuthorizations` for this student
       (now inside `[authorizedFrom, authorizedUntil]`, status `active`) — the release flow lives in the
       release route, the scan only checks "is an exit authorization plausibly present" and returns
       `context: 'student_pickup'`; it never lists authorizations to the scanner screen.
     - **staff** → admit with staff label (name/photo/`staff` only; no HR data).
  5. Record a `guardGateScanEvent` (`accepted|rejected|already_processed`) with the idempotency key.
- Rejection reasons are stored server-side for the evidence trail; the **HTTP response is uniform** so an
  attacker cannot distinguish "no such badge" from "revoked badge" from "expired badge" from "wrong gate".
- The adapter is used by `POST /api/gate/credentials/verify` (§10). No second credential format exists.

---

## 6. Replay and concurrent-release protection

1. **Row-lock transaction for release/check-out** (`src/features/guard/services/release-service.ts`):
   `BEGIN` → `SELECT ... FROM guard_pickup_authorizations WHERE id=? AND tenant_id=? FOR UPDATE` → verify
   `status='active'` and `authorizedFrom <= now < authorizedUntil` → `INSERT guardReleaseEvents` → set
   `status='consumed'`, `consumedAt=now` → `COMMIT`. The row lock serializes concurrent releases; only one
   wins. The second sees `consumed` and fails with the generic release error.
2. **Database backstop**: partial unique index on `guard_release_events(authorization_id)` where
   `release_method IS NOT NULL` (i.e., one release event per authorization) — a race that bypasses the lock
   still violates uniqueness.
3. **Idempotency keys**: every scan and every release/check-out accepts an optional `idempotencyKey`;
   `guardGateScanEvents` has a partial unique on it, and the check-out route returns the *first* result for
   a repeated key (attendance `already_scanned` semantics) instead of double-recording.
4. **Check-out double-close**: `FOR UPDATE` on the visit row; `status` transition `checked_in → checked_out`
   is guarded — a replayed check-out returns `already_processed` (200 with the original `checkOutAt`) and
   records a `already_processed` evidence row, never a second check-out.
5. **One active assignment per guard & per device** (§3.1) and **one active kiosk session per
   device/gate** (§8) close the concurrent-misbinding holes.

---

## 7. Safe API response projections and forbidden-field matrix

### 7.1 Whitelist projections (nothing else is ever selected)

- **Person summary** (student/staff/visitor): `{ id, displayName, photoUrl, subjectType, label }` where
  `label` is one of `Élève | Personnel | Visiteur`.
- **Student pickup context** (release screen): person summary + `{ pickupPerson: { firstName, lastName,
  relationshipType, isPrimaryContact, isEmergencyContact } }`. No class, no grades, no attendance history,
  no finance, no medical, no guardian directory.
- **Expected arrivals** (gate home): for visitors — `{ visitorName, purpose, hostName, expectedStart,
  status }`; for pickups — `{ studentName, pickupPersonName, relationshipType, authorizedUntil }`.
- **Incident**: `{ id, category, severity, location, description, occurredAt, status, reportedByName }`.
  `resolutionNotes` only under `guard.gates.manage` or admin leadership capabilities.
- **Evidence trail**: `{ scannedAt, direction, resultStatus, subjectType, gateName, operatorName }` —
  never raw tokens, never token hashes, never contact details.

### 7.2 Forbidden-field matrix (guard responses must NEVER contain)

| Family | Representative fields | Never in any guard payload |
|---|---|---|
| Academic | grades, assessment results, homework, class schedule, attendance history | ✅ |
| Finance | `paymentStatus`, invoices, balances, fee data | ✅ |
| Medical | `bloodGroup`, `nationalId`, medical notes | ✅ |
| HR | `salary`, `qualification`, `employeeId`, `hireDate`, HR documents | ✅ |
| Guardian directory | full contact data of guardians other than the one authorized for the current pickup | ✅ |
| Credential secrets | `rawToken`, `tokenHash`, device `secretKey`, session cookies | ✅ |
| Identity manifests | bulk student/staff/visitor listings, unfiltered rosters | ✅ (search requires narrow identifiers, results capped at 20) |

### 7.3 Enumeration / leak policy

- **Failed verification is uniform**: `POST /api/gate/credentials/verify` and the release route return a
  single generic `VERIFICATION_FAILED` (`{ success:false, error:{ code:'VERIFICATION_FAILED' } }`) for
  unknown token, revoked/expired/replaced badge, wrong gate, wrong branch, closed session, and
  consumed/expired authorization alike. The precise `rejectionReason` lives only in the server-side
  `guardGateScanEvents`/`guardReleaseEvents` row.
- **Search** requires `?q=` with min length 3 (name) or min length 6 (phone) or an exact matricule; results
  capped at 20; there is **no** list-all-students endpoint for guard, and `/api/guard/students/[id]/pickups`
  returns only the authorized pickup persons for an explicit student id (404 for wrong tenant).

---

## 8. Kiosk session expiry and auto-lock behavior

- **Start**: `POST /api/guard/kiosk-sessions` requires an **active** assignment for the caller
  (guard) at `gateId`/`shiftId` overlapping now; the route binds `tenantId`, `branchId` (gate's branch or
  context branch), `gateId`, `deviceId` (tenant-verified, not disabled), `operatorId = context.userId`,
  `assignmentId`, and computes `expiresAt = startedAt + ttl` (default 240 min; ≤ shift end when the shift
  ends sooner). One active session per (deviceId) and per (operatorId, gateId) — starting a new one closes
  the previous.
- **Every guard API call** runs `requireActiveKiosk(kioskSessionId, context, { tenantId, branchId, gateId })`:
  session must exist, `tenantId` match, `branchId` match, `gateId` match, `status='active'`, `now < expiresAt`,
  `operatorId = context.userId`, and the underlying assignment still active. Any violation → the session is
  set to `locked` (server-side) and the response is a `401 KIOSK_LOCKED` (or `409 KIOSK_EXPIRED`) with the
  lock signal; the UI shows the lock screen.
- **Auto-lock UI** (`src/features/guard/ui/guard-kiosk-shell.tsx`): client-side idle timer (~60 s inactivity)
  calls `POST /api/guard/kiosk-sessions/[id]/lock` then shows the lock screen; the server also enforces
  expiry independently (client lock is ergonomics, server lock is the boundary). Rapid sign-out via
  `POST .../[id]/close` + the app's normal logout.
- **No browser persistence**: kiosk session id and all guard state live in React state / URL only. The plan
  explicitly forbids `localStorage`/`sessionStorage`/`indexedDB` for session ids, manifests, or identities.
  **Offline mode remains deferred** (§13).
- Guard test accounts: seed creates none (verified §1); acceptance creates a `guard` user per tenant via
  `/api/users` (role `guard`) + a credential account row so the normal login flow works (§12).

---

## 9. Optional Hostel / Transport integration adapters (defer-safe)

- Hostel phase 2 APIs **do not exist yet** (`src/features/hostel/**` unbuilt; registry `enabled:false`).
  Transport is likewise unbuilt. **No integration code targets them in v1.**
- Adapter boundary: `src/features/guard/services/handoffs.ts` exposes
  `getExpectedHandoffs(tenantId, branchId, date)` and `acknowledgeHandoff(...)` that first call
  `hasAddon(tenantId, 'hostel')` / `hasAddon(tenantId, 'transport')`; when disabled they return
  `{ enabled:false }` and the UI hides the transport/hostel handoff panel. When later enabled, the adapter
  maps the owning module's stable API (effective-dated allocations / trip rosters) into the guard's
  "expected arrivals" projection **without** the guard module depending on Hostel internals.
- The gate-home `expected` route (`/api/guard/me/expected`) includes a `handoffs: { hostel, transport }`
  object that is `{ enabled:false }` today — the safe degrade is live and tested.

---

## 10. API inventory

All routes under `src/app/api/guard/**` (+ the single `/api/gate/credentials/verify`), every one using the
§4 guard pattern. **API and mobile-first page inventory:**

### 10.1 Admin config (school_admin/super_admin, `guard.gates.manage`)

| Route | Method | Notes |
|---|---|---|
| `/api/guard/gates` | GET / POST | list (branch filter) / create; `unique(tenantId, gateCode)` 409 |
| `/api/guard/gates/[id]` | PATCH / DELETE | edit / soft-archive (409 `IN_USE` if assignments/visits reference) |
| `/api/guard/shifts` | GET / POST | create |
| `/api/guard/shifts/[id]` | PATCH / DELETE | edit / soft-archive |
| `/api/guard/assignments` | GET / POST | create assignment; overlap + device-binding guards (§3.1) |
| `/api/guard/assignments/[id]` | PATCH / DELETE | cancel/expire; DELETE only if no active kiosk session |

### 10.2 Guard operational (`guard.*` capabilities)

| Route | Method | Capability | Notes |
|---|---|---|---|
| `/api/guard/me/shift` | GET | `guard.portal.use` | current active assignment + kiosk session status + shift window; 403 if none |
| `/api/guard/me/gate` | GET | `guard.portal.use` | assigned gate projection |
| `/api/guard/me/expected` | GET | `guard.portal.use` | expected visitors (approved invites in window) + active pickup authorizations + handoff object (§9) |
| `/api/guard/me/incidents` | GET | `guard.incidents.manage` | open incidents for the branch/gate |
| `/api/gate/credentials/verify` | POST | `guard.portal.use` | §5 adapter; uniform failure; records evidence |
| `/api/guard/visits` | GET / POST | `guard.visitors.manage` | narrow search (cap 20) / walk-in create + inline approve |
| `/api/guard/visits/[id]/check-in` | POST | `guard.visitors.manage` | approve→checked_in; replay-safe |
| `/api/guard/visits/[id]/check-out` | POST | `guard.visitors.manage` | checked_in→checked_out; replay-safe (§6) |
| `/api/guard/visits/[id]/pass` | POST | `guard.visitors.manage` | issue visitor badge via `POST /api/identity-badges` (subjectType visitor); raw token returned once |
| `/api/guard/visitor-invitations` | GET / POST | `guard.visitors.manage` (create) / `guard.visitors.approve` context | host creates invite |
| `/api/guard/visitor-invitations/[id]/approve` | POST | `guard.visitors.approve` | host self or admin; ownership check |
| `/api/guard/visitor-invitations/[id]/reject` | POST | `guard.visitors.approve` | reject |
| `/api/guard/pickup-authorizations` | GET / POST | admin / receptionist create; guard read | effective-dated authorizations |
| `/api/guard/pickup-authorizations/[id]/cancel` | POST | admin | cancel an unused authorization |
| `/api/guard/students/[id]/pickups` | GET | `guard.pickup.release` | §7.1 projection; 404 cross-tenant |
| `/api/guard/pickups/release` | POST | `guard.pickup.release` | §5/§6 release transaction; evidence + consume |
| `/api/guard/scans` | GET | `guard.evidence.read` | evidence trail (session/gate/date filters, capped) |
| `/api/guard/kiosk-sessions` | POST | `guard.portal.use` | §8 start |
| `/api/guard/kiosk-sessions/[id]/lock` | POST | `guard.portal.use` | auto-lock (server + client idle) |
| `/api/guard/kiosk-sessions/[id]/close` | POST | `guard.portal.use` | sign-out / close |

### 10.3 Incidents & emergency

| Route | Method | Capability | Notes |
|---|---|---|---|
| `/api/guard/incidents` | GET / POST | `guard.incidents.manage` | list / report (+ attachments via `request.formData()`) |
| `/api/guard/incidents/[id]` | PATCH | `guard.incidents.manage` | escalate/resolve/close; `resolutionNotes` gated |
| `/api/guard/incidents/[id]/actions` | GET / POST | `guard.incidents.manage` | append-only trail |
| `/api/guard/incidents/[id]/attachments` | POST | `guard.incidents.manage` | `saveUploadedFile` + optional `scanBuffer`; soft-archive delete |
| `/api/guard/emergency/procedures` | GET | `guard.portal.use` | active procedures + contacts (branch-scoped) |
| `/api/guard/emergency/activate` | POST | `guard.emergency.activate` | leadership only; snapshot procedures |
| `/api/guard/emergency/[activationId]/acknowledge` | POST | `guard.portal.use` | idempotent per guard (§3.6) |
| `/api/guard/emergency/[activationId]/end` | POST | `guard.emergency.activate` | leadership |

### 10.4 Mobile-first pages (keep `/dashboard/portals/guard` root)

- `/dashboard/portals/guard` — Gate Home (shift/gate/expected/pickups/incidents/emergency status)
- `/dashboard/portals/guard/scanner` — badge/QR kiosk (mirrors `attendance-scanner-kiosk.tsx`; large touch
  targets, lock + sign-out buttons)
- `/dashboard/portals/guard/visitors` — visitor check-in/out + invitations + pass
- `/dashboard/portals/guard/pickups` — pickup lookup / verification / release
- `/dashboard/portals/guard/incidents` — incidents + evidence
- `/dashboard/portals/guard/emergency` — procedures, contacts, activation, acknowledgement
- `/dashboard/portals/guard/config` — admin config (gates/shifts/assignments/device binding) — `guard.gates.manage`
- Shared shells: `guard-kiosk-shell.tsx` (idle lock), `guard-home-view.tsx` (gate home)

Nav registration: "Sécurité & Gardiens" → `/${locale}/dashboard/portals/guard` in **both**
`src/components/shared/sidebar.tsx` (`schoolNavItems`, permission `guard.portal.use`, subItems to the
sub-pages) and `src/libs/api/portal-manifest.ts` (`FULL_NAVIGATION`). Add `guard: 'portals/guard'` to
`ROLE_LANDING_PAGE` in `dashboard/page.tsx` so guards land on their workspace.

---

## 11. Migration and rollback strategy

### 11.1 Migration `migrations/0076_guard_security_portal.sql` (hand-written; **never** `drizzle-kit generate`)

Single transaction, in order:
1. `CREATE TABLE IF NOT EXISTS` all §3 tables (feature schema mirrors the SQL).
2. Partial unique indexes: `guard_pickup_authorizations` overlap prevention is service-enforced; unique on
   `guardReleaseEvents(authorization_id)`; unique on `guardGateScanEvents(idempotency_key)` where not null;
   `unique(guardEmergencyAcknowledgements(activation_id, acknowledged_by_id))`; partial uniques for
   one-active-assignment-per-device and per-guard (§3.1).
3. Seed nothing (permissions are code-only; no entitlement rows — the portal is core).
4. Append exactly one `_journal.json` entry: `{ "version": "7", "when": 1786600000000, "tag":
   "0076_guard_security_portal", "breakpoints": true, "idx": 77 }` — `when` > 1786500000000; filename == tag + ".sql".

**Verification gate:** `docker compose build migrate && docker compose up migrate` → captured exit 0; rerun
produces no change (idempotent DDL); `SELECT count(*) FROM guard_gates` = 0 rows (empty, not errored).

### 11.2 Rollback

- **Dev/test**: drop the guard tables, remove the journal entry. Captured as a `DOWN` comment block.
- **Production**: do **not** drop schema. The portal is core (no addon toggle), so the supported disable is
  **permission-based**: remove `guard.*` grants from the guard role's tenant `role_permissions` overrides
  (or set the user inactive). Data is preserved read-only; on re-grant everything returns. Hostel/Transport
  handoffs are already disabled by the adapter's `hasAddon` check.

---

## 12. Atomic implementation phases (each ends in a green gate)

Shared gate after every phase: `npx tsc --noEmit` (0), `npx next build` (exit 0, captured), Docker build for
`app` + `migrate` (captured exit codes), `npx tsx scripts/check-tenant-isolation.ts` (baseline 3 known files),
`npx vitest run` (permissions test updated).

- **Phase 0 — Preflight (no code):** lock shared files (`migrations/meta/_journal.json`, `Schema.ts`,
  `permissions.ts` + `permissions.test.ts`, `sidebar.tsx`, `portal-manifest.ts`, `dashboard/page.tsx`) with
  the NEXT-WAVE collision protocol; re-confirm highest migration = 0076/idx 77; snapshot the 432-file dirty
  worktree so phase diffs are attributable.
- **Phase 1 — Schema + migration + permissions + role defaults:** `guard-schema.ts`, Schema barrel, migration
  0076 + journal, `permissions.ts` `guard.*` keys, guard role default rewrite, `permissions.test.ts` update,
  `badge-crypto.ts` extraction + attendance routes re-pointed to it (no behavior change). Verify: migrate,
  rerun, tsc, build, isolation, vitest.
- **Phase 2 — Admin config:** gates/shifts/assignments services + routes + `/dashboard/portals/guard/config`
  view; device binding + overlap guards; IN_USE archive guards.
- **Phase 3 — Kiosk + credential adapter + scanner:** `guardKioskSessions` lifecycle, `credential-adapter.ts`,
  `/api/gate/credentials/verify`, `guardGateScanEvents`, `guard-kiosk-shell.tsx` (idle lock, no browser
  storage), scanner page, `/api/guard/me/*`.
- **Phase 4 — Visitor + pickup + release (replay-safe):** invitations/approval/pass/visits + check-in/out,
  pickup authorizations + `release-service` (row lock + partial unique), evidence rows, and the release /
  check-out UI. This is the phase where §6 guarantees are exercised.
- **Phase 5 — Incidents, emergency, gate home, nav:** incidents + actions + attachments (ClamAV path),
  emergency procedures/contacts/activation/acknowledgement, expected list, sidebar + manifest + landing
  redirect.
- **Phase 6 — Handoff adapters + full adversarial acceptance:** `handoffs.ts` stub (`{enabled:false}`),
  addon-disable regression, and the complete §14 matrix + live two-tenant sweep.

---

## 13. Explicitly deferred (not in v1)

- Offline encrypted expiring manifests and reconciliation (source delivery item 5) — **deferred**; online
  workflows must pass first.
- Real SMS/email delivery for visitor invitations (store data; transport deferred — matches HR precedent).
- Hostel/Transport handoff **tables and integrations** until those addons expose stable phase-2 APIs (§9).
- Emergency **drills** (scheduled test activations) — later.
- Guard analytics / reporting surface; photo-capture kiosk camera integration; hardware door controllers.

---

## 14. Adversarial security test matrix

| # | Attack / condition | Expected safe behavior | Verify |
|---|---|---|---|
| T1 | Expired guard assignment (past `effectiveUntil`) | No kiosk session can start; `me/*` → 403; scans/releases rejected | curl as expired guard |
| T2 | Future / cancelled assignment | Same as T1 (fail closed) | curl |
| T3 | Wrong gate vs assigned gate | `requireActiveKiosk` mismatch → generic fail; evidence `rejection_reason` recorded | curl |
| T4 | Wrong branch (`x-branch-id`) | Session/route branch mismatch → 403 | curl with header |
| T5 | Cross-tenant: tenant A guard scans tenant B badge / releases tenant B student | 404 (existence-hidden) on every foreign id; generic verify failure | two-tenant sweep |
| T6 | Fake/random QR | Uniform `VERIFICATION_FAILED`; evidence row recorded; no person info | curl |
| T7 | Revoked / expired / replaced badge (old token) | Uniform failure; the `replaced` badge's old token fails even though a successor exists | issue→replace→scan old |
| T8 | Replayed verify (same token twice) | Second = `already_processed` evidence row; no double side-effect | curl twice |
| T9 | Replayed release (same `idempotencyKey`, and fresh key against consumed authorization) | One release; second → generic failure; unique index is the backstop | parallel + serial |
| T10 | Concurrent releases on same authorization | Exactly one `guardReleaseEvents` row | `Promise.all` x10 |
| T11 | Double check-out of a visit | One `checkOutAt`; replay → `already_processed` 200 | curl twice |
| T12 | Kiosk expiry / lock | After `expiresAt` or `lock`: every operation → lock/expire signal; UI shows lock screen; server enforces independently of client | manipulate `expiresAt`, reopen page |
| T13 | Disabled device / closed session | Device `is_disabled` or session not `active` → reject | PATCH device |
| T14 | Forbidden-field audit | Response JSON of every guard route has **zero** forbidden-family keys (academic/finance/medical/HR/guardian-directory/credential-secret) | scripted JSON key scan + grep of projections |
| T15 | Directory enumeration | Broad `?q=` (len<3), no params, or pagination sweep returns capped/no results; no list-all endpoint exists | curl |
| T16 | Browser storage leak | No `localStorage`/`sessionStorage`/`indexedDB` writes in guard UI; manifests absent | grep guard UI + DevTools |
| T17 | Addon-disabled handoff | `me/expected` returns `handoffs: {enabled:false}`; hostel/transport never queried | toggle entitlement off |
| T18 | Guard role capability blast radius | Guard's effective permissions = the exact new set; `permissions.test.ts` asserts it; guard cannot call `/api/students` (role allowlist) | vitest + curl |
| T19 | Incident attachments | Upload → ClamAV path + immutable blob; delete soft-archives, blob retained | curl + fs |
| T20 | Emergency ack idempotency | Same guard acknowledges twice → one row (unique) | curl twice |

---

## 15. Owner decisions requested before implementation

1. **Guard role default permissions** — confirm replacing `students.read/attendance.read/events.read` with the
   `guard.*` set (§4). Recommended yes (the old keys are inert and would otherwise surface dead directory
   sidebar links). This updates `permissions.test.ts`.
2. **Kiosk TTL default** — confirm 240 minutes (or shift-bounded). Recommended: 240, clamped to shift end.
3. **Walk-in visitor phone/email capture** — confirm a walk-in visit may store phone (used only for narrow
   lookup + emergency contact), never full identity documents. Recommended yes (identity-minimized).
4. **Guard landing redirect** — confirm `guard` role should land directly on `/dashboard/portals/guard`
   (add to `ROLE_LANDING_PAGE`). Recommended yes.
5. **Incident attachments** — confirm ClamAV scanning is on by default for incident uploads (reuse
   `malware-scan.ts`), matching the attachments-book security posture. Recommended yes.

---

## 16. Exact files expected to be created or modified

### Created
- `src/features/guard/models/guard-schema.ts`
- `src/features/guard/services/credential-adapter.ts`
- `src/features/guard/services/release-service.ts`
- `src/features/guard/services/kiosk-service.ts`
- `src/features/guard/services/visitors-service.ts`
- `src/features/guard/services/incidents-service.ts`
- `src/features/guard/services/emergency-service.ts`
- `src/features/guard/services/handoffs.ts` (adapter stub)
- `src/features/guard/services/gates-service.ts` (gates/shifts/assignments)
- `src/features/guard/ui/guard-home-view.tsx`
- `src/features/guard/ui/guard-kiosk-shell.tsx`
- `src/features/guard/ui/guard-scanner-view.tsx`
- `src/features/guard/ui/guard-visitors-view.tsx`
- `src/features/guard/ui/guard-pickups-view.tsx`
- `src/features/guard/ui/guard-incidents-view.tsx`
- `src/features/guard/ui/guard-emergency-view.tsx`
- `src/features/guard/ui/guard-config-view.tsx`
- `src/libs/api/badge-crypto.ts` (extracted shared HMAC helper)
- Routes under `src/app/api/guard/**` (§10) and `src/app/api/gate/credentials/verify/route.ts`
- Pages under `src/app/[locale]/(dashboard)/dashboard/portals/guard/**` (§10.4)
- `migrations/0076_guard_security_portal.sql`
- `scripts/verify-guard-phase*.mjs` (live acceptance harness, HR-verify pattern)

### Modified
- `src/models/Schema.ts` (barrel line)
- `migrations/meta/_journal.json` (one entry, `idx: 77`)
- `src/libs/api/permissions.ts` (`guard.*` keys + guard role defaults)
- `src/libs/api/permissions.test.ts` (guard set assertion)
- `src/app/api/identity-badges/route.ts`, `[id]/replace/route.ts`, `bulk-issue/route.ts`,
  `attendance/qr/verify-and-stage/route.ts` (re-point `computeHmacHash` to `badge-crypto.ts`; no behavior change)
- `src/components/shared/sidebar.tsx` ("Sécurité & Gardiens" nav)
- `src/libs/api/portal-manifest.ts` (`FULL_NAVIGATION` entry)
- `src/app/[locale]/(dashboard)/dashboard/page.tsx` (`ROLE_LANDING_PAGE` guard entry)
- `src/app/[locale]/(dashboard)/dashboard/portals/guard/page.tsx` (re-point to new view)

### Removed
- `src/features/crm/ui/guard-portal-view.tsx` (the fake decoy; the only reference was the portal page)

### Explicitly NOT touched
`src/features/attendance/**` (schema/UI — only the shared HMAC helper is re-pointed),
`src/features/hr/**` (read-only dependency), `src/features/hostel/**`, `src/features/inventory/**`,
`src/features/events/**`, payroll/leave routes, `src/features/crm/**` (other than deleting the guard decoy).

---

## 17. Risks and dependencies

- **R1 Dirty worktree (432 files)**: no commits; shared-file edits reviewed against *current* contents;
  phase diffs attributable only to Guard work. Never "clean up" unrelated files.
- **R2 Schema import cycle** (`Schema.ts` ↔ `guard-schema.ts`): follow the proven `certificates-schema.ts`
  lazy-FK pattern.
- **R3 `badge-crypto.ts` extraction** must be byte-identical behavior — the attendance verify route keeps
  working (39/39 attendance baseline must stay green).
- **R4 Two nav systems** (`sidebar.tsx` and `portal-manifest.ts`) can drift — update both and verify the
  guard section renders for a guard login.
- **R5 Hand-edited journal**: single entry, exact tag/filename, strictly increasing `when`, verified by
  `docker compose up migrate` with a captured exit code.
- **R6 Docker build cost / EOF flakiness**: build `migrate` and `app` sequentially, capture exit codes
  (`echo "EXIT_CODE:$?"` into a log file).
- **R7 No guard test accounts exist**: acceptance must create guard users (role `guard`) + credential rows
  (§8) before live two-tenant sweeps.
- **R8 `role_permissions` tenant overrides** could re-grant guard a forbidden key for a tenant — the
  forbidden-field audit (T14) catches drift, not just the code defaults.
- **Dependencies**: Advanced HR is shipped (staff identity boundary only). Hostel/Transport unbuilt →
  adapter stubs (§9). `branches`, `namingSeries`, `uploads.ts`/`blob-store.ts`/`malware-scan.ts`,
  `requireAddon`, `recordAudit` all confirmed present (§1.7).

*End of plan. Nothing here implies the feature is implemented — implementation starts only after owner
confirmation of §15 and phase-by-phase green gates.*
