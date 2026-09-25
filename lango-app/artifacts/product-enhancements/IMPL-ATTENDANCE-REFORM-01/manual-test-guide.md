# Manual test guide — IMPL-ATTENDANCE-REFORM-01

Everything below is reproducible against the dev server. Each test names the role,
the exact URL, the seeded record, the action, and the expected result.

## Before you start

```
cd .worktrees/IMPL-ATT-INTEGRATED/lango-app
NEXT_DIST_DIR=.next-agentb \
BETTER_AUTH_URL=http://localhost:3470 \
NEXT_PUBLIC_APP_URL=http://localhost:3470 \
./node_modules/.bin/next dev -p 3470
```

**Base URL:** http://localhost:3470

### Two traps that will cost you an hour

1. **Use the local binary, not `npx`.** `npx next` fetches a different version
   (16.3.6) instead of the installed 16.3.2 and the app will not start.
2. **`BETTER_AUTH_URL` must be `http://localhost:3470`.** `.env` pins it to 3111.
   Without the override every browser login fails with "Invalid origin" — while
   `curl` still returns 200, because curl sends no `Origin` header. That is the
   trap: the API looks fine and the browser does not.

### Logins (tenant: **Groupe Scolaire Atlas**, slug `atlas`)

| Role | Email | Password |
|---|---|---|
| school_admin | `y.elamrani@atlas.ma` | `Admin123!` |
| teacher | `prof.09@atlas.ma` | `Admin123!` |

### Seeded records used below

- Date: **2026-09-25** (a Friday). 12 scheduled lessons.
- Sections: `3ème · A`, `3ème · B`, `3ème · C`, `2nde · A` … `Terminale · C`
- Teachers: Mehdi Sefrioui, Aya Cherkaoui, Reda Bouhaddou
- Rooms: Salle 5, Salle 6, Salle 7
- Sample student: **Rania Sefrioui** (`STU-0004` / `ATL-2526-0004`), `2nde · A`

---

## 1 — Admin: today's sessions

**URL:** http://localhost:3470/fr/dashboard/attendance
**Role:** school_admin

Expected: the title reads **Appel du jour**, and a chronological list of today's
lessons. Each row shows time, subject, class · section, teacher, room, and a
status chip. No class / subject / "Période 1–8" picker anywhere on the page.

Open the date picker, choose today. Every lesson whose end time has passed shows
**À compléter** (amber); lessons still to come show **À venir** (grey).

## 2 — Admin: a past day is read-only

**Action:** set the date to any earlier date (e.g. `09/18/2026`).
Expected: a banner reading *Journée passée : consultation seule…*. Lessons that
have registers show **Pointage terminé** with a **Corriger le registre** button.
Lessons without one show **À compléter**. There is no way to mark attendance
directly.

## 3 — Admin: a future day is a preview

**Action:** set the date to a later date.
Expected: a banner reading *Aperçu : cette journée n’a pas encore eu lieu.* Every
lesson shows **À venir** and there is no marking action and no correction button.

## 4 — Admin: historical correction

**URL:** as above, on a **past** date with a completed lesson.
**Role:** school_admin

**Action:** click **Corriger le registre** on a past lesson.
Expected: a dialog asks for a **Motif de la correction**. The confirm button stays
disabled until at least 3 characters are typed. After saving, the banner reads
*Registre rouvert…* and the lesson becomes markable.
**Why it matters:** this is the only way history changes, and it records who,
when, and why.

## 5 — Admin: a session exception (one day only)

**URL:** http://localhost:3470/fr/dashboard/attendance (today or a future day)
**Role:** school_admin

**Action:** click **Exception du jour** on any lesson card.
Expected: a dialog shows the lesson and its **usual** time, and four choices:
*Annuler le cours*, *Remplacer l’enseignant*, *Changer la salle*, *Modifier
l’horaire*. Pick **Changer la salle**, type `Salle Test Z9`, give a reason, save.

Expected after saving: the card shows **Salle Test Z9**, an amber banner reading
*Changer la salle · <your reason>*, and the button is now filled. **The other
eleven lessons keep their original rooms** — the weekly timetable is untouched.
Reopen the dialog and use **Retirer l’exception**: the room returns to its
original value.

## 6 — Teacher: the current lesson resolves itself

**URL:** http://localhost:3470/fr/dashboard/teacher
**Role:** teacher (`prof.09@atlas.ma`)

