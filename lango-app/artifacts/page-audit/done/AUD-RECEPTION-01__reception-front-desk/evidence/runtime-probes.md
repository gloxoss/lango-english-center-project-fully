# AUD-RECEPTION-01 — Runtime probes

Environment: `http://localhost:3448`, `NEXT_DIST_DIR=.next-agentb-reception`,
`DATABASE_URL=…/schoolos_audit`. Account `accueil@atlas.ma` (Kenza Berrada,
`receptionist`) with the real better-auth session; no test bypass. Writes went
to `schoolos_audit` only and carry an `AUD-REC-*` tag (`Probe3 …` rows).

## 1. Appointment lifecycle

```
POST /api/reception/appointments                  -> 201 created=true
POST same body (same idempotencyKey)              -> 201 created=false, same id   (replay-safe)
POST /appointments/{id}/check-in                  -> 200 scheduled -> checked_in
POST /appointments/{id}/check-in (again)          -> 409 INVALID_TRANSITION
POST /appointments/{id}/complete                  -> 200
POST /appointments/{id}/cancel                    -> 409 (completed is terminal)
GET  /appointments/{id}                           -> 200 + immutable history rows
GET  /appointments/{random-uuid}                  -> 404 (no existence leak)
```

## 2. Visitor lifecycle (guard visits via the reception API)

```
POST /api/reception/visitors                      -> 201 (auto-approved front-desk sign-in)
POST /visitors/{id}/pass                          -> 201 (badge number issued)
GET  /api/reception/gates                         -> 200 (2 active gates)
POST /visitors/{id}/check-in {gate,idemKey}       -> 200 replayed=false
POST /visitors/{id}/check-in (same idemKey)       -> 200 replayed=true, original timestamp
POST /visitors/{id}/check-out {gate,idemKey}      -> 200
POST /api/reception/verifications {visitor}       -> 201 (method+outcome only, no document)
```

## 3. Inquiry intake

```
POST /api/reception/inquiries (unique phone)      -> 201
POST same phone again                              -> 409 DUPLICATE_INQUIRY + candidates
```

## 4. Handoff lifecycle

```
POST /api/reception/handoffs                      -> 201 open
POST /handoffs/{id}/acknowledge                   -> 200 acknowledged (actor+timestamp stamped)
POST /handoffs/{id}/resolve                       -> 200 resolved + notes
POST /handoffs/{id}/cancel                        -> 409 (resolved is terminal)
GET  /handoffs?assignedToMe=true                  -> 200
```

## 5. Lookup (enumeration resistance / PII minimisation)

```
GET /api/reception/lookup?q=Sam
-> 200, 9 results, fields: maskedPhone "+21****16", maskedEmail "et***@atlas.ma",
   matricule, className, pickup-authority flag. No raw phone/email/nationalId.
```

Rate limits enforced at the route (lookup 20/min/user, visitor create 15/min,
inquiry 10/min, verification 30/min, pickup search 30/min) via
`checkRateLimit`; minimum search lengths 3 (name) / 6 (phone) in the service.

## 6. Permission / isolation probes (before → after)

| Probe | Before | After |
|---|---|---|
| receptionist `GET /api/students?pageSize=5` | **403** (page rendered a fake "Aucun élève trouvé" over zeroed KPIs) | 200, `total=200`, `nationalId=null`, finance amounts 0 |
| receptionist `GET /api/students?id=<student>` | n/a (403) | 200 with `nationalId/bloodGroup/address/payments/balanceDue/recentAssessments` stripped; name/guardian/class kept |
| parent `GET /api/students` | 403 | 403 (allowlist unchanged for roles that must not use the staff directory) |
| receptionist `/api/reception/staff` with `reception.appointment.manage` denied by user override | 403 | 200 (visitor.manage alone opens the shared host picker); 403 when both are denied |
| receptionist `/api/reception/pickups/authorizations` | 403 | 403 — default-deny by design, page shows an honest forbidden state |
| receptionist `/api/finance/invoices`, `/api/hr/employees`, `/api/guard/me/gate`, `/api/teachers` | 403/404 | unchanged (no over-permission) |
| home counts branch scoping (unit-level) | unfiltered `guard_visits` | branch A → 1/1, no branch → 2/2 |

## 7. Notification delivery truth (before → after)

```
BEFORE: appointment create with guestPhone +212600000001
  sms_messages row -> status='sent', sent_at set, NO provider call or connection

AFTER:  appointment create with guestPhone +212699000123
  sms_messages row -> status='queued', sent_at=NULL, body rendered from the
  approved template; delivery result 'simulated' (no provider configured)
```

Covered by `sendApprovedNotification` now going through
`features/broadcast/services/sms-delivery.sendSmsMessage`, which also honours
STOP/opt-out suppressions and records failures honestly.

## 8. Sweeps (16 routes × FR desktop / AR RTL / phone 390)

`screenshots/baseline`, `final-fr`, `final-ar`, `final-phone` (+ JSON per run).

Remaining flags are expected/handled or out of scope:
- `/dashboard` → `/dashboard/receptionist` (correct portal landing, flagged as redirect);
- `/dashboard/receptionist/pickups` → 403 on the pickups list (default-deny by
  design; the page renders the explanatory forbidden state — independently
  confirmed by codex-2 in the hub);
- `/dashboard/students` → the client still probes `/api/academics/classes` and
  `/api/academics/class-sections` for its filter/placement tooling; both are
  403 for roles without `academics.read`, are caught by the client, and the
  class control is hidden when they fail;
- `/dashboard/transport/allocations` → React key warning already logged by
  codex-2 for the transport lane (outside this claim).
