# AUD-RECEPTION-01 — Reception / Front Desk / Visitor & Daily Operations — Executor Report

## 1. Handoff Metadata

- Executor: Agent B (opencode-1)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-b/AUD-RECEPTION-01`
- Implementation SHA(s): `45ce0c1aefa3b6dc2912b7a8f5126196078a21b9`
- Hub item: `task:AUD-RECEPTION-01` (+ `task:port-3448`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-RECEPTION-01__reception-front-desk/`

## 2. Scope

### Pages audited

| # | Route/Page | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/receptionist` | receptionist | Front-desk home: KPIs, today's appointments, on-site visitors, lookup, open handoffs | FIXED (R-04, R-05, R-06, R-08) |
| 2 | `/dashboard/receptionist/inquiries` | receptionist | Walk-in/phone inquiry intake + duplicate guard | PASS |
| 3 | `/dashboard/receptionist/appointments` | receptionist | Appointment book + lifecycle + history | FIXED (R-06) |
| 4 | `/dashboard/receptionist/visitors` | receptionist | Visitor sign-in, pass, gate check-in/out | FIXED (R-08) |
| 5 | `/dashboard/receptionist/pickups` | receptionist | Student release (default-deny) | PASS — honest forbidden state documented as intended |
| 6 | `/dashboard/receptionist/handoffs` | receptionist | Task handoffs | PASS |
| 7 | `/dashboard` | receptionist | Redirects to the portal home | PASS |
| 8 | `/dashboard/students` | receptionist | Student directory (nav + `students.read`) | FIXED (R-01, R-02) |
| 9 | `/dashboard/students/parents` | receptionist | Guardian directory | PASS |
| 10 | `/dashboard/transport` (+allocations, incidents) | receptionist | Transport views in nav | PASS — key warning on allocations logged (transport lane) |
| 11 | Reception APIs (27 routes) | receptionist/school_admin | `/api/reception/**` | FIXED (R-03, R-07); lifecycle probes pass |

Inventory: `evidence/route-inventory.md`.

### Explicitly out of scope

- Hostel / inventory / broadcast front-desk capabilities (no nav entry; their lanes).
- Transport allocations React-key warning (codex-2 follow-up, transport lane).
- Granting the receptionist academic-structure reads (capability decision, logged).

### Frozen dependencies not modified

- No module was frozen for this task. Attendance Core untouched. The shared
  guard services (`visitors-service`, `release-service`, `gates-service`) and
  the broadcast `sms-delivery` service were **called, never modified**.

## 3. Workflow Understanding

1. A receptionist signs in; `resolveLandingPath` lands the portal-confined role
   on `/dashboard/receptionist` (the generic `/dashboard` item is dropped).
2. The nav renders the capability-filtered manifest: Élèves & Profils, Parents
   & Tuteurs, Accueil & Réception (6 pages), Transport Scolaire.
3. Home aggregates `getReceptionHome` (inquiries, guard visits, appointments,
   handoffs) and lists today's appointments + checked-in visitors.
4. Appointment lifecycle `scheduled → checked_in → completed`, with
   `cancelled`/`no_show` branches, enforced with `FOR UPDATE` + immutable
   status history + idempotent create.
5. Visitor lifecycle: front-desk sign-in auto-approves, pass issued, gate
   check-in/out replayed safely by idempotency key; outcomes written to
   `reception_identity_verifications` (method + outcome only).
6. Inquiries dedupe by phone/email in tenant before create; handoffs record
   intent only and never perform the destination module's action.
7. Attendance-style source of truth: `casablancaTodayIso()` for the business
   day; tenant + branch scoping at the service layer.

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| R-01 | High | `/dashboard/students` (receptionist) | Nav + page guard promised the directory (`students.read`) but GET's role allowlist excluded the receptionist: the page rendered a fake "Aucun élève trouvé" over zeroed KPIs | baseline screenshot; probe 403 | Fixed (allowlist + least-privilege projection) |
| R-02 | Medium | students list client | Refused/failed fetch kept the old state and rendered the empty state + zero KPIs — a silent lie; empty class dropdown for roles without academic reads | baseline screenshot; code trace | Fixed (error banner + honest empty + hidden filter) |
| R-03 | Medium | reception notifications | `sms_messages` written `status='sent'` + `sentAt` with **no provider call** for every appointment/handoff notice | DB row after probe; `evidence/runtime-probes.md` §7 | Fixed (canonical `sendSmsMessage`) |
| R-04 | Medium | reception home | UTC "today" window; visitor counts ignored the branch while appointments/handoffs were branch-scoped | code trace; probe | Fixed |
| R-05 | Low | reception home | Raw enum `high`/`admissions` rendered in the handoff list of an otherwise localised UI | baseline vs final screenshots | Fixed |
| R-06 | Low | reception home + appointments | Client "today" used the UTC day, disagreeing with the business day | code trace | Fixed |
| R-07 | Low | `/api/reception/staff` | Shared host picker required `appointment.manage` though the visitor dialog also uses it | code trace | Fixed (`requireAnyCapability`) |
| R-08 | Low | visitors | Home "Sortie →" anchor `#visit-<id>` had no matching row id | code trace | Fixed |
| R-09 | Info | `/dashboard/receptionist/pickups` | Page reachable on `reception.portal.use`, data API needs `reception.pickup.release` (default-deny) | baseline screenshot | Intended design, documented; independently confirmed by codex-2 in the hub |
| R-10 | Info | Seed data | Seeded handoff category `maintenance` is outside the documented category set; UI falls back to the raw value (correct for unknown values) | baseline/final home | Logged (seed outlier) |

