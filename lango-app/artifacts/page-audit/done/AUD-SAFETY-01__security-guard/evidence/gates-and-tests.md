# AUD-SAFETY-01 — Static gates, tests and fixture notes

Worktree `C:\Users\OMEN\AppData\Local\Temp\opencode\agentb-safety`, branch
`audit/agent-b/AUD-SAFETY-01`, target base `f42c2bc`.

## Static gates

| Gate | Result |
|---|---|
| `npm run check:types` | PASS |
| `npm run check:isolation` | PASS — 828 files, zero warnings in touched files |
| `npm run check:i18n` | PASS — no missing keys, no invalid translations |
| `node scripts/check-missing-i18n-keys.mjs` | PASS — 0 in 0 files |
| `npm run check:ui` | PASS — ratchet holding (38/39 dead controls, 0 mock, 28/28 unlinked, 7/7 orphaned) |
| ESLint touched | PASS — new files clean; `gates-service` back to its baseline 30 style errors; `kiosk-service` 13 / `credential-adapter` 26 / `visitors-service` 17 / `home-service` 6 (all unchanged from baseline); `today.ts` clean |

## Focused tests

```
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/guard-safety-scope.test.ts
→ 11/11 PASS
```

`guard-safety-scope.test.ts` (DB-backed, real context pipeline with a session
mock) covers:

1. `normalizeGateDirection` legacy mapping (unit);
2. Casablanca day bounds + wall-clock→UTC conversion (unit, asserted instants);
3. entry scan accepted on a gate stored with the legacy `in` direction;
4. replayed scan deduplicated by idempotency key (`already_processed`);
5. visitor check-in at another tenant's gate refused `403 GATE_INVALID`;
6. **S-08:** same-branch check-in + replay + check-out, branch persisted;
7. **S-08:** foreign-branch gate refused `403 BRANCH_MISMATCH`, status unchanged;
8. **S-08:** foreign-branch visit refused on check-in, status unchanged;
9. **S-08:** tenant-wide actor (no branch) operates across branches (documented
   model);
10. guard home is branch-scoped (own + tenant-wide invitations only) and still
    returns the assignment's gate/shift;
11. emergency activation is leadership-only (guard 403, admin 201).

Related suites re-run (all pass):

```
guard-safety-scope + release-live-link + onsite-headcount + guardians-domain
+ security + role-response-shape → 6 files, 57/57 PASS
(student-360-hardening included in the pre-correction run: 77/77)
```

## Audit-DB fixture correction (test data only, documented)

Applied once to `schoolos_audit` so the running environment matches the
canonical schema and the product's own rules:

```sql
UPDATE guard_gates             SET direction = entry|exit WHERE direction IN ('in','out');   -- 2 rows
UPDATE guard_gate_scan_events  SET direction = entry|exit WHERE direction IN ('in','out');   -- 15 rows
UPDATE guard_incidents         SET category  = acces|autre|securite WHERE category NOT IN (...); -- 3 rows
UPDATE guardian_students       SET can_pickup=true, has_pickup_authority=true                -- 8 links
  WHERE (student_id, guardian_id) IN (SELECT student_id, pickup_person_id FROM guard_pickup_authorizations);
UPDATE guard_pickup_authorizations SET status='consumed', consumed_at=now()                  -- 5 rows
  WHERE EXISTS (SELECT 1 FROM guard_release_events WHERE authorization_id = id);
```

Probe artifacts left in the audit DB on purpose as evidence: the foreign-tenant
gate row (`Foreign Tenant Gate`) and the pre-fix contaminated visit
`8c3d1b5a-d055-4a6c-bde5-443987d9b498` (visit + scan evidence referencing it).

S-08 correction fixture: the guard was temporarily pinned to Siège
(`e83e2915…`) for the HTTP probe, then restored to `branch_id = NULL`; the BR-2
probe gate was created and archived through the product API
(`is_active = false`). The two probe visits (same-branch `0206c7b5…`,
foreign-branch `117dab5d…`) remain as evidence — see
`evidence/branch-boundary-s08.md`.

## Full suite

Not re-run here: the shared `schoolos_audit` DB currently holds other agents'
concurrent test residue (the finance-suite failures documented by
AUD-TEACHER-01/AUD-RECEPTION-01). The focused suites cover every file this
campaign touched.
