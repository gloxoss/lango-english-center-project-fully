# Attendance QR Enhancement — Implementation Plan

> Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST — route/schema/permission/UI conventions are not repeated here. This plan is a handoff document for an executing agent: it states what to build, why, and where, not a fill-in-the-blanks tutorial.

## 0. Critical correction to the source spec — read this before anything else

`ATTENDANCE-QR-ENHANCEMENT-PLAN.md` (source doc, same folder) was written assuming the current QR handler is a weak, unverified system ("accepts a student ID or even a partial name... no revocable credential, no server verification, scanner session, immutable scan evidence"). **This is now false.** A real, credential-based system already exists:

- `src/features/attendance/models/attendance-qr-schema.ts` — real tables: `identityBadgeCredentials`, `scannerDevices`, `scannerSessions`, `attendanceScanEvents`, `workforcePunchEvents`.
- `POST /api/attendance/qr/verify-and-stage` (`src/app/api/attendance/qr/verify-and-stage/route.ts`) — HMAC-hashes the raw scanned token, looks up `identityBadgeCredentials` by `(tenantId, tokenHash)` (never by name/ID), checks `status === 'active'`, re-resolves the user tenant-scoped, logs an `attendanceScanEvents` row. This is genuinely solid, not the naive system described.
- `identity-badges` CRUD (`src/app/api/identity-badges/route.ts` GET/POST, `[id]/route.ts` DELETE) and a real, fetch-driven management UI (`src/features/attendance/ui/badge-management-view.tsx`, page at `/dashboard/attendance/badges`) — issue, list, revoke (via DELETE) already work.
- A real, fetch-driven scanner kiosk (`src/features/attendance/ui/attendance-scanner-kiosk.tsx`, page at `/dashboard/attendance/scanner`) that actually calls the real API.
- A real, fetch-driven QR events/reports view (`src/features/attendance/ui/qr-reports-view.tsx`, page at `/dashboard/attendance/qr-reports`) reading `GET /api/attendance/qr/events`.

**Also confirmed: two entirely fake, dead UI files exist alongside the real ones** — `src/features/attendance/ui/qr-kiosk-view.tsx` and `qr-scanner-modal.tsx` (page at `/dashboard/attendance/QR-kiosk`, note the different casing from the real `/scanner` route). Both are pure client mocks: hardcoded seed data, `setTimeout`-simulated results, **zero `fetch` calls**. This is dead, confusing, decoy code sitting in the sidebar next to the real page. Section 1 below removes it.

**The one real, load-bearing gap, confirmed by reading `verify-and-stage` line by line:** the route accepts `classSectionId` and `sessionId` in its request body but **never uses `classSectionId` for anything** — no roster/enrollment check. It also **never writes to the `attendance` table at all** — despite being named "verify-and-stage," it only records a scan *event*, never actually creates or updates an attendance record. The scanner kiosk calls this one endpoint and nothing else, so today a successful scan produces zero visible effect on any student's attendance. This is the actual product gap, not "build a security system from scratch" — the security system is done; the last mile to a real attendance mark is missing. Section 3 is the priority fix.

## 1. Current-state audit — what to do with what already exists