Expected: **no class, subject or period picker.** The page leads with *Votre
cours actuel* showing one lesson, or *Vous n’avez aucun cours en ce moment.* with
the next lesson and today's schedule.

**Timing note:** the register opens **5 minutes before** the lesson starts and
closes **15 minutes after** it ends. Outside that window the button is disabled
and the card says so. To see an open window, pick a lesson whose time brackets
now; otherwise the correct behaviour is a disabled button.

## 7 — Teacher: no lesson now

Expected: when nothing is scheduled, *Vous n’avez aucun cours en ce moment.* plus
a read-only list of the day. No error, no empty screen.

## 8 — Teacher: cannot reach another teacher's lesson

**Action:** open `/fr/dashboard/attendance?slot=<a slot id belonging to another teacher>&date=2026-09-25`.
Expected: the teacher's own scope applies; the other teacher's session is not
markable. (Covered automatically by `attendance-teacher-scope` and
`attendance-history-scope`, but worth one manual attempt.)

## 9 — Attendance rate truth

**URL:** http://localhost:3470/fr/dashboard/students
**Action:** open any student's attendance summary.
Expected: the rate counts **present + late only**. A student with 4 present, 1
late, 2 excused, 1 absent of 8 recorded shows **62.5 %**, not 87.5 %. Excused
appears separately as a justified absence.

## 10 — Justifications: record one received

**URL:** http://localhost:3470/fr/dashboard/attendance/excuses
**Role:** school_admin

Expected: the primary button reads **Enregistrer une justification reçue** — not
"Soumettre". The dialog says it is for a justification handed in on paper or by
phone.
**Action:** pick a student, a date, a reason, save.
Expected: it appears in the list as pending.

## 11 — Justifications: approve

**Action:** open a pending justification, approve it.
Expected: status becomes approved, the reviewer and time are recorded, and the
student's mark for that date becomes **excusé**. The response also reports a
notification for the guardian whose delivery state is truthful — with no SMS
provider configured it reads **simulated**, never "sent".

## 12 — Justifications: reject

**Action:** reject a pending justification without a reason.
Expected: refused — a rejection reason is mandatory (minimum 3 characters). With
a reason, it saves and the reason is kept.

## 13 — Parent notification truth

Same as test 11. The point: **a simulated or failed send is never presented as
delivered.** Nothing in the UI should claim a parent was notified when no
provider exists.

## 14 — Alerts: the lifecycle

**URL:** http://localhost:3470/fr/dashboard/attendance/suivi
**Role:** school_admin

Expected: two sections — **Registres à compléter** (with an *Envoyer un rappel*
button per row) and **Élèves à suivre** (the alert list).

**Action:** open any alert (click a student row).
Expected on the detail page four actions: **Marquer comme vu**, **Tuteur
contacté**, **Résoudre**, **Écarter**.
- Choosing **Écarter** opens a reason field; confirming with fewer than 3
  characters is refused. With a reason, the badge becomes **Écarté**.
- A resolved or dismissed alert offers **Réouvrir**.

## 15 — Cards & badges: the consolidated home

**URL:** http://localhost:3470/fr/dashboard/cards/badges
**Role:** school_admin

Expected: badge management now lives under **Cartes & Convocations**. The list
shows prefix, subject type, user, credential status, issue date, expiry, and
**Réémettre** / **Révoquer** per row. The chip reads **Badge sécurisé** — not
"HMAC-SHA256 Chiffrement Actif".

## 16 — Cards & badges: replacement kills the old QR

**Action:** click **Réémettre** on a student's badge and print/finish the flow.
Expected: the new credential is active, and the old one shows **Remplacé**. The
two writes happen in one transaction, so a failure cannot leave two active
badges.

## 17 — Cards & badges: revoke

**Action:** click **Révoquer**.
Expected: status becomes revoked. A revoked badge is refused by the scanner with
`BADGE_REVOKED`.

## 18 — Cards & badges: expiry

**Action:** find a badge with an expiry date in the past.
Expected: the scanner refuses it with **BADGE_EXPIRED**. Before this reform an
expired badge still wrote attendance.

## 19–21 — Scanner: camera, USB and manual fallback

**URL:** http://localhost:3470/fr/dashboard/attendance/scanner
**Role:** school_admin

