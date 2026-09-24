# AUD-SAFETY-01 — Security & Emergency + Guard / Entry Operations — Executor Report

## 1. Handoff Metadata

- Executor: Agent B (opencode-1)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-b/AUD-SAFETY-01`
- Implementation SHA(s): `92c857b93113a7b127b2b858509124ec4ce21b3a`
- Hub item: `task:AUD-SAFETY-01` (+ `task:port-3449`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-SAFETY-01__security-guard/`

## 2. Scope

### Pages audited

| # | Route | Role(s) tested | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/portals/guard` | guard | Duty-station home (shift/gate, expected, pickups, incidents) | FIXED (S-04) |
| 2 | `/dashboard/portals/guard/scanner` | guard | Kiosk session + badge verification | FIXED (S-01, S-03, S-05) |
| 3 | `/dashboard/portals/guard/visitors` | guard, admin | Visitor invitations, passes, check-in/out | FIXED (S-02) |
| 4 | `/dashboard/portals/guard/pickups` | guard, admin | Student release with safeguarding | PASS (S-8 fix verified live) |
| 5 | `/dashboard/portals/guard/incidents` | guard, admin | Report, trail, escalation, attachments | PASS + S-07 documented |
| 6 | `/dashboard/portals/guard/emergency` | guard, admin | Procedures, contacts, activation, ack | PASS |
| 7 | `/dashboard/portals/guard/config` | admin | Gates, shifts, assignments | FIXED (S-01 display) |
| 8 | `/dashboard` | guard, admin | Landing redirect | PASS |

APIs audited: 35 route files under `/api/guard/**` + `/api/gate/credentials/verify`
(the scan entry point) + the 9 guard services and 16 tables. Inventory:
`evidence/route-inventory.md`.

### Explicitly out of scope

- Reception surfaces (AUD-RECEPTION-01), transport (AUD-OPS-01 frozen),
  support/communications/attendance/academics/HR/finance/admissions — only
  denial-boundary probes.
- Hostel/transport handoffs are a static `enabled:false` adapter by design.

### Frozen dependencies not modified

- No frozen module touched. The shared `libs/api/badge-crypto` and
  `libs/api/badge-service` were consumed unchanged; `libs/finance/today.ts`
  gained additive helpers (no existing behavior altered).

## 3. Workflow Understanding

1. **Duty station.** A guard with an active, effective-dated assignment loads
   `me/shift|gate|expected`. Fail-closed: no active assignment → 403, uniform
   message. Student entry/exit is by signed badge; guard duties are gate-bound.
2. **Kiosk + scan.** `startKioskSession` binds tenant/branch/gate/device/operator
   and clamps the TTL to the shift end. `/api/gate/credentials/verify` takes the
   session as authoritative for gate/device, resolves the token by HMAC within
   the tenant, enforces gate direction, binds visitor badges to approved/
   checked-in visits, plausibility-checks student exit against an active pickup
   authorization, and writes append-only evidence.
3. **Visitor flow.** Invitation → approval (host or admin) → walk-in or linked
   visit → pass (signed badge) → replay-safe check-in/out → immutable evidence.
4. **Pickup safeguarding.** Effective-dated authorization (created only for a
   live guardian link) → release re-verifies the live link under `FOR UPDATE`,
   consumes exactly once, writes immutable release evidence, and records the
   exit scan.
5. **Incidents.** Report (high/critical auto-escalate) → append-only actions
   trail → resolution notes/escalation target leadership-gated.
6. **Emergency.** Leadership activates (snapshot of active procedures as
   evidence) → guard acknowledges idempotently → leadership ends.
7. **Admin config.** Gates/shifts/assignments with tenant-verified foreign ids,
   overlap guards, partial unique indexes, soft-archive only.

