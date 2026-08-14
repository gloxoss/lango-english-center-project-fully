# Payroll & Workforce Operations — Verification Evidence

Recorded 2026-08-09.

| Gate | Result |
|---|---|
| `npx tsc --noEmit --pretty false` | PASS, exit 0 |
| Workforce/payroll Vitest suites | PASS, 37/37 |
| `scripts/test-payroll-lifecycle.ts` | PASS, full lifecycle and clean teardown |
| Migration 0094 verifier | PASS, 35/35 |
| Migration 0099 verifier | PASS |
| Payroll/Workforce tenant isolation | PASS, zero owned findings |
| Isolated production Docker build | PASS, `DOCKER_BUILD_EXIT=0` |

The repository-wide isolation script still exits 1 for four Guard routes and one Leadership route. These are outside Payroll and Accounting ownership.

The DB-backed suite confirms input freezing, calculation versioning, deterministic traces, exact gross/net results, maker/checker separation, immutability after approval, missing-mapping blocking, exception queueing, balanced posting, issued payslips, double-post rejection, paid/closed transitions, and reversal.

## Part 4 browser-surface evidence

- Operational pages use server-side capability guards.
- Payroll APIs enforce the Workforce add-on dependency, granular capabilities, and session-derived tenant IDs.
- Run controls invoke the verified lifecycle service; no browser-only lifecycle mutation remains.
- Leave, advances, and awards no longer import static fixture arrays.
- Payment approval rejects its preparer and reconciliation updates allocations under a transaction lock.

Authenticated visual/interaction evidence remains pending in `MANUAL-TESTING.md`; Arabic/RTL and external-format certification are not claimed by static checks.