## 5. Fixes Implemented

### R-01 — Receptionist directory access with a least-privilege projection
- Root cause: `GET /api/students` allowlist `[school_admin, teacher, accountant]`
  predates the receptionist's `students.read` grant; POST already allowed the role.
- Fix: added `receptionist` to GET; list zeroes finance and nulls `nationalId`
  (Massar `codeMassar` stays as the search key), detail strips finance +
  `nationalId`/`bloodGroup`/`address` + `placementsHistory`/`recentAssessments`.
- Files: `src/app/api/students/route.ts`. Regression risk: low; only adds a role
  and a projection, admin/teacher/accountant branches untouched.

### R-02 — Honest failure state in the students client
- Fix: `loadError` state → banner + "Chargement impossible" empty state with
  retry; `classesUnavailable` hides the class filter when classes cannot be
  read (also fixes the finance leak through the client for roles without
  `finance.read`, matching the teacher lane's fix).
- Files: `features/students/ui/students-list-client.tsx`.

### R-03 — Notification delivery truth
- Root cause: `sendApprovedNotification` inserted the SMS row directly with
  `status:'sent'`.
- Fix: `sendSmsMessage(tenantId, { to, body, createdById })`; template
  allowlist unchanged; delivery result surfaces `simulated/queued` without a
  provider and `sent` only with provider evidence; STOP/opt-out respected.
- Files: `features/reception/services/notifications-service.ts`.

### R-04/R-06 — Business day and branch truth
- Fix: `casablancaTodayIso()` server-side; client `casablancaToday()` helper;
  branch filter added to both `guard_visits` home counts.
- Files: `features/reception/services/home-service.ts`, `reception-api.ts`,
  `reception-home-view.tsx`, `reception-appointments-view.tsx`.

### R-05 — Localised handoff enums
- Fix: `CATEGORY_KEYS` / `HANDOFF_PRIORITY_KEYS` reused; unknown values fall
  back to raw (honest).

### R-07 — Shared host picker capability
- Fix: `requireAnyCapability(['reception.appointment.manage', 'reception.visitor.manage'])`.
- Files: `src/app/api/reception/staff/route.ts`.

### R-08 — Visitor row anchors
- Fix: `id={'visit-'+id}` on the visitor row.

## 6. Security / Isolation / Permission Audit

- Tenant isolation: every reception query goes through the tenant-scoped
  services; `check:isolation` PASS with zero warnings in touched files.
- Branch isolation: appointments/handoffs already branch-scoped; visitor
  counts fixed; probes show branch A → 1, all branches → 2.
- Page guard: all six reception pages guarded by the capability matching their
  nav item (pickups intentionally portal.use); `check:ui`/parity unaffected.
- API capability/role guard: `/api/reception/**` allowlists
  `[receptionist, school_admin, super_admin]` + per-route capability; probed
  denials: finance, HR, guard kiosk, teachers.
- Add-on/entitlement: no reception add-on (core role feature).
- IDOR/object ownership: random appointment id → 404; lookup returns masked
  contacts only; identity verifications re-verify the subject in tenant (404 on
  foreign ids); pickup release re-checks guardianship under row lock (S-8,
  already verified).
- Request validation: Zod schemas unchanged; strict idempotency keys used.
- Sensitive-data exposure: R-01/R-02 closed the directory leak/lie; SMS bodies
  are template-rendered from structured fields, never free text.
- Audit logging: `recordAudit` on appointment/handoff create+transition,
  verification, and release paths; reads produce no audit rows.

Runtime evidence: `evidence/runtime-probes.md`.

## 7. Data / DB / Migration Impact

- Tables read: reception_appointments(+history), reception_handoffs(+history),
  reception_identity_verifications, guard_visits, inquiries, sms_messages,
  user, guardians/guardian_students, student/invoice tables via `/api/students`.
- Tables written during probes (audit DB only): appointments, handoffs,
  verifications, guard visits, sms_messages, inquiries — all tagged.
- Historical data changed: none. Migration added: none (journal unchanged).
- Fresh DB/replay proof: N/A (no schema change).

## 8. Tests

### Focused tests

```text
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/reception-portal-scope.test.ts
→ 1 file passed; 6/6 tests PASS
```

Related suites re-run: `security`, `student-360-hardening`,
`role-response-shape`, `permissions`, `page-guard`, `role-portals`
→ 6 files, 83/83 PASS. Combined 89/89.

### Runtime reconciliation

```text
receptionist / students GET            -> 200, total=200, projected fields        (was 403)
parent       / students GET            -> 403                                     (unchanged)
receptionist / reception/staff         -> 200 (visitor.manage alone)               (was appointment-gated)
appointment lifecycle                  -> 201/200/409 as expected, replay-safe
visitor lifecycle                      -> 201/200, check-in replay true
inquiry duplicate                      -> 409 DUPLICATE_INQUIRY
handoff lifecycle                      -> 201/200/200, terminal 409
lookup                                 -> 200, masked only
sms notification                       -> status 'queued', sent_at NULL           (was sent+sentAt)
home counts branch-scoped              -> branchA 1/1, all 2/2
```

### Static gates

```text
check:types      PASS
check:isolation  PASS (0 warnings in touched files)
check:i18n       PASS
missing-i18n     PASS (0 in 0 files)
check:ui         PASS (ratchet holding)
eslint touched   PASS for new/rewritten files; reception views improved; students client errors flat (276), warnings +17 from the repo-wide tailwind plugin noise
```

### Broader suite

- Run? NO (deferred) — the shared audit DB now contains concurrent agents'
  test residue (the finance-suite failures documented by AUD-TEACHER-01);
  focused suites cover every touched file. See `evidence/gates-and-tests.md`.

## 9. Visual / UX Evidence

Full manifest: `evidence/screenshot-manifest.md`.

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/baseline/receptionist-fr-students.png` | Before | FR | Desktop | Fake empty directory + zero KPIs (403) |
| `screenshots/final-fr/receptionist-fr-students.png` | After | FR | Desktop | 200 students, no finance, no dead class filter |
| `screenshots/baseline/receptionist-fr-receptionist.png` | Before | FR | Desktop | Raw `high` badge |
| `screenshots/final-fr/receptionist-fr-receptionist.png` | After | FR | Desktop | `Haute`, real KPIs |
| `screenshots/final-ar/receptionist-ar-receptionist.png` | After | AR | Desktop | RTL mirror, `عالية` |
| `screenshots/final-phone/…` | After | FR | 390 | Usable, no hscroll |
| `screenshots/final-fr/receptionist-fr-receptionist__{visitors,appointments,inquiries,handoffs,pickups}.png` | Final | FR | Desktop | Every reception page |

## 10. Files Changed

```text
lango-app/src/app/api/students/route.ts
lango-app/src/app/api/reception/staff/route.ts
lango-app/src/features/reception/services/home-service.ts
lango-app/src/features/reception/services/notifications-service.ts
lango-app/src/features/reception/ui/reception-api.ts
lango-app/src/features/reception/ui/reception-home-view.tsx
lango-app/src/features/reception/ui/reception-appointments-view.tsx
lango-app/src/features/reception/ui/reception-visitors-view.tsx
lango-app/src/features/students/ui/students-list-client.tsx
lango-app/src/app/api/__tests__/reception-portal-scope.test.ts        (new)
lango-app/artifacts/page-audit/done/AUD-RECEPTION-01__reception-front-desk/**
```

## 11. Unresolved / Follow-up Items

- **Overlap notice:** the students-directory finance gating in
  `students/route.ts` + `students-list-client.tsx` is the same surface fixed on
  `audit/agent-b/AUD-TEACHER-01` (implementation `2cc5ea9`). Both branches edit
  the same regions; merges are mechanical (same intent) but the orchestrator
  should merge with that context.
- **Pickups nav/page/API asymmetry** (R-09): documented as intended; changing
  it (hide the page unless `reception.pickup.release` is granted) requires the
  nav entry and page guard to move together (nav-page-guard-parity).
- Receptionist `/api/academics/classes|class-sections` 403s: handled client-side
  and the filter is hidden; granting reads is a capability decision.
- `/dashboard/transport/allocations` React key warning — codex-2 follow-up,
  transport lane.
- Full-suite rerun deferred (shared audit DB residue); focused coverage is
  complete for the touched files.

## 12. Frozen-Module / Cross-Module Impact

- No frozen module touched. Guard services and broadcast `sms-delivery` were
  consumed read-only; their tests (`student-360-hardening`, `security`) pass.
- The notification fix aligns the reception module with AUD-COMMS-01's
  delivery-truth direction (same canonical helper), reducing future merge work.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 45ce0c1aefa3b6dc2912b7a8f5126196078a21b9
OPEN CLAIMS: 0
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
