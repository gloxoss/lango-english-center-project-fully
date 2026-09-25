# AUD-RECEPTION-01 — Findings, decisions and out-of-scope notes

## Fixed (in scope, this branch)

| ID | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| R-01 | High | `app/api/students/route.ts` | Receptionist held `students.read` and the nav + page guard promised the directory, but GET's role allowlist excluded the role: the page rendered a fake "Aucun élève trouvé" over zeroed KPIs while the school has 200 students. | Added `receptionist` to the GET allowlist with a least-privilege projection (finance zeroed like teacher, `nationalId` nulled like accountant; detail strips finance + identity papers + academic history). |
| R-02 | Medium | `features/students/ui/students-list-client.tsx` | On a refused/failed list fetch the client kept the previous state and rendered the empty state + KPI zeros — a silent lie. | Explicit `loadError` state: error banner + honest "Chargement impossible" state with retry, and the class filter is hidden when classes cannot be read (`classesUnavailable`). |
| R-03 | Medium | `features/reception/services/notifications-service.ts` | Appointment/handoff notices inserted `sms_messages` with `status='sent'` + `sentAt` and **no provider call** — fake success, the same contradiction AUD-COMMS-01 filed elsewhere. | Routed through the canonical `sendSmsMessage` (provider-aware, STOP/opt-out aware, honest queued/simulated/failed). |
| R-04 | Medium | `features/reception/services/home-service.ts` | "Today" was the UTC day (wrong window 23:00–00:00 UTC) and the two `guard_visits` counts ignored the branch while appointments/handoffs were branch-scoped. | `casablancaTodayIso()`; branch filter on both visitor counts. |
| R-05 | Low | `features/reception/ui/reception-home-view.tsx` | Open-handoff rows rendered raw enum values (`high`, `admissions`) in an otherwise localised UI while the handoffs view translated them. | Reuses `CATEGORY_KEYS` / `HANDOFF_PRIORITY_KEYS`; unknown values still fall back honestly (the seeded `maintenance` category is outside the documented set and shows raw). |
| R-06 | Low | `reception-api.ts`, `reception-home-view.tsx`, `reception-appointments-view.tsx` | Client "today" for the appointment list used the UTC day, disagreeing with the server's business day. | Shared `casablancaToday()` helper (Intl, `Africa/Casablanca`). |
| R-07 | Low | `app/api/reception/staff/route.ts` | The shared host picker required `reception.appointment.manage` although the visitor dialog also uses it; a `visitor.manage`-only grant had an empty host dropdown. | `requireAnyCapability(['reception.appointment.manage', 'reception.visitor.manage'])`. |
| R-08 | Low | `reception-visitors-view.tsx` | Home's "Sortie →" link points to `/visitors#visit-<id>` but rows had no anchor id. | Rows carry `id={'visit-'+id}`. |

## Reviewed and deliberately not changed

- **`/dashboard/receptionist/pickups` page guard = `reception.portal.use`, data
  API = `reception.pickup.release`** (default-deny; release is guard-owned per
  `permissions.ts`). The page renders an explicit, explanatory forbidden state
  ("La sortie d'un élève exige une autorisation de retrait effective et un
  pouvoir de libération explicite…"). The page comment documents this as the
  intended design, and codex-2 independently reached the same conclusion in the
  hub (`AUD-SUPPORT-RECEPTION-01`, 19:55): "The page renders an honest forbidden
  state, so this is correct today; only change it if you want the page hidden
  instead, and then the nav entry and page guard must move together or
  nav-page-guard-parity will fail." Left as-is and documented; the forbidden
  state is honest and actionable.
- **`/dashboard/students` residual 403s** on `/api/academics/classes` and
  `/api/academics/class-sections` (filter + placement tooling for roles without
  `academics.read`): caught by the client, class control hidden when they fail,
  list unaffected. Making the receptionist read academic structure is a
  capability decision, not a page fix; logged for the orchestrator.
- **Seed data note:** the seeded handoff uses category `maintenance`, outside
  the documented set (admissions | finance | teacher | admin | security) and
  outside the create schema. The UI fallback renders it raw — correct for
  unknown values; the seed is the outlier.

## Out of scope / other lanes (logged, untouched)

- `/dashboard/transport/allocations` React key warning (codex-2 follow-up,
  transport lane).
- `/api/settings/branches` 403 on self-service shells (cross-module follow-up
  already logged by codex-2; the receptionist holds the campus-switcher roles
  per S-44, so reception pages are unaffected).
- Frozen modules: nothing was frozen for this task. Attendance Core was not
  touched; the guard services reused by the reception routes
  (`visitors-service`, `release-service`, `gates-service`) and the broadcast
  `sms-delivery` service were **called, never modified**.