Source of truth: Casablanca business day (`libs/finance/today.ts`), published
gate/assignment rows, and append-only evidence tables.

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| S-01 | High | Scanner / config / config API | Seeded gates stored legacy `direction='in'/'out'` while the canonical vocabulary is `entry|exit|both`: scans rejected `WRONG_DIRECTION`, scanner mislabelled the gate "Sortie" and sent an invalid direction, legacy gates could not be re-saved | probe §3; baseline screenshots | Fixed (read-boundary normalization + canonical seed + fixture) |
| S-02 | High | Visitor check-in/out API | A gate owned by **another tenant** was accepted (stamped on the visit and scan evidence); a random id surfaced as `409 IN_USE` | probe §3 + DB rows | Fixed (`requireTenantGate` before the transaction) |
| S-03 | Medium | Scan verify | The idempotency key was never persisted on the first outcome → a retry re-executed the scan instead of `already_processed` (duplicate evidence) | probe §3 | Fixed (key persisted on the canonical row; replay row null) |
| S-04 | Medium | Guard home (`me/expected`) | "Today's" expected visitors used server-local day bounds and ignored the branch | code trace + unit test | Fixed (Casablanca day bounds + own-branch/tenant-wide filter) |
| S-05 | Medium | Kiosk TTL | Shift-end clamp used `Date.setHours` (server TZ) → session could outlive the shift by the UTC offset | code trace + unit test | Fixed (Casablanca wall-clock conversion) |
| S-06 | Low | Audit fixture | Seeded authorizations had no live guardian link, released ones stayed `active`, incident categories were outside the enum | DB queries | Fixed (seed + audit fixture) |
| S-07 | Info | Incidents | Terminal transitions (`resolve/close/escalate`) are guard-accessible while notes/escalation target are leadership-gated; the UI intentionally shows those buttons to guards | code + UI trace | Logged for product review (not changed) |
| S-08 | Info | Visitor check-in/out | Gate is tenant-verified but not branch-verified; pickers are branch-scoped already | code trace | Logged (avoid breaking cross-branch flows) |
| S-09 | Info | `/portals/guard/config` for guard | Direct URL lands on the in-app access-denied page; nav entry hidden | sweeps | Correct by design |
| S-10 | Info | Kiosk outside shift hours | An assignment without `effectiveUntil` permits a session outside the shift window; TTL clamp applies only inside the window | code trace | Documented (assignment is the authority) |

## 5. Fixes Implemented

### S-01 — Canonical gate direction at every read boundary
- `normalizeGateDirection` (in `gates-service`) maps `in→entry`, `out→exit`;
  applied to `listGates`, `getMyGate`, `getMyShift`, `verifyGateCredential` and
  the scan-evidence output.
- `scripts/seed-full.ts` writes canonical `entry`/`exit` for gates and scan
  evidence; the audit DB fixture was corrected (2 gates, 15 scan rows).