| Piece | State | Action |
|---|---|---|
| `identityBadgeCredentials`, HMAC verify | Real, solid | Keep as-is |
| `scannerDevices`, `scannerSessions` tables | Schema exists, **zero API routes, zero UI** | Build routes + Settings page (Section 4) |
| `attendanceScanEvents` | Real, but no idempotency/duplicate check | Harden (Section 3) |
| `identity-badges` CRUD | Real but partial: GET/POST/DELETE only — no PATCH/replace, no bulk-issue, no expiry field visible in schema (verify) | Extend (Section 5) |
| `badge-management-view.tsx` | Real, fetch-driven | Keep, extend for replace/bulk once routes exist |
| `attendance-scanner-kiosk.tsx` + `verify-and-stage` | Real plumbing, but produces no attendance record and ignores `classSectionId` | Fix (Section 3) — highest priority |
| `qr-kiosk-view.tsx`, `qr-scanner-modal.tsx`, `/dashboard/attendance/QR-kiosk` page | **Fake, dead, decoy** | Delete (Section 1) |
| `qr-reports-view.tsx` / `/qr-reports` | Real, fetch-driven | Extend filters if the source spec's "QR audit" filter set (device, operator, rejection reason) isn't fully covered yet — verify at execution time |
| `workforcePunchEvents` table | Schema stub only, no siblings (`workforceClockLocations`/`workforceWorkSessions`/`workforceExceptions`/`workforceCorrections` don't exist), no routes, no UI | Out of scope for this plan — see Section 7 |

## 2. Scope decision for this plan

Build Phase A (harden, minus what's already done) + the real device/session layer (parts of Phase B/C the audit shows are missing) + reporting completeness (Phase D). **Defer the Workforce/Payroll add-on (Phase E) and offline/rotating-code modes (Phase F) as a separate future plan** — they're genuinely distinct domains per the source spec itself ("Employee QR timekeeping is a distinct Payroll/Workforce add-on"), and building them now would be starting a second, unrelated large feature disguised as "finishing" this one. This matches the scope-sizing discipline in the shared reference doc.

## 3. Section 1 — Remove the fake decoy UI

Delete `src/features/attendance/ui/qr-kiosk-view.tsx`, `src/features/attendance/ui/qr-scanner-modal.tsx`, and `src/app/[locale]/(dashboard)/dashboard/attendance/QR-kiosk/page.tsx`. Grep for any remaining import of these three files (likely the sidebar or `attendance-page.tsx`'s tab list) and remove the reference/nav entry. Confirm via `tsc --noEmit` that nothing else imports them. Do not attempt to "upgrade" the fake files into real ones — the real scanner kiosk already exists at `/scanner`; this is deletion, not a merge.

## 4. Section 2 — Real roster/enrollment validation + real attendance staging (the priority fix)

This is the one change that turns "the scan logs an event" into "the scan actually marks attendance."

1. In `verify-and-stage`, once the badge and `scannedUser` resolve: require `body.sessionId` (a real, active `scannerSessions` row — see Section 4, this becomes a hard dependency once sessions exist; until Section 4 ships, accept `classSectionId` directly as today's schema allows, but validate it).
2. Resolve the scanned student's real class-section (same `user.classSectionId` → `classSections` lookup pattern already used in `resolveStudentAudienceContext`, `src/libs/academics/audience-context.ts` — reuse it, don't re-derive). Reject with a new `rejectionReason: 'WRONG_CLASS'` (stored on the `attendanceScanEvents` row, `resultStatus: 'rejected'`) if the scanned student's class-section doesn't match `body.classSectionId`/the session's `classSectionId`.
3. Compute `stagedStatus` for real instead of hardcoding `'present'`: read a lateness grace-period setting (new: a simple tenant/school setting, e.g. `schoolSettings.attendanceLateGraceMinutes` — check `src/app/api/settings/route.ts`'s existing schema-settings shape and extend it rather than inventing a new settings table) and compare against the register's period start time. Before threshold → `present`; after → `late`.
4. Actually write the staged record: look at how `POST /api/attendance/route.ts` inserts into `attendance` (`src/app/api/attendance/route.ts:98-130`) and either call the same underlying logic (extract it to a small shared function both routes call, matching this session's established "extract, don't duplicate" discipline) or issue the equivalent tenant-scoped upsert directly from `verify-and-stage` — insert/update an `attendance` row for `(registerId or classId+date+period, studentId)` with `status: stagedStatus`, `markedById: context.userId`, and a reference back to the `attendanceScanEvents.id` that produced it (add a nullable `scanEventId` column to `attendance` via a new migration if one doesn't already exist — check first).
5. Idempotency: before inserting a new scan event, check for an existing non-rejected `attendanceScanEvents` row with the same `credentialId` + `sessionId` (or `classSectionId`+date if no session yet) within the current register's open window. If found, return `resultStatus: 'already_scanned'` (new value, not `accepted`/`rejected`) and do not write a second attendance row — matches the source spec's explicit `already_scanned` requirement.
6. Locked-register check: if the target register (`attendanceRegisters`, `Schema.ts:1128-1168`) has `status: 'LOCKED'` (and isn't within a `REOPENED` window), record `rejectionReason: 'REGISTER_LOCKED'` and do not mutate — per the source spec's `register_locked` requirement.
7. Fix `await recordAudit(...)` (line 103) → drop the `await`, matching the established fire-and-forget convention everywhere else in this codebase (small, but a real inconsistency).

## 5. Section 3 — Scanner devices & sessions (wire the dormant schema to real routes + UI)

`scannerDevices`/`scannerSessions` tables exist with genuinely useful columns already (`scannerSessions.classSectionId` in particular — the schema already anticipated exactly the roster-scoping Section 2 needs). Build:

- `POST /api/scanner-devices/pair` — registers a new device (generates `secretKey`, returns it once), `PATCH /api/scanner-devices/[id]` — rename/disable, `GET /api/scanner-devices` — list, tenant/branch-scoped.
- `POST /api/attendance/qr/scanner-sessions` — start a session (device optional for a teacher's own phone, `classSectionId`, `operatorId: context.userId`), `POST /api/attendance/qr/scanner-sessions/[id]/close` — end it, `GET /api/attendance/qr/scanner-sessions/[id]/events` — the accepted/rejected/duplicate feed for that session (this may already be partially covered by the existing `GET /api/attendance/qr/events` — check for overlap before building a second endpoint that does the same thing differently).
- UI: `/dashboard/settings/scanner-devices` (pair/name/scope/disable/last-seen table — matches the source spec's "Settings → Scanner devices" placement) and update the scanner kiosk page to open a real session on mount and close it on unmount/navigate-away, showing live accepted/rejected counters during the session (the source spec's "Register → Scan QR" live feed requirement).

## 6. Section 4 — Badge lifecycle completeness

Confirm at execution time exactly what `identity-badges` currently supports (GET/POST/DELETE confirmed; PATCH/replace/bulk-issue/expiry not confirmed present). Fill genuine gaps only:
- `POST /api/identity-badges/[id]/replace` if it doesn't exist — creates a new credential, marks the old `replaced`, links them (matches the `status` enum implied by `badge.status` checks already in `verify-and-stage`: confirm the full enum, likely `active`/`revoked`/`expired`/`replaced`).
- `POST /api/identity-badges/bulk-issue` if missing — same idempotent-retry discipline as attachments-book's generation jobs (unique constraint per intended issuance, not per HTTP attempt).
- Credential history/events: check whether badge issue/print/revoke/replace events are recorded anywhere (`recordAudit` calls may already cover this generically — verify before adding a dedicated `identityBadgeEvents` table the source spec proposes; don't build a parallel history mechanism if the generic audit log already captures it adequately for this use case).

## 7. Section 5 — QR audit reporting completeness

Read `qr-reports-view.tsx` and `GET /api/attendance/qr/events` fully at execution time. Compare against the source spec's filter list (date, class, person, device, operator, outcome, rejection reason) and CSV/PDF export requirement. Add only what's missing — this view already exists and is real, so this section is a gap-fill, not a new build. For export, reuse the existing `pdfkit` server-PDF pattern (`src/addons/advanced-reporting/services/exporters/pdf-exporter.ts`) for PDF and a simple CSV stringify for CSV — do not introduce `jspdf`/`html2canvas` (installed but unused everywhere else in this app; don't be the first page to use them when a real server-PDF pattern already exists).

## 8. Out of scope for this plan (documented, not silently dropped)

- Workforce/Payroll add-on (Phase E) — separate future plan, needs `workforceClockLocations`/`workforceWorkSessions`/`workforceExceptions`/`workforceCorrections` (only `workforcePunchEvents` exists today as a bare stub) plus its own kiosk UI, correction/approval workflow, and payroll export. Real scope, deserves its own plan document.
- Offline scanning, rotating self-scan codes, geofencing (Phase F) — explicitly "later phases" per the source spec; no current infra gap analysis needed yet.

## 9. Acceptance checklist (live-verify all of these, matching this session's established discipline — no self-reported "done")

- [ ] Fake decoy UI fully removed, `tsc --noEmit` clean, no dangling imports.
- [ ] A real scan against a real active badge, correct class-section, before the grace threshold → real `attendance` row created with `status: 'present'`, visible in the normal attendance register UI, not just in `attendanceScanEvents`.
- [ ] Same scan repeated immediately → `already_scanned`, no second attendance row, no duplicate scan-event side effects.
- [ ] Scan against a badge whose real class-section doesn't match the session's `classSectionId` → rejected `WRONG_CLASS`, no attendance row.
- [ ] Scan against a locked register → rejected `REGISTER_LOCKED`, register genuinely untouched.
- [ ] Revoked/expired badge → rejected with the correct existing status-based reason (already implemented — regression-check it still works after the Section 2 changes).
- [ ] Cross-tenant sweep: a badge credential from tenant A cannot be resolved/used from tenant B (already should be true via `tenantId` scoping — verify live, not just by code review).
- [ ] Scanner device pairing → session start → scan → session close, full lifecycle, real HTTP, real DB rows at every step.
- [ ] `check-tenant-isolation.ts` shows no new flagged files beyond the existing baseline 3.
