# S-08 — Branch boundary on visitor check-in/check-out: RULING + PROOF

## The rule (derived, not invented)

The platform has one authoritative branch model:

- `libs/api/context.ts` (lines 124-130): the branch scope is
  `activeCtx?.activeBranchId ?? principal.branchId ?? null`; a client-supplied
  `x-branch-id` / `?branchId=` is never honored, and *"user.branchId is the only
  branch this principal may reference"*.
- `features/portal/services/active-context.ts` (lines 139-171): a stored active
  branch is revalidated against `user.branchId` and cleared otherwise — there is
  no multi-assignment table, so a principal is either **pinned to exactly one
  branch** or **tenant-wide (branchId null)**.
- Branch-aware write precedent, `academics/classes` `resolveClassBranch`: a
  branch-pinned writer may only act on their own branch; a branch-null principal
  acts tenant-wide.
- Guard duty model: `guard_assignments.branchId` is NOT NULL and the kiosk path
  is bound to the assignment's gate/branch; `guard_visits.branchId` is stamped
  from the creator's context.

Therefore **guards are branch-scoped when the school pins them to a branch**
(`user.branchId`), and tenant-wide when it does not. Visitor check-in/out now
enforces exactly that at the service boundary (no reliance on UI filtering):

| Actor context | Gate | Visit | Result |
|---|---|---|---|
| branch-pinned A | branch A or tenant-wide (null) | branch A | ALLOWED |
| branch-pinned A | branch B (same tenant) | any | **403 BRANCH_MISMATCH** |
| branch-pinned A | any | branch B (or branch-less) | **403 BRANCH_MISMATCH** |
| tenant-wide (null) | any branch in tenant | any branch in tenant | ALLOWED (tenant-wide authority) |
| any | different tenant | — | **403 GATE_INVALID** (S-02) |

Implementation: `requireTenantGate` now returns the gate's `branchId`;
`assertGateBranch` / `assertVisitBranch` in `features/guard/services/
visitors-service.ts` apply the predicates to both `checkInVisit` and
`checkOutVisit` (visit check inside the `FOR UPDATE` transaction, before any
status transition).

## Runtime proof (schoolos_audit, HTTP, real sessions)

Guard `securite@atlas.ma` temporarily pinned to Siège (`e83e2915…`); the probe
gate in Annexe Maarif (`955beea2…`) created and archived through the product API.

```
PASS admin creates BR-2 probe gate                         (200)
PASS pinned guard creates visit (branch persisted)         (201)
PASS same-branch check-in allowed                          (200 replayed=false)
PASS check-in replay                                       (200 replayed=true)
PASS same-branch check-out allowed                         (200)
PASS foreign-branch gate refused                           (403 BRANCH_MISMATCH)
PASS foreign-tenant gate refused                           (403 GATE_INVALID)
PASS foreign-branch visit refused (check-in)               (403 BRANCH_MISMATCH)
PASS foreign-branch visit refused (check-out)              (403 BRANCH_MISMATCH)
PASS tenant-wide actor cross-branch allowed (documented)   (200)
PASS random visit id -> 404
PASS pinned guard me/gate unaffected (PORT-A, entry, branch=e83e2915…)
```

Persistence proof (DB):

```
same-branch visit 0206c7b5-…  branch=e83e2915… gate=8d04b43d…(PORT-A) checked_out
  check_in_by=USR-GUARD-001  check_out_by=USR-GUARD-001      -- branch preserved through check-out
foreign-branch visit 117dab5d-… branch=955beea2… gate=<BR-2 probe gate> checked_in
  (checked in by the tenant-wide admin, branch relationship preserved)
```

Fixture restored after the probe: guard branch back to NULL (seeded state), the
probe gate soft-archived through `DELETE /api/guard/gates/[id]`
(`is_active=false`). The probe visits remain as documented evidence.

## Automated regression coverage (`guard-safety-scope.test.ts`, 11/11)

1. normalize legacy gate directions (S-01)
2. Casablanca day bounds (S-04)
3. legacy-direction scan accepted (S-01)
4. scan replay deduplicated (S-03)
5. foreign-tenant gate refused (S-02)
6. **same-branch check-in + replay + check-out, branch persisted (S-08)**
7. **foreign-branch gate refused, status unchanged (S-08)**
8. **foreign-branch visit refused, status unchanged (S-08)**
9. **tenant-wide actor cross-branch allowed (S-08, documented model)**
10. branch-scoped home expected list (S-04)
11. emergency activation leadership-only
