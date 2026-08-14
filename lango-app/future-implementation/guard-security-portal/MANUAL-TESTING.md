# Guard & Security Portal — Manual Testing Guide

Complete end-to-end manual verification of the Guard & Security Portal. Run against a
local dev server (`npm run dev`) with the `0078_guard_security_portal.sql` migration applied
(filed as `0078`, not the `0076` originally reserved in `.implementation-plan/EXECUTION-PLAN.md`).
All screenshots below are described as the expected UI state; assert each one before moving on.

**Fixture setup — use the safe, idempotent creator** (never hand-edit the shared branch):

```bash
node scripts/create-guard-fixtures.mjs            # create (idempotent, rerun-safe)
node scripts/create-guard-fixtures.mjs --cleanup  # remove fixture rows + fixture branch
```

The creator scopes **every** fixture row to a dedicated branch `VERIFY-GUARD`
(created once, reused, never the shared `ATL` branch) and uses stable fixture
identifiers: guard `USR-GUARD-001` / `guard1@atlas.ma` / `Admin123!`, guardian
`guardian.fixture@atlas.ma` linked to student `STU-001`, gate `VG1`, shift `VGS1`,
and one active pickup authorization (now ± 2 days). Cleanup deletes only rows that
reference those fixture identifiers, wrapped in a single transaction. It never
touches normal tenant users, the `ATL` branch, real guardians, gates/shifts/
assignments, students, or operational records.

**Fixture users to create first** (via Settings → Utilisateurs, role assignment, or SQL,
or via the creator above):

| User | Role | Purpose |
|---|---|---|
| `g1@atlas.ma` | guard | Desk operator (walk-in visits, pass, release) |
| `g2@atlas.ma` | guard | Second guard for two-kiosk / cross-guard tests |
| `a1@atlas.ma` | school_admin | Leadership: config, emergency activation, escalation |
| `t1@atlas.ma` | teacher | Host who invites a visitor |
| `stu1` (student) | student | Student with a linked guardian for release tests |

Pre-flight in the admin config (`/dashboard/portals/guard/config`):

1. Create a gate **G1** (direction `both`, active).
2. Create a shift **S1** (e.g. 08:00–18:00).
3. Assign `g1@atlas.ma` → G1 / S1, effective today 00:00 → today 23:59, **active**.
4. Assign `g2@atlas.ma` → G1 / S1 same window (for multi-guard tests).
5. Ensure a device `D1` exists in Settings → Dispositifs de Scan.

---

## A. Happy-path feature sweep

### A1. Gate home
1. Sign in as `g1@atlas.ma`. You land on `/dashboard/portals/guard` (guard landing redirect).
2. Assert the header shows the active shift name and gate name.
3. Assert the four module cards (Scanner / Visiteurs / Sorties / Incidents) link to their pages.
4. Assert "Attendus aujourd'hui" and "Incidents récents" sections render empty-state text.

### A2. Admin config — gates, shifts, assignments
1. Sign in as `a1@atlas.ma` → `/dashboard/portals/guard/config`.
2. Create gate G1, shift S1, and the two assignments above.
3. Try to assign `g1` to **two overlapping** windows on the same gate → expect an overlap rejection.
4. Try to archive a gate that has an active assignment → expect `IN_USE` 409-style error.

### A3. Visitor with an invitation (host flow)
1. As `t1@atlas.ma`, create an invitation for visitor "Nadia B." (purpose "entretien", today, 10:00–11:00, host = self).
2. As `g1@atlas.ma` → **Visiteurs → Invitations**: assert "Nadia B." shows as **Invité**.
3. Approve the invitation (guard desk can approve; host could have approved via their own portal).
4. Back on **Visites**, search `Nadia` → the approved visit appears (status **Approuvé**).
5. Click **Émettre le pass** → a dialog shows a one-time raw token `LANGQR-…`. Copy it; close the dialog.
6. Click **Entrée** → status becomes **Pointé entrée** (a gate is required; if none, the button is disabled).
7. Click **Sortie** → status becomes **Sorti**.

### A4. Walk-in visitor (no rendezvous)
1. On **Visites**, click **Visiteur sans rendez-vous**.
2. Fill Prénom/Nom/Motif; leave "Approuver immédiatement" unchecked → save. Status = **En attente**.
3. Re-open the dialog, check "Approuver immédiatement" → save. Status = **Approuvé** and the **Émettre le pass** button appears.
4. Issue the pass; assert the token format `LANGQR-VST-<32hex>` and that the pass number shows next to the name.