At the top there is a terminal identity strip reading **Terminal non appairé**
with a secret field and an **Appairer** button.

- **19 Camera:** with a camera attached, the video should start. Decoding a real
  QR is **NOT VERIFIED** — no camera was available during this work.
- **20 USB:** a keyboard-wedge scanner types into the USB field and presses
  Enter. This path is unchanged and works with any HID scanner.
- **21 Manual matricule fallback:** if you use it, record that it bypasses the
  credential by design and should be treated as an emergency path.

## 22 — Scanner: a paired terminal resolves its own lesson

**Action:** pair a terminal (see the pairing strip). Then, as school_admin, open
http://localhost:3470/fr/dashboard/attendance/scanner
Expected: the strip reads **Terminal appairé**. The scanner sends its secret with
every scan, and the server uses that device's campus rather than anything the
page claims.
API check: `GET /api/attendance/kiosk/current-session?deviceSecret=<secret>`
returns `bound: true` with the device's label and room, and `session: null` when
nothing is scheduled there right now. A bogus secret returns **401**.

## 23 — Scanner: wrong-class and duplicate behaviour

- A badge for a student in another section is refused `WRONG_CLASS` (422).
- The same badge scanned twice in one session does not create a second mark.

## 24 — Registers & historique

**URL:** http://localhost:3470/fr/dashboard/attendance/registres
**Role:** school_admin

Expected: filters for date range, class, status and **source (Manuel / Badge
QR)**, a row count, and a table of date, student, class · section, subject,
status, source and register.

**Action:** set *from* to `09/01/2026` and *to* to `09/30/2026`.
Expected: rows appear. **No raw UUIDs or credential hashes are visible.** At the
bottom, **Journal technique** is collapsed; expanding it reveals the internal
identifiers. That is the point: technical data exists but is not in front of a
head of year.

**Scope check:** as `prof.09@atlas.ma` the same page shows only that teacher's
sections.

## 25 — CSV / PDF parity

The QR report export at `/api/attendance/qr/events/export` shares its query with
the list, so the exported rows match what is filtered on screen. Verify by
filtering to a narrow date range and comparing the row count.

## 26 — HR: employee arrival

**URL:** http://localhost:3470/fr/dashboard/workforce/timeclock
**Role:** school_admin

Expected: **no Arrivée / Départ toggle.** A line explains the system decides.
For an employee with no open shift, a scan records an **arrival**.

## 27 — HR: employee departure

**Action:** scan the same employee again.
Expected: a **departure** is recorded. The server derived it from the last punch.

## 28 — HR: invalid sequence

**Action:** `POST /api/workforce/punches` with `{"rawToken":"<valid staff token>","punchType":"out"}` when the employee's last punch was already an arrival... then try `"out"` again immediately.
Expected: **409 INVALID_PUNCH_SEQUENCE**, with a message naming the legal action.
Nothing is written. Two arrivals in a row are unrepresentable.

Also: an **overnight** pair (arrival 22:00, departure 06:00) is accepted — the
rule is not limited to one calendar day.

## 29 — Mobile

**Action:** narrow the browser to 390 px, or open on a phone.
Expected: **Appel du jour**, **Suivi & alertes**, **Registres & historique** and
**Cartes & badges** all stack cleanly with no horizontal overflow. Buttons wrap
rather than being clipped.

## 30 — Arabic RTL

**Action:** switch the language to **العربية**.
Expected: the layout mirrors — sidebar on the right, cards right-aligned, chips
mirrored. All 30+ new strings are translated.

**Known cosmetic gap:** on Appel du jour the time range renders as `12:55–12:00`
in RTL because the LTR string is reordered by bidi. It needs an isolating
wrapper. Logged, not fixed.

---

## What is NOT verified

State this honestly if asked; none of it was faked into a pass.

| Item | Status |
|---|---|
| QR decoding from a live camera | **NOT VERIFIED** — no camera available |
| Windows Chrome camera decode | **NOT VERIFIED** |
| Android Chrome camera decode | **NOT VERIFIED** |
| USB hardware scanner | **NOT VERIFIED** — path preserved, not physically exercised |
| Arabic RTL by a native speaker | **NOT REVIEWED** — translations are machine-written |
| Session-relative lateness | **NO AUTOMATED TEST** — see the checkpoint |
| Live SMS delivery to a parent | **NOT VERIFIED** — no provider; simulated by design |