### S-02 — Tenant ownership of the gate on visitor check-in/check-out
- `checkInVisit`/`checkOutVisit` call `requireTenantGate(tenantId, gateId)`
  before the transaction; unknown/foreign gates now return `403 GATE_INVALID`
  and nothing is written (previously the visit row and scan evidence could carry
  another tenant's gate).

### S-03 — Scan idempotency
- `recordScanEvent` persists `input.idempotencyKey` on the canonical first
  outcome (accepted/rejected); the replay row keeps an explicit `null`, so the
  partial unique index still holds and a retry returns `already_processed`.

### S-04 — Guard home business day + branch
- `casablancaDayBoundsUtc()` (new, `libs/finance/today.ts`) drives the expected
  window; branch-pinned staff see their branch plus tenant-wide invitations.

### S-05 — Kiosk TTL clamp in school time
- Shift end is built with `casablancaWallTimeUtc(today, shift.endTime)` instead
  of server-local `setHours`, so the clamp is exact regardless of server TZ.

### S-06 — Seed/fixture coherence
- Authorizations only for links made live at seed time; released authorizations
  are marked `consumed`; incident categories use the enum values.

## 6. Security / Isolation / Permission Audit

- Tenant isolation: every guard service re-verifies the entity AND each foreign
  id (gate/guard/device/shift/incident/student); `check:isolation` PASS with
  zero warnings in touched files. S-02 closed the one cross-tenant hole found.
- Branch isolation: kiosk sessions/visits are branch-bound; the home expected
  list is now branch-scoped; config list helpers accept a branch filter.
- Page guard: verified per page; guard-only duty stations bounce school_admin
  in-app; config/incidents/emergency load only with the right capability.
- API guard: allowlists + capabilities probed (finance/HR/teachers denied to
  guard; emergency activation leadership-only; config admin-only).
- IDOR/tampering: random/foreign ids → 404/403; kiosk session ownership enforced
  (`operatorId` match); release consumes exactly once (DB partial unique); scan
  evidence append-only; incident actions append-only.
- Replay/idempotency: appointment/visitor/scan/release paths probed; S-03 fixed
  the scan gap.
- Safeguarding: live-link predicate identical at authorization and release,
  re-checked under `FOR UPDATE`; revoked link → `409 PICKUP_RIGHT_REVOKED`
  (proved at runtime).
- Mass assignment: Zod `.strict()` on all guard payloads; no raw body spread.
- Hidden privileged fields: scan failures are uniform (`VERIFICATION_FAILED`);
  precise reasons only in server-side evidence.
- Emergency contacts: phone numbers exposed only to guard/admin on the emergency
  page (capability-gated); no public surface.
- Audit logging: `recordAudit` on kiosk start, releases, invitations, incidents,
  attachments, emergency activation/ack/end.

## 7. Data / DB / Migration Impact

- Tables read/written: the 16 guard tables (+`identity_badge_credentials`,
  `scanner_devices`, `user`, `guardian_students`, `guardians`) — writes during
  probes tagged in `schoolos_audit` only.
- Historical data changed: none in product flows; the audit fixture was
  corrected once (documented SQL in `evidence/gates-and-tests.md`).
- Migration added: **none** — legacy direction values are tolerated on read and
  normalized on write; a data migration is suggested as follow-up.
- Fresh DB/replay proof: N/A (no schema change).

## 8. Tests

### Focused tests

```text
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/guard-safety-scope.test.ts
→ 7/7 PASS
```

### Runtime reconciliation

See `evidence/lifecycle-and-security-probes.md` §2/§4 for the full list:
kiosk/scan/replay, visitor lifecycle, safeguarding release + revocation, incident
escalation, emergency roles, denial boundaries, all with expected status codes.

### Static gates

```text
check:types      PASS
check:isolation  PASS (0 warnings in touched files)
check:i18n       PASS
missing-i18n     PASS (0 in 0 files)
check:ui         PASS (ratchet holding)
eslint touched   PASS (new files clean; touched files at or below baseline)
```

### Broader suite

- Run? NO — shared `schoolos_audit` holds concurrent agents' test residue; the
  focused suites cover every touched file. Related suites (release-live-link,
  onsite-headcount, guardians-domain, security, role-response-shape,
  student-360-hardening) re-run green: 77/77.

## 9. Visual / UX Evidence

Full manifest: `evidence/screenshot-manifest.md`.

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `final-guard-fr/guard-fr-portals__guard.png` | Home | FR | Desktop | "Portail principal · Entrée", expected pickups, canonical incident category |
| `final-guard-fr/guard-fr-portals__guard__scanner.png` | Scanner | FR | Desktop | Gate badge "Entrée" (fixed), honest session/empty states |
| `final-admin-fr/school_admin-fr-portals__guard__config.png` | Config | FR | Desktop | Canonical "Entrée"/"Sortie" directions |
| `final-guard-fr/…visitors/pickups/incidents/emergency.png` | Portal pages | FR | Desktop | Real data, loading/empty/forbidden states |
| `final-guard-ar/guard-ar-portals__guard.png` | Home | AR | Desktop | RTL mirror |
| `final-guard-phone/guard-fr-phone-portals__guard.png` | Home | FR | 390 | Usable, no hscroll |

## 10. Files Changed

```text
lango-app/src/features/guard/services/gates-service.ts     (direction normalization)
lango-app/src/features/guard/services/credential-adapter.ts (scan direction + idempotency)
lango-app/src/features/guard/services/visitors-service.ts  (tenant gate on check-in/out)
lango-app/src/features/guard/services/home-service.ts      (Casablanca day + branch)
lango-app/src/features/guard/services/kiosk-service.ts     (shift-end clamp + normalized reads)
lango-app/src/libs/finance/today.ts                        (day bounds + wall-time helpers)
lango-app/scripts/seed-full.ts                             (canonical/coherent guard fixture)
lango-app/src/app/api/__tests__/guard-safety-scope.test.ts (new)
lango-app/artifacts/page-audit/done/AUD-SAFETY-01__security-guard/**
```

## 11. Unresolved / Follow-up Items

- **S-07 (product decision):** guard-accessible `resolve/close/escalate` vs
  leadership-gated notes. Needs a product call; the UI and API currently agree
  with each other but not with the service comment. If leadership-only is
  desired, gate the action types too (one file + one test).
- **Legacy direction data migration:** read-tolerance is in place; a migration
  normalizing existing rows would remove the compatibility shim (needs a free
  migration number).
- **S-08 branch equality on check-in/out:** decide whether a gate from another
  branch of the same tenant may be used for a visit.
- Seeded `guardian_students` links default to non-authorized; the seed now marks
  the pairs it authorizes. A richer fixture (more live links) would exercise
  more UI, logged only.
- Full-suite rerun deferred (shared-DB residue).

## 12. Frozen-Module / Cross-Module Impact

- No frozen module modified. Transport/hostel boundaries untouched; handoffs
  remain the documented static adapter.
- `libs/finance/today.ts` is additive: existing `casablancaTodayIso` behavior
  unchanged; new helpers covered by unit assertions.
- `credential-adapter` remains the only guard code path touching badges and
  keeps the attendance HMAC algorithm/secret; `onsite-headcount` and
  `release-live-link` suites pass.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 92c857b93113a7b127b2b858509124ec4ce21b3a
OPEN CLAIMS: 0
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
