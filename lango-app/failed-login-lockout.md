# Failed Login Lockout Tracking Implementation Plan

## Goal
Add explicit `failedLoginCount`, `lockedUntil`, and `mustChangePassword` schema definitions to the Drizzle `user` model, ensure Better Auth middleware correctly records failed login attempts and enforces lockout, and verify via unit tests.

## Tasks
- [x] Task 1: Update `user` table in `src/models/Schema.ts` with `failedLoginCount`, `lockedUntil`, and `mustChangePassword` → Verify: `npx tsc --noEmit` passes cleanly.
- [x] Task 2: Make strike counting and threshold locking atomic, normalize email matching, reset expired locks to a fresh strike window, and parse offset-less PostgreSQL timestamps consistently as UTC → Verify: live PostgreSQL integration tests pass.
- [x] Task 3: Add hook and database tests covering rejection, failure recording, successful reset, fifth-strike lock, expiration, concurrent failures, case normalization, and unknown email handling → Verify: 14/14 targeted tests pass.
- [x] Task 4: Run the full project suite with live PostgreSQL and TypeScript compilation → Verify: 178/178 tests and `npx tsc --noEmit` pass.
- [x] Task 5: Register and apply migration `0037_add_student_placements`, discovered while enabling the database-backed security gate → Verify: 38 migration ledger entries and the full tenant-isolation suite passes.

## Done When
- [x] Drizzle ORM `user` model explicitly includes `failedLoginCount`, `lockedUntil`, and `mustChangePassword` matching SQL migration `0020`.
- [x] Lockout logic increments strikes on failed sign-in, locks account for 15 minutes after 5 failures, and clears count on successful sign-in.
- [x] Expired locks start a new five-attempt window instead of immediately relocking after one failure.
- [x] Automated Vitest suite passes 178/178 with live PostgreSQL, including 14/14 lockout tests.

## Verification evidence

- `npx vitest run src/libs/auth/lockout.test.ts` with `DATABASE_URL`: 14 passed, 0 failed, 0 skipped.
- `npx vitest run` with `DATABASE_URL`: 13 files passed; 178 tests passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed with zero errors.
- Docker PostgreSQL migration ledger: 38 applied entries; `failed_login_count`, `locked_until`, `must_change_password`, and `student_placements` are present.