### A5. Pickup release (manual, desk)
1. Ensure student `stu1` has a guardian linked (`guardianStudents` row, `canPickup = true`).
2. As `a1@atlas.ma`, create a pickup authorization for `stu1` × that guardian, window "now – +1h".
3. As `g1@atlas.ma` → **Sorties**. Search `stu1` (min 3 chars) → select.
4. Assert the guardian appears with **Contact principal** tag and the active authorization window.
5. Click **Remettre** → confirm dialog names the student and the pickup person. Confirm.
6. Assert success message "remis(e) à …" and that the authorization disappears from the active list.
7. Re-search `stu1` → the same authorization no longer appears (consumed).

### A6. Incidents
1. As `g1@atlas.ma` → **Incidents** → **Signaler un incident**.
2. Category "Accès", severity "Moyen", location "Portail principal", description text → **Signaler**.
3. Expand the incident: add a **note**, then **Escalader**, then **Résoudre**.
4. Assert the follow-up trail lists each action with the actor name and timestamp.
5. Upload a PNG attachment (max 10 MB) → assert it appears; delete it → assert the list row is gone.

### A7. Emergency
1. As `a1@atlas.ma` → **Urgence** → **Activer** (confirm dialog, optional reason).
2. As `g1@atlas.ma` → **Urgence**: assert the red **URGENCE ACTIVE** banner and the procedure snapshot.
3. Click **Accuser réception** → assert "Accusé reçu" badge; refresh → still acknowledged (idempotent).
4. As `a1@atlas.ma` → **Terminer l'urgence** → assert the banner clears.

### A8. Kiosk scanner (badge verification)
1. As `g1@atlas.ma` → **Scanner**. Start the kiosk session (Enter key). Assert the session is active.
2. Scan (paste) a valid student/staff badge token → assert green **Entrée autorisée**.
3. Scan it again with the same token → assert the second scan is a no-op (`already_processed`) with **no double side-effect**.
4. Leave the kiosk idle > 60 s → assert the lock screen appears and the session is locked server-side.
5. As `g2@atlas.ma`, confirm the kiosk is bound to the operator: the lock screen cannot be bypassed by refresh.

---

## B. Adversarial security matrix (§14)

Each row is a concrete reproduction. Record **actual** vs **expected**; a row fails if the
server ever returns more information than the expected response.

| # | Attack / condition | Steps | Expected safe behavior |
|---|---|---|---|
| **T1** | Expired guard assignment | Edit `g1`'s assignment `effectiveUntil` to yesterday (SQL). As `g1`, open Scanner / call `GET /api/guard/me/gate`. | 403 `NO_ACTIVE_GATE` / `NO_ACTIVE_SHIFT`; no kiosk session can start; scans and releases rejected. |
| **T2** | Future / cancelled assignment | Set `g1`'s assignment `effectiveFrom` to tomorrow, or status `cancelled`. | Same fail-closed 403 as T1. |
| **T3** | Wrong gate vs assigned gate | As `g1` (assigned to G1), attempt verify/release/check-in with `gateId` = G2. | Generic failure; `rejection_reason` recorded in `guard_gate_scan_events`; no identity leak. |
| **T4** | Wrong branch header | As `g1`, call any guard route with `x-branch-id: <other-branch>`. | 403 `FORBIDDEN`. |
| **T5** | Cross-tenant foreign id | Tenant A guard queries `GET /api/guard/students/<tenant-B-student-id>/pickups`, or releases a tenant-B student/authorization. | 404 (existence hidden) on every foreign id; generic verify failure for foreign badges. |
| **T6** | Fake / random QR | Scan `LANGQR-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`. | Uniform `VERIFICATION_FAILED`; an evidence row recorded; **no person info** in the response. |
| **T7** | Revoked / replaced badge | Issue badge for a user, then replace it (POST `identity-badges` again). Scan the **old** token. | Uniform failure — the old token fails even though a successor exists. |
| **T8** | Replayed verify | Scan the same valid token twice (any gap). | Second scan = `already_processed` evidence row; no double check-in/out/release. |
| **T9** | Replayed release | POST `/api/guard/pickups/release` twice with the **same** `idempotencyKey`, then once more with a **fresh** key. | Exactly one `guardReleaseEvents` row; replay and fresh-key-on-consumed both fail generically. |
| **T10** | Concurrent releases | `Promise.all` 10× `release` on the same authorization (different keys). | Exactly **one** `guardReleaseEvents` row (row lock + partial unique index). |
| **T11** | Double check-out of a visit | POST check-out twice. | One `checkOutAt`; replay returns `already_processed` 200; no error surface. |
| **T12** | Kiosk expiry / lock | Set `guard_kiosk_sessions.expires_at` in the past (SQL), or POST `/lock`. Reopen the scanner page. | Server rejects every operation with a lock/expire signal regardless of client; UI shows lock screen. |
| **T13** | Disabled device / closed session | PATCH the device to disabled, or close the kiosk session. Then scan. | Rejected — device not active / session not `active`. |
| **T14** | Forbidden-field audit | Run `node scripts/verify-guard-adversarial.mjs`; also capture the JSON of every guard route and grep. | **Zero** academic / finance / medical / HR / guardian-directory / credential-secret keys in any guard response. |
| **T15** | Directory enumeration | Call `?q=ab`, `?q=`, or paginate beyond caps on every list route. | Min-3-char guard; capped result sets; no list-all endpoint exists. |
| **T16** | Browser storage leak | DevTools → Application → Local/Session/IndexedDB after using every guard page. | **No** identity manifests or kiosk tokens written to browser storage. |
| **T17** | Addon-disabled handoff | `GET /api/guard/me/expected`. | Response contains `handoffs: { hostel: { enabled: false }, transport: { enabled: false } }`; hostel/transport DB never queried. |
| **T18** | Guard role blast radius | As `g1`, call `GET /api/students`, `GET /api/teachers`, `GET /api/hr/employees`. | 403 (role allowlist); guard's effective permissions = the exact `guard.*` set (`/api/me/permissions`). |
| **T19** | Incident attachments | Upload a valid PNG/PDF/JPEG (≤10 MB); then upload a text file / oversized file. | Valid → ClamAV scan + immutable blob stored; invalid type/size → 422; delete soft-archives the row, blob retained. |
| **T20** | Emergency ack idempotency | Same guard acknowledges the same activation twice (two calls / re-POST). | **One** `guardEmergencyAcknowledgements` row (unique `activationId + acknowledgedById`). |

