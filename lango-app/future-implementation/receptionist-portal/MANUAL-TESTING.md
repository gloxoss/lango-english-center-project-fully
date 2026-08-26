# Receptionist Portal — Manual Testing Guide

Controlling spec: [`RECEPTIONIST-PORTAL-PLAN.md`](./RECEPTIONIST-PORTAL-PLAN.md). All security-sensitive
behaviour is covered automatically by [`scripts/verify-reception-security.mjs`](../../scripts/verify-reception-security.mjs)
(27/27 live checks) — this guide is the human walkthrough of the happy paths and the denial surfaces,
plus what the automation does not cover (visual polish, RTL, real SMS delivery).

---

## 1. Fixture setup

Two prerequisite steps, in order:

```bash
# 1. Apply migration 0092 (idempotent) — only if not already applied in this DB.
docker exec -i schoolos-db psql -U schoolos -d schoolos < migrations/0092_receptionist_portal.sql

# 2. Seed fixtures (idempotent — clears its own REC-* rows first, then recreates).
npx tsx scripts/seed-reception-fixtures.ts
```

Start a live dev server (the default :3000 process is a **stale container** without reception routes —
use your own instance):

```bash
npx next dev -p 3002
```

## 2. Fixture users

All accounts use password `RecepVerify123!` and email `<id-lowercase>@placeholder.local`.

| Login | Role / tenant | Branch | Purpose |
|---|---|---|---|
| `rec-user@placeholder.local` | receptionist / Atlas | REC-BR-A | Default front-desk user (no pickup release) |
| `rec-pickup-user@placeholder.local` | receptionist / Atlas | REC-BR-A | Same role + user-level `reception.pickup.release` override |
| `rec-user-b@placeholder.local` | receptionist / Atlas | REC-BR-B | Wrong-branch probe |
| `rec-teacher@placeholder.local` | teacher / Atlas | REC-BR-A | Wrong-role probe → 403 |
| `rec-schoolos-user@placeholder.local` | receptionist / SchoolOS | — | Cross-tenant probe → uniform 404 |
| `rec-host@placeholder.local` | teacher / Atlas | REC-BR-A | Appointment host / visitor host / handoff assignee |
| `rec-stu-a@placeholder.local` | student / Atlas | REC-BR-A | Child A (matricule `REC-001`, linked guardian) |
| `rec-stu-schoolos@placeholder.local` | student / SchoolOS | — | Cross-tenant student |

Fixture rows also created: branches `REC-BR-A` / `REC-BR-B` (Atlas), gate `REC-GATE` (branch A),
one linked guardian (child A) + one **unlinked** guardian, one active pickup authorization for child A
(valid window around now).

## 3. Happy-path sweep

Sign in as `rec-user@placeholder.local` → `/dashboard/receptionist`.

1. **Home** — KPI cards (today's appointments, open inquiries, present visitors, open handoffs, pending
   pickups) render; each block degrades gracefully if its source module has no data.
2. **Lookup (home panel)** — search `REC-001`: one student result, phone shown masked (`+21****0010`).
   Search a guardian name: masked contact, child link + primary-contact status shown. Search `ZZZNoMatch`:
   empty "no match" state. Search a 1-char term: validation message (min length), no request.
3. **Inquiries** — open `/dashboard/receptionist/inquiries`, create an inquiry for a phone number,
   create it again with the same phone → duplicate-candidate warning (no second row). Schedule a follow-up.
   There is **no** "convert to applicant" button anywhere in the portal.
4. **Appointments** — `/dashboard/receptionist/appointments`: create an appointment with `rec-host` as
   host, open it, reschedule, check in, complete. The row's version increments per transition and the
   history drawer lists `scheduled → checked_in → completed`. Cancel and no-show only exist on
   `scheduled` rows.
5. **Visitors** — `/dashboard/receptionist/visitors`: check in a walk-in visitor (gate `REC-GATE`),
   issue a pass, check out. Repeating check-in/out is harmless (replay-safe, no double transition).
6. **Pickups** — `/dashboard/receptionist/pickups`: open child A → authorized persons + effective
   authorizations listed (never inferred from primary-contact status alone). Create an authorization
   for the unlinked guardian → 422 (`PICKUP_PERSON_NOT_LINKED`). Create one for the linked guardian →
   201.
7. **Release (override user)** — sign in as `rec-pickup-user@placeholder.local`, `/dashboard/receptionist/pickups`,
   release child A with the active authorization + gate → 200 single release. Repeating with the same or a
   new key → denied (authorization consumed). **Sign in as `rec-user@placeholder.local` (no override):
   the release button is hidden / release API returns 403.**
8. **Handoffs** — `/dashboard/receptionist/handoffs`: create a task assigned to `rec-host`, open it,
   acknowledge it, resolve it with notes. History shows the three statuses. Creating a `finance`
   category handoff creates **no** voucher/invoice — it is a coordination intent only.
9. **Templates** — appointment with a notification: a single `sms_messages` row is written with an
   allowlisted body ("Rendez-vous confirmé…"). No free-form SMS is possible from the portal.

## 4. Security surfaces to verify by hand

| Check | Steps | Expected |
|---|---|---|
| Anonymous 401 | Log out, hit `/api/reception/me/home` | 401 |
| Wrong role 403 | Sign in `rec-teacher@placeholder.local`, open any reception page/API | 403 |
| Two-tenant isolation | Sign in `rec-schoolos-user@placeholder.local`, request an Atlas appointment/student/pickup | 404 (never 403, no existence oracle) |
| Wrong-branch isolation | Sign in `rec-user-b@placeholder.local`, request a branch-A resource | 404 |
| Lookup PII | Search `REC-001`, inspect response | Only id/name/masked contact/type/branch+class/guardian status; no national id, salary, bank, medical, grades, finance, raw phone/email |
| Release default-deny | `rec-user@placeholder.local` hits `/api/reception/pickups/release` | 403 |
| Release positive | `rec-pickup-user@placeholder.local` hits it with valid auth | 201, single `guard_release_events` row |
| Finance denial | `rec-user@placeholder.local` hits `/api/finance/expenses` | 403 |
| Admission conversion | Search the portal for any "admission"/"convert" action | Route does not exist → 404 |

## 5. Not covered by automation (pending manual steps)

- **Visual/UX pass** in the browser (FR, EN, AR + RTL) — component-level a11y (focus order, aria labels).
- **Rate-limit feel** — burst of lookups past the configured cap returns 429 (automation asserts the
  boundary; humans may tune the limit).
- **Real SMS delivery** — notifications are log-only `sms_messages` inserts; a real SMS provider is out of
  scope and requires connector credentials.
- **Cross-portal handoff handoff** — a task created here resolving in Admissions/Finance/Teacher inboxes
  depends on those modules' own UI; verify the task appears wherever each destination module surfaces it.
