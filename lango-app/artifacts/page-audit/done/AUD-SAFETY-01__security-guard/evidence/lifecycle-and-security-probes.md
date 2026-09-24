# AUD-SAFETY-01 — Lifecycle & security probes

Environment: `http://localhost:3449`, `schoolos_audit`. Accounts:
`securite@atlas.ma` (guard, active PORT-A/Matin assignment), `y.elamrani@atlas.ma`
(school_admin), real better-auth sessions. Writes carry `Safety`/`Fix`/`XT` tags.

## 1. Security lifecycle reconstructed

```
guard duty station: me/shift -> assignment(active) + gate(PORT-A) + shift(Matin)
kiosk: startKioskSession(gate=assignment gate) -> session with TTL (shift-end clamped)
scan: POST /api/gate/credentials/verify {kioskSessionId, rawToken, direction, idempotencyKey}
      -> verifyGateCredential: session gate authoritative; token HMAC resolved tenant-scoped;
         direction sanity; visitor visit binding; student pickup plausibility;
         append-only evidence row; replay by idempotency key
pickup: authorization (live guardian link, window) -> releaseStudent (FOR UPDATE,
        live-link re-check, single consume, immutable release evidence) -> exit scan evidence
incident: report (high/critical auto-escalate) -> immutable actions trail -> leadership notes
emergency: leadership activate (procedure snapshot) -> guard acknowledge (idempotent) -> leadership end
```

## 2. Lifecycle probe results (after fixes)

```
PASS kiosk start on own gate;  403 on another gate (assignment binding)
PASS visitor walk-in -> pass (raw token) -> scan entry accepted (visitor context)
PASS scan replay (same key) -> already_processed, no double evidence
PASS exit scan on an entry-only gate -> 401 (WRONG_DIRECTION, by design)
PASS visitor check-in/check-out on a valid gate; replays return replayed:true
PASS pickup release with live guardian link -> 201 + release evidence
PASS re-release of a consumed authorization -> 409
PASS release after the link is revoked -> 409 PICKUP_RIGHT_REVOKED (S-8 holds)
PASS guard escalation target refused 403; admin escalation + resolution notes 200
PASS guard cannot activate/end emergency (403); admin can; guard ack idempotent
PASS guard denied /api/finance/*, /api/hr/* (403/404)
```

## 3. Defects confirmed before fixes

### S-01 — legacy gate direction broke the whole scan path (High)

Pre-fix, the seeded gates stored `direction='in'/'out'` while the canonical
vocabulary (Zod enum + DB comment + UI) is `entry|exit|both`. Runtime evidence:

```
GET /api/guard/me/gate -> direction=in            (raw legacy value)
POST /api/gate/credentials/verify (entry) -> 401 VERIFICATION_FAILED
guard_gate_scan_events: result_status=rejected  rejection_reason=WRONG_DIRECTION
scanner UI showed "Sortie" for an entry gate and sent direction "in" (422)
config UI could not re-save the legacy gate (Zod enum rejected "in")
```

### S-02 — foreign-tenant gate accepted on visitor check-in (High)

Probe with a gate row created in another tenant:

```
POST /api/guard/visits (Atlas)                                  -> 201
POST /api/guard/visits/{id}/check-in {gateId: <foreign tenant>} -> 200 OK
DB: guard_visits.gate_id = foreign gate  (tenant mismatch)
    guard_gate_scan_events.gate_id = foreign gate, result accepted
```

A random (non-existent) gate id surfaced as a misleading `409 IN_USE` (FK
violation mapping) instead of a clean authorization refusal.

### S-03 — scan idempotency key never persisted (Medium)

`recordScanEvent` only persisted `extra.idempotencyKey`; the accepted path never
passed it, so the canonical evidence row stored `NULL`. A retry with the same
key re-executed the scan (duplicate accepted evidence) instead of returning
`already_processed`.

## 4. Post-fix evidence

```
PASS scan entry accepted after fix (legacy 'in' normalized) — context=visitor
PASS scan replay already_processed
PASS exit scan on entry-only gate refused (by design)
PASS check-in foreign-tenant gate refused 403 GATE_INVALID
PASS check-in unknown gate refused cleanly 403 GATE_INVALID (was 409 IN_USE)
PASS rejected evidence exposes canonical direction (entry/exit)
Counter-test (unit): branch-pinned home shows own-branch + tenant-wide
invitations only; Casablanca day bounds asserted as UTC instants
(2026-09-24T23:00:00Z → 2026-09-25T23:00:00Z for the 25th).
```

## 5. Reviewed, not changed (documented decisions)

- **Incident terminal transitions:** `PATCH /incidents/[id]` accepts any of the
  5 statuses from a guard, and `POST /incidents/[id]/actions` with
  `resolve|close|escalate` transitions without leadership while resolution
  *notes* and escalation *target* stay leadership-gated. The incidents UI
  renders those buttons for guards deliberately, so this is treated as a
  product decision; flagged for the orchestrator (S-07 in the report).
- **Branch on check-in/check-out:** the gate is now tenant-verified; a hard
  branch equality check could break legitimate cross-branch flows and the gate
  pickers are already branch-scoped. Logged (S-08).
- **Kiosk outside shift hours:** an assignment without `effectiveUntil` keeps a
  kiosk session possible outside the shift window; the TTL clamp now uses the
  Casablanca shift end when it is still ahead. Assignment semantics unchanged.
- **Seed fixture incoherence (fixed):** authorizations existed for
  non-authorized guardian links, released authorizations stayed `active`, and
  seeded incident categories were outside the enum. Corrected in
  `scripts/seed-full.ts` and in the audit DB fixture (see gates/tests doc).