### Reproduction snippets

**T9/T10 — concurrent/replayed release (Node):**
```js
const body = {
  studentId: '<stu1-id>', authorizationId: '<auth-id>',
  method: 'manual', gateId: '<g1-id>',
  idempotencyKey: crypto.randomUUID(),
};
const cookie = '<guard-cookie>';
const hits = await Promise.all(Array.from({ length: 10 }, () =>
  fetch('http://localhost:3002/api/guard/pickups/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }),
  }).then(r => r.status),
));
// Assert: exactly one 201, nine 409/404, and SELECT count(*) FROM guard_release_events
// WHERE authorization_id = '<auth-id>'  ===  1
```

**T8 — replayed verify:** paste the same raw token twice into the scanner input. The first shows
`VERIFIED`, the second shows a `already_processed` marker and the scan log records two rows.

**T7 — replaced badge:** run the scanner against the OLD token after issuing a replacement via
`POST /api/identity-badges/<id>/replace`. Both scans of the old token must fail uniformly.

---

## C. API-level regression (curl)

```bash
BASE=http://localhost:3002
C='Cookie: <session-cookie>'   # g1 guard session

# me endpoints
curl -s "$BASE/api/guard/me/gate"     -H "$C"          # 200 { gate: {…} }
curl -s "$BASE/api/guard/me/shift"    -H "$C"          # 200 assignment+gate+shift
curl -s "$BASE/api/guard/me/expected" -H "$C" | jq '.data.handoffs'   # {"hostel":{"enabled":false},"transport":{"enabled":false}}

# enumeration guard (T15)
curl -s "$BASE/api/guard/students/search?q=ab" -H "$C"   # 422 SEARCH_TOO_SHORT
curl -s "$BASE/api/guard/visits?q=ab"           -H "$C"   # capped, empty ok

# cross-tenant (T5) — tenant B ids against tenant A cookie
curl -s -o /dev/null -w '%{http_code}' "$BASE/api/guard/students/<tenantB-stu>/pickups" -H "$C"  # 404

# role blast radius (T18)
curl -s -o /dev/null -w '%{http_code}' "$BASE/api/students"   -H "$C"  # 403
curl -s -o /dev/null -w '%{http_code}' "$BASE/api/teachers"   -H "$C"  # 403
curl -s -o /dev/null -w '%{http_code}' "$BASE/api/hr/employees" -H "$C" # 403
```

---

## D. Evidence & logging checks

1. After any scan/release/check-in/out, `SELECT * FROM guard_gate_scan_events ORDER BY scanned_at DESC` — rows include direction, result status, operator, gate — **never** a raw token or token hash.
2. After a release, `SELECT evidence FROM guard_release_events` — the JSON is an immutable snapshot `{ student, pickupPerson, method, direction: 'exit', gateId, releasedAt }` with **no credential secret**.
3. After a pass issuance, `SELECT token_hash FROM identity_badge_credentials` — only the HMAC hash, never the raw token; the raw token is returned once and never retrievable again.
4. `audit_log` rows exist for: create incident, incident action, guard release event, emergency activation, emergency acknowledgement, pass issuance, check-in, check-out.

