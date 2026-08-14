# Hostel Management — Audit Response (2026-08-08)

Response to the independent audit that blocked the merge. All 12 findings are
fixed, and every fix is proven by a real, DB-backed automated test suite plus a
migration idempotency script — a written checklist alone is not verification.

**Evidence bundle**
- `src/features/hostel/__tests__/hostel-audit.test.ts` — **16/16 passing** against the live PostgreSQL (seeded two real tenants, never mocks). Run: `DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos npx vitest run src/features/hostel/__tests__/hostel-audit.test.ts`
- `scripts/verify-hostel-0076.mjs` — applies `migrations/0076_hostel_management.sql` twice; PRE 16/16 tables, 12/12 constraints, `btree_gist` 1 row, both enums; PASS 1 OK; PASS 2 OK (idempotent, never drops constraints).
- `npx tsc --noEmit` — **0 errors under `src/features/hostel/**`**. (3 pre-existing errors remain under `src/features/inventory/services/sales-service.ts`, parallel-agent scope — unrelated to hostel.)

| # | Verdict | Fix | Where | Verified by |
|---|---|---|---|---|
| 1 | Transfer invariant Broken | `evaluateBedEligibility` accepts `excludeAllocationId`; both bed- and student-overlap queries exclude the source; `transferAllocation` passes `source.id` and locks the source row `.for('update')`, re-validating state under the lock | `services/eligibility-service.ts`, `services/allocation-service.ts` | test 1 (transfer succeeds), test 2 (occupied target → 409 TRANSFER_BLOCKED, source unchanged) |
| 2 | Checkout idempotency Broken | Atomic conditional claim: `UPDATE ... SET checked_out WHERE state='checked_in' RETURNING` inside a tx; only the winner posts Finance *after* the claim; event written in the same tx; loser reloads and returns idempotently | `services/allocation-service.ts` (`checkOutAllocation`) | tests 3 & 4 (double and concurrent checkout → exactly 1 `checked_out` event + 1 charge link) |
| 3 | Bulk cross-tenant protection Broken | `getStudentContext(tenantId, studentId)` inside the batch tx before each insert — cross-tenant/unknown student throws 422 and aborts the whole batch | `services/allocation-service.ts` (`bulkCommitAllocations`) | test 5 (tenant-B student → 422 STUDENT_NOT_FOUND, zero rows) |
| 4 | Application not bound to student | `commitAllocation` rejects `application.studentId !== studentId` (422 APPLICATION_STUDENT_MISMATCH) and any window outside `requestedStart/End` (422 APPLICATION_DATE_MISMATCH) | `services/allocation-service.ts` | tests 6 & 7 |
| 5 | Lifecycle writes not atomic | Insert + event, check-in/out/cancel all moved inside `db.transaction`; state changes are conditional claims with `RETURNING` so only one concurrent caller wins | `services/allocation-service.ts` | tests 1–4, 13, 14 |
| 6 | Same-day checkout violates CHECK | End date computed via SQL `CASE WHEN effective_start_date < today THEN today ELSE start + 1 END`; **plus** (found by the suite) transfer source closure is now same-day-safe too | `services/allocation-service.ts` | test 8; tests 1 & 2 |
| 7 | Foreign refs unvalidated | `validateApplicationReferences` tenant-checks `sessionYearId` (sessionYears), `preferredRoomId` (hostelRooms), `preferredCategoryIds` (hostelRoomCategories, deduped) → 422 INVALID_* | `services/allocation-service.ts` (called by `createApplication`/`updateApplication`) | tests 9 (per-field) |
| 8 | Projections leak leave details | `listLeavePassesForSelf` allowlisted to destination/status/dates — never `reason`, never `createdById`; both projections now use it | `services/leave-passes-service.ts`, `services/projections-service.ts` | test 10 |
| 9 | Invoice-number race | Tenant-scoped prefix + single atomic `INSERT ... ON CONFLICT (prefix) DO UPDATE SET current_val = current_val + 1 RETURNING` — no read-modify-write | `server/finance-adapter.ts` (`reserveInvoiceNumber`) | test 11 (two concurrent `emitCharge` → distinct invoice ids + numbers) |
| 10 | Leave-approval race | Whole decision inside a tx with the pass row locked `.for('update')`; loser re-reads non-pending state → 409 ALREADY_DECIDED; return is idempotent via `(tenant, leave_pass)` unique + conditional state flip | `services/leave-passes-service.ts` | test 12 (exactly 1 approval row, one rejection); T12 return-idempotency note |
| 11 | Migration DROP+ADD unsafe | All 12 constraint blocks rewritten as catalog-existence-check `DO` blocks (`pg_constraint WHERE conname = ... AND conrelid = ...::regclass`) — **no `DROP CONSTRAINT` remains**; FK/enum blocks keep `WHEN duplicate_object THEN null` | `migrations/0076_hostel_management.sql` | `verify-hostel-0076.mjs` double-apply: idempotent, constraints never dropped |
| 12 | "Every route has capability checks" inaccurate | **Correction:** 42 route files exist; 39 use `requireCapability`; the 3 self-service routes (`resident/me`, `resident/me/leave-requests`, `guardian/me`) gate by **role allowlist + identity match** (`context.role !== 'student'`/`'parent'`), because student/parent roles hold no `hostel.*` capabilities. `EXECUTION-PLAN.md` §9.1 already documents this accurately; the overclaim was in the session narrative, not the plan | routes verified by grep | §9.1 line 461 |

**Additional hardening surfaced by the new suite:** transfer of a same-day arrival
closes the source at `start+1` (not `start`), mirroring check-out's same-day rule, so
the `effective_end_date > effective_start_date` CHECK can never fire during a transfer
(`services/allocation-service.ts`).

**Remaining pre-existing errors (not introduced, not in scope):** 3 in
`src/features/inventory/services/sales-service.ts` (TS2532/TS2769), owned by a parallel
agent; zero hostel-scope errors.
