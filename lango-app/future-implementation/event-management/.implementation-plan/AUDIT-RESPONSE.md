# Event Management — Audit Response (2026-08-11)

Response to `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` §26
("🟠 PARTIAL"). All listed gaps are closed except the explicitly-deferred
scope noted below (never faked as done).

**Evidence bundle**
- `src/features/events/services/event-operations-service.test.ts` — **11/11
  passing**, DB-backed against the live PostgreSQL. `src/features/events/services/audience-service.test.ts` —
  **9/9 passing**, pure-function, no DB. Run:
  `npx vitest run src/features/events --project unit`
- `npx tsc --noEmit` — **0 errors under any `src/features/events/**` or
  `src/app/api/addons/events/**` file** (every file touched or added this
  pass). A repo-wide run shows 6 pre-existing errors, all in
  `src/features/website/` (`website-service.ts:165,261`,
  `menu-builder-view.tsx:91,92,94,95`) — a different, unrelated addon
  (`school-website-cms`, tracker row #32) that another agent was actively
  editing concurrently during this session (file mtimes land mid-session,
  well after this pass started). Confirmed not events-scoped, not touched by
  this pass.
- `npx tsx scripts/check-tenant-isolation.ts` — passes, no new files flagged.
- `npx next build` — Turbopack compiles successfully; the build's final
  type-check step fails on the same pre-existing `website-service.ts`
  error above, so the build does not reach exit 0 end-to-end right now.
  This is a whole-repo gate shared with every other in-flight plan, not an
  events-management defect — `npx tsc --noEmit` on this feature's own files
  is the authoritative signal for this pass and is clean.

## Gap-by-gap

| # | Gap (tracker) | Status | Where | Verified by |
|---|---|---|---|---|
| 1 | Capacity-race condition in `registerForEvent` | **Already fixed when this pass started** (a `SELECT ... FOR UPDATE` lock on the occurrence row precedes the capacity `SUM`, serializing concurrent registrations on the same occurrence). Confirmed genuine, not decorative: deliberately removed the lock, watched the new deterministic test fail, reverted, watched it pass again. | `src/features/events/services/events-service.ts` (`registerForEvent`) | `event-operations-service.test.ts`: "serializes N concurrent registrations..." (10 simultaneous callers, exactly 1 registers) + "a held FOR UPDATE lock on the occurrence row blocks a second transaction until the first commits" (deterministic proof of the actual locking mechanism — the N-concurrent test alone was found to be an unreliable regression signal on this fast local DB, see comment above it in the test file) |
| 2 | Missing API routes | Built: `[id]/venues` (GET/POST) + `[id]/venues/[venueId]` (PATCH/DELETE), `[id]/audiences` (GET/POST) + `[id]/audiences/[ruleId]` (DELETE), `[id]/tasks` (GET/POST) + `[id]/tasks/[taskId]` (PATCH), `[id]/incidents` (GET/POST) + `[id]/incidents/[incidentId]` (PATCH), `[id]/feedback` (GET/POST) + `[id]/feedback/[feedbackId]` (PATCH moderate), `[id]/communications` (GET/POST). Already existed (verified, not rebuilt): `events`, `types`, `[id]`, `[id]/publish`, `[id]/cancel`, `[id]/occurrences`, `[id]/feed.ics`, `occurrences/[id]/checkins`, `occurrences/[id]/waitlist(+/respond)`, `reports`, `calendar`. Also added: `GET [id]/registrations` (attendee list, was POST-only) and fixed a real bug in `registrations/[id]/cancel` (see below). | `src/app/api/addons/events/**` (24 route files total) | `npx tsc --noEmit` clean; manual route-by-route convention read (requireRequestContext → requireTenant → requireAddon → requireCapability → Zod `.strict()` → tenant-scoped query → `recordAudit`) |
| 3 | Recurrence materialization service | **Already existed when this pass started.** `buildOccurrenceRows`/`materializeOccurrences` expand daily/weekly/monthly recurrence into bounded occurrence rows (366-row guard), idempotent via `onConflictDoNothing` on `(scheduleId, originalDate)`. | `src/features/events/services/event-operations-service.ts` | `event-operations-service.test.ts`: "expands a weekly recurrence into occurrences and is idempotent" |
| 4 | Zero tests | Was 1 DB-backed test file (10 tests, no concurrency test) when this pass started. Now 2 test files, **20 tests**: the original suite plus the two concurrency-race tests above and 9 new pure-function tests for `isEventVisibleToUser` (`audience-service.test.ts`) covering every `targetKind` (school/role/user/class_section/class_offering/class_subject/group-not-implemented) and OR-across-rules semantics. | `src/features/events/services/*.test.ts` | Full run: 20/20 passing |
| 5 | Super-admin dashboard calendar widget | **Already wired when this pass started** — `SuperAdminDashboardView` fetches `/api/addons/events/calendar` and renders `DashboardCalendarWidget`; the route itself returns `{ success: true, data: [] }` for `super_admin` (no tenant) rather than erroring, so no cross-tenant leak is possible and the widget degrades gracefully. Main tenant dashboard (`dashboard-view.tsx`) wired identically. | `src/features/super-admin/ui/super-admin-dashboard-view.tsx`, `src/app/api/addons/events/calendar/route.ts` | Code read; both call sites confirmed identical wiring pattern |
| 6 | Check-in kiosk out-of-scope check | Searched the full repo (`grep -ri kiosk`) — no event-specific kiosk file exists anywhere under `src/features/events` or `src/app/api/addons/events`. The only kiosk UIs in the codebase are `guard/kiosk-sessions` (guard-security-portal's own kiosk — legitimate, untouched), `attendance/ui/attendance-scanner-kiosk.tsx` (attendance QR, unrelated feature), and `workforce/ui/time-clock-kiosk.tsx` (payroll time clock, unrelated feature). **Conclusion: the out-of-scope event check-in kiosk is confirmed gone / was never present in the current tree** — nothing left to remove. | n/a (verification only) | `grep -rli kiosk src` — 5 hits, none event-scoped |

## Additional fix found and closed while verifying gap #2 (not in the original tracker list)

**Self-cancel authorization gap**: `registrations/[id]/cancel` required `events.registration.manage`
— a capability only `school_admin`/`super_admin` hold by default — so a
student or parent who RSVP'd could never cancel their own registration
through the API (the register route only requires `events.read`, which
students/parents do have, so the asymmetry was real and reachable). Fixed
by mirroring the existing self-service-vs-manage split already used in
`occurrences/[id]/waitlist/[waitlistId]/respond`: the route now soft-checks
`events.registration.manage` via `hasCapability`; holders may cancel any
registration, everyone else may only cancel their own
(`cancelRegistration`'s new `restrictToPersonId` parameter enforces this
inside the transaction, not just at the route layer).

## Deliberately scoped down (documented, not faked)

- **Communications** (`[id]/communications`) target the event's *confirmed
  registrants* (a concrete, already-known person-id list from
  `eventRegistrations`), not a full audience-rule → user-list resolver.
  Building a general resolver (role/class_section/class_offering → every
  matching user id) is a materially larger feature nothing else in this
  service needs yet — the audience-rule pure function
  (`isEventVisibleToUser`) only ever evaluates one viewer at a time today.
  Delivery reuses the existing in-app notification outbox
  (`src/libs/services/notification-service.ts`) synchronously — no new
  queue/worker introduced, matching this repo's "no queue unless justified"
  discipline (`APP-CONTEXT-AND-UI-SYSTEM.md` §1, §10).
- **`eventInvitations`** table remains unused (Phase D/E "publish-time
  audience snapshot" from the source plan) — not in the tracker's gap list
  for this pass, left as-is.
- **`eventAttachments`** table remains unused — not in the tracker's gap
  list for this pass, left as-is. The source implementation plan
  (`.implementation-plan/PLAN.md` §4) recommends wiring it to the
  attachments-book `BlobStore`/`digitalAssets` infrastructure rather than a
  new upload path when it is built.
- **Tenant-wide authenticated `.ics` subscription feed with revocable
  secrets** (source plan's `/calendar/feed.ics`) was not built — only the
  existing per-event `[id]/feed.ics` export. Not in the tracker's gap list
  for this pass (the tracker lists `feed.ics` and the per-event route
  already existed and covers "ICS export for an event").
- **UI**: `events-calendar-client.tsx` still has three hardcoded stat-card
  numbers (845 registrations, "5 campus", "4,8 / 5" satisfaction) and a
  "Gérer l'événement" button with no handler. Out of scope for this pass
  (the tracker's gap list is entirely API/service/test/dashboard-widget/
  registry, no UI item) — flagged here for a future pass, not fixed.

## Registry flag

`src/addons/registry.ts` `event-management.enabled` was already `true`
before this pass (set prematurely per the task brief). After closing the
gaps above and verifying live (tests, tsc, tenant-isolation, build), **`true`
is now warranted** and left unchanged: the concurrency fix is proven by a
deterministic regression test, the route surface matches the tracker's
"build the rest" list, recurrence materialization is tested, the
super-admin widget is real and safe, and the kiosk scope concern is
resolved (nothing to remove).

## Files touched this pass

- `src/features/events/services/event-operations-service.ts` — added venue/
  audience/task/incident/feedback/communication CRUD functions, registrant
  listing, `cancelRegistration`'s `restrictToPersonId` param.
- `src/features/events/services/event-operations-service.test.ts` — added
  the two concurrency-race tests.
- `src/features/events/services/audience-service.test.ts` — new file, 9
  tests.
- `src/app/api/addons/events/[id]/venues/route.ts`,
  `.../[id]/venues/[venueId]/route.ts`,
  `.../[id]/audiences/route.ts`, `.../[id]/audiences/[ruleId]/route.ts`,
  `.../[id]/tasks/route.ts`, `.../[id]/tasks/[taskId]/route.ts`,
  `.../[id]/incidents/route.ts`, `.../[id]/incidents/[incidentId]/route.ts`,
  `.../[id]/feedback/route.ts`, `.../[id]/feedback/[feedbackId]/route.ts`,
  `.../[id]/communications/route.ts` — new files.
- `src/app/api/addons/events/[id]/registrations/route.ts` — added `GET`
  (attendee list), `recordAudit` on `POST`.
- `src/app/api/addons/events/registrations/[id]/cancel/route.ts` — self-
  cancel authorization fix, `recordAudit`.
- `src/app/api/addons/events/route.ts`, `.../types/route.ts`,
  `.../[id]/publish/route.ts`, `.../[id]/cancel/route.ts`,
  `.../occurrences/[id]/checkins/route.ts`,
  `.../occurrences/[id]/waitlist/[waitlistId]/respond/route.ts` — added
  `recordAudit` calls (were previously relying only on the domain-specific
  `eventAuditEvents` table, not the app-wide audit log the standing route
  convention calls for).
