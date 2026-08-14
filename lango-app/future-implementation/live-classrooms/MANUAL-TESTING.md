# Live Classrooms — Manual Testing

Browser/sweep guide for a human tester against a running dev server. Complements the automated suite (32 tests) and the 24-item evidence matrix. All scenarios assume:

- Dev server running, seeded DB with migration 0081 applied, and the `live-classrooms` addon enabled for the test tenant.
- A **dev provider profile** selected (BigBlueButton is NOT certified — see `IMPLEMENTATION-REPORT.md` §6).
- Two tenants (A and B) available if you want to exercise isolation.

**Before you start:** confirm the global build/typecheck state with the concurrent agents — the previous full `next build` was failing on other modules and the build lock may be held. This guide is about the live-classrooms feature, not the whole app.

---

## M-1. Create / edit / cancel a session

1. Open `/dashboard/academics/live-class` → **Nouvelle session**.
2. Pick a class offering/section, a subject, and an **assigned** teacher (a teacher with a `subjectTeachers` row for that combo).
3. Set start/end in the future. Save → the session appears as **Planifiée** with the provider's meeting id (`dev-<id>`).
4. Edit it (change the title) → save → the row updates.
5. **Negative:** assign a teacher with no assignment → expect `TEACHER_NOT_ASSIGNED`. As a teacher user, try to create for a combo you don't own → expect a scope error.
6. Cancel → status becomes **Annulée**; the row stays (audit trail).

## M-2. Schedule conflict

Create a second session for the same teacher with an overlapping window → expect `LIVE_SESSION_CONFLICT` and the UI conflict preview to flag it.

## M-3. Join windows

- **Before** `scheduledStart − grace`: request join → `SESSION_JOIN_WINDOW_NOT_OPEN`.
- **Inside** the window: a placed student gets a **viewer** link; the host teacher gets a **moderator** link. The dev link is an internal app route labeled **DÉVELOPPEMENT** — it is not a real conference.
- **After** the window closes: `SESSION_JOIN_WINDOW_CLOSED`.
- Reuse the same join URL twice: the second attempt must fail (single-use token, replay rejected).
- Cancelled session: `SESSION_CANCELLED`.

## M-4. Roster & scope

- A student **not** placed in the session's class (and not invited) → `STUDENT_NOT_PLACED`.
- A student placed in the class → `viewer`.
- A parent linked to a placed student → viewer through the child's placement.
- A teacher not assigned to the session → cannot view/host (`TEACHER_SCOPE`); an admin can override with a reason (audited).

## M-5. Tenant switch (isolation)

With a second tenant configured: session lists, reports, provider profiles, recordings, and export CSV must contain **only** the current tenant's rows. A URL for tenant A's session opened while signed in as tenant B → 404 (not 403 — no existence leak).

## M-6. Provider profiles & test connection

1. `/dashboard/settings/live-classrooms` → create a **dev** profile → **Tester la connexion** → real success with measured latency (no random simulation).
2. Add a **BigBlueButton** profile without `LIVE_BBB_URL`/`LIVE_BBB_SECRET` set → the connectivity test must report **"non configuré"** (never a fake success). Set the env vars to a real sandbox → the test performs a real `getMeetings` round trip; until a certified sandbox exists, leave this **not configured**.
3. Masked credentials: editing a profile must never return or display the raw secret.

## M-7. Attendance evidence (reconnects)

Open a session's detail and simulate events via a webhook POST (dev provider): a join, a leave, a reconnect (join→leave→join). After **Synchroniser**, the summary must show one presence interval whose duration is the **union** (reconnect does not double-count), a `reconnectCount`, and a status consistent with the window (late if first join > 5 min after start). Raw events remain untouched.

## M-8. Reconcile & post attendance

1. Run **Réconcilier** → requires a reason → propose summaries.
2. Approve, then **Reporter vers le registre** → the core attendance register updates via the existing attendance service, and raw live-class events are unchanged.
3. With no data, the detail/report pages show empty states (never fabricated numbers).

## M-9. Recordings & addon disable

- **Recordings default off**: a new session's policy must show recording disabled unless explicitly enabled. With the dev provider, no recording exists until scripted; the UI shows the honest empty/disabled state.
- **Disable the addon** for the tenant → every `/api/addons/live-classrooms/**` call returns `403 ADDON_NOT_ACTIVATED`, nav entries disappear, and other modules keep working. Re-enable → access restores with data intact.

## M-10. Reports & export

- `/dashboard/academics/live-class-reports`: summary cards derive from real sessions/events (no fake "48 / 86,2%").
- Export CSV → contains only the current tenant's rows; open it and spot-check totals against the on-screen data.

## Concurrency smoke test

Open the same session's **Démarrer** in two tabs quickly → exactly one live transition (same `actualStart`, one meeting id). End, then attempt end again → handled idempotently.

---

## Sign-off

After the sweep, update `live-classrooms-verification-evidence.md` (flip ⚠️/⛔ items to ✅ with a date) and the status line of `IMPLEMENTATION-REPORT.md`. Do **not** write "fully verified" unless every item is ✅ against a real DB and a fresh `next build` passes.