## E. Sign-off checklist

### Verification evidence (recorded 2026-08-08)

**Automated, already green (headless):**

| Check | Command | Result |
|---|---|---|
| Fixture creator — two runs, references unchanged | `node scripts/create-guard-fixtures.mjs` ×2 + snapshot digests (atlas branch, non-fixture users/guardians/gates/shifts) | Both runs reuse the same `VERIFY-GUARD` branch UUID; `ATL` branch id `1c14b3ae-…` and all non-fixture digests **byte-identical before/after**; no non-fixture gates/shifts. Safe cleanup (`--cleanup`) removes only fixture-owned rows and deletes the fixture branch. |
| Static adversarial matrix | `node scripts/verify-guard-adversarial.mjs` | **6/6 PASS** (T14 forbidden-family keys, T14 credential secrets, T15 capped queries + min-length, T16 no browser-storage writes, T18 operational-role allowlist) |
| Live harness vs running dev server (tenant A, fixtures) | `node scripts/verify-guard-security.mjs` (GATE_ID / STUDENT_ID / AUTH_ID / GUARD_USER_ID via env) | **8/8 PASS** — T17 me/expected handoffs disabled 200, T15 short search 422, T18 blocked from `/api/students` / `/api/teachers` / `/api/hr/employees` (403×3), T9 replayed release (201 then replay=409, fresh=409, `guard_release_events` rows=1), T20 emergency ack idempotent (rows=1), T19 valid PNG 201 / text 422 |
| Harness without fixture env | `node scripts/verify-guard-security.mjs` (no GATE_ID / AUTH_ID / STUDENT_ID) | **exit 2** — suite skipped cleanly, no false pass |
| Route surface | `Get-ChildItem src/app/api/guard -Recurse -Filter route.ts` | exactly **35** `/api/guard/*` route files |
| Type-check | `npx tsc --noEmit` | exit 0, no guard errors |
| Production build | `npx next build` | exit 0; all **35** `/api/guard/*` route files compiled |

Fixture users for the live harness: guard `guard1@atlas.ma` / `Admin123!` (tenant A),
admin `y.elamrani@atlas.ma` / `Admin123!`, gate VG1 (branch VERIFY-GUARD), shift VGS1,
student STU-001, authorization window now±2 days, incident attachment PNG (1×1 px) vs text file.

> **Note on the build gate:** the shared worktree had in-flight edits by other agents while this
> verification ran. The first two `next build` attempts failed on transient type errors in
> unrelated modules (`inquiries-kanban-view.tsx`, then live-classrooms provider refactor) and on a
> stale `.next/dev` artifact; once those settled (and `.next` was clean), the final build passed
> exit 0. No guard/inventory change was involved in the transient failures.

**Pending manual (browser) execution — not claimed as done:**

- [ ] A1–A8 happy path all green (UI interactions, dialog flows, kiosk lock screen).
- [ ] T1–T13 reproduce via SQL state edits + browser (expired/future assignment, wrong gate,
  cross-tenant foreign ids, replayed/replaced badge, concurrent release, kiosk expiry, disabled device).
- [ ] T16 browser-storage check in DevTools after exercising every guard page.
- [ ] Remaining visual asserts in section C (curl) and section D (evidence/logging rows) reviewed by hand.

### Automated evidence checkboxes

- [x] `node scripts/create-guard-fixtures.mjs` run twice → same `VERIFY-GUARD` branch reused, `ATL` branch + all non-fixture rows unchanged (digest-identical); `--cleanup` removes only fixture-owned rows.
- [x] `node scripts/verify-guard-adversarial.mjs` → **6/6 PASS**.
- [x] `node scripts/verify-guard-security.mjs` → **8/8 PASS** against live fixtures (T17/T15/T18/T9/T20/T19).
- [x] `node scripts/verify-guard-security.mjs` (no fixture env) → **exit 2** (skipped, not a false pass).
- [x] exactly **35** `/api/guard/*` route files present.
- [x] `npx tsc --noEmit` → **exit 0**, no guard errors.
- [x] `npx next build` → **exit 0**; all 35 `/api/guard/*` routes compiled.

### Manual checkboxes (browser + SQL — execute in a live session)

- [ ] A1–A8 all green.
- [ ] T1–T13, T16 rows pass with **no** information leak beyond the expected response.
