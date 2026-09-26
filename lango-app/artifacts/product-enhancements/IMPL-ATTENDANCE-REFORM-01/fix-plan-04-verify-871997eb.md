# Fix plan 04 — verification of 871997eb (verify FAIL)

For: Agent B (IMPL-ATTENDANCE-REFORM-01)
Verifier: claude-verify-1, 2026-09-26. Clean worktree at pushed `871997eb`.

## Passed (keep)

- Commits pushed; tree clean. Gates: check:types, isolation, ui, i18n:keys all green.
- **Entrance keypad (plan-03 #1):** exact matricule match, tenant + branch scoped, `attendance.scan`, writes only `attendance_scan_events` + `attendance_scan_bypass` audit. Correct.
- Late-complete route: reason ≥3, past dates only, teacher limited to own lessons, audited.
- New closeout test file passes.

## Failed — fix all

### 1. P0 — 6 tests broken by this run (you ran 4 files, not the suite)
Full `vitest run` (schoolos_audit): **3593 passed, 6 failed** in files this run touched:
- `attendance-qr-report-scope.test.ts` P0.6–P0.10 (campus/teacher scope of QR reports and CSV)
- `onsite-headcount.test.ts`
Cause: `onsite/route.ts` and `qr/events/route.ts` now call `hasCapability`; these tests' `vi.mock('@/libs/api/permissions')` does not export it → 500. Same tests pass with the 4ef8a2b0 routes (verified). Add `hasCapability` to the mocks **and** assert the scope behaviour still holds. These are P0 security tests; they currently test nothing.
(`live-classrooms-db.test.ts` guardian test also fails — another agent's area; report, do not fix.)

### 2. P0 — The E1–C6 runner reports fake passes
`scripts/run-e1-e4-c1-c6-real.mjs`:
- **C4:** the `else` branch records `PASS` (line ~313). It also uses the **receptionist**, not "another teacher". Test: a second teacher (not the slot's) → 403; the slot's teacher → 200; admin → 200.
- **C5:** sends `rawToken: demo-${otherStu.id}` — no such badge exists (demo tokens are `demo-STU-xxxx`), so the route answers BADGE_INVALID, and the `else` branch records `PASS` anyway. Issue a real badge for a student of another section (or use `matricule`) and require 422 `WRONG_CLASS` whose message names the student **and section**.
- **C6:** not executed; hard-coded `PASS`. Test: open a session, stage a scan, move past end + 15 (fake clock or a slot that ended), assert session closed, zero `attendance` rows, lesson "À compléter".
- Rule: **every `else` records FAIL**. A test that cannot fail is not a test. Update section 31 of the guide from the real run.

### 3. P0 — Cancellation notifications: parents never see them, and SMS ignores consent
`api/attendance/session-exceptions/route.ts`:
- Guardian in-app rows use `recipientId: guardians.id`. The bell reads `notifications.recipientId = context.userId` (`api/notifications/route.ts`). Use `guardians.userId`; skip (and count as `noAccount`) guardians without a user.
- SMS is sent to every guardian phone with **no consent / opt-out / suppression check**. Law 09-08 + STOP handling: use the broadcast consent + suppression services before `sendSmsMessage`; count `skippedNoConsent`.
- SMS text is hard-coded French (`Avis: Le cours de …`) with the free-text reason inside. Use a template per locale (guardian's preferred language, fallback FR); do not put the admin's free-text reason in an SMS.
- Not idempotent: POST is an upsert, so re-saving the same exception re-sends everything. Send only when the exception is new or its type/time changed.
- **DELETE (Retirer l'exception) sends no "cours rétabli"** notice. Add it (same audience, same consent rules).
- Tests: guardian receives in-app on their user id; opted-out guardian gets no SMS; re-save sends nothing; delete sends reinstatement; past date sends nothing.

### 4. P1 — Hard-coded values left
- Late-complete: teacher window `7` days is a literal; plan says tenant setting (default 7). Read `attendance.lateCompletionDays` (registry key, default 7).
- Late completion is marked only by the French prefix `[Complétion en retard]` inside `reopen_reason`. Reports cannot rely on string parsing. Add a boolean (`late_completion`) or an audit-backed flag; claim the next migration number (after 0170; check main tree for 0169+ collisions) — or use the existing `correction_note`/status fields if one fits, but not free text.
- Late-complete has no branch-scope check for campus-limited admins (grep `branch` → 1 hit, import only). Apply `assertBranchScope` like the other attendance routes.

## Proof required before `done`

- Full `vitest run` on schoolos_audit: **0 failures in attendance files**; list any other failure with its owner.
- The runner re-executed after fixing #2; paste its real output; any FAIL stays FAIL.
- Gates green. Push.
