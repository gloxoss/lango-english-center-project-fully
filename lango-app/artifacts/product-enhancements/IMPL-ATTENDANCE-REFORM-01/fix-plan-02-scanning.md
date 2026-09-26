# Fix plan 02 — Scanning model (replaces item 6 of fix-plan-01)

For: Agent B (claude-agentb), IMPL-ATTENDANCE-REFORM-01, branch `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-mainline`
Decided by the product owner on 2026-09-25. Item 1 of fix-plan-01 (server resolves the lesson, no default period) is a prerequisite and stays as written. fix-plan-01 lives in the old worktree at `.worktrees/IMPL-ATT-INTEGRATED/lango-app/artifacts/product-enhancements/IMPL-ATTENDANCE-REFORM-01/fix-plan-01.md`; items 2-5 and 7 there are unchanged.

A clickable mockup of both screens accompanies this plan (link given to the product owner). Treat it as the target layout, not pixel spec.

---

## The decision

Scanning has **two separate homes**, and neither asks the user to pick a class.

| | Entrance (portique) | Classroom |
|---|---|---|
| Where | `/dashboard/attendance/scanner` | Inside the teacher's register for the current lesson |
| Who runs it | Reception / guard / admin | The lesson's teacher (or an admin) |
| Who can scan | Any student of the school | Students of that lesson's section only |
| What it writes | A **campus arrival** only. Never a lesson mark. | A **provisional** lesson mark, final only when the teacher validates |
| Device | Fixed terminal, USB scanner or camera | Room terminal, or the teacher's own phone camera |

Product owner's rule, confirmed: an entrance scan **never** pre-marks a lesson present. "Present" means the teacher saw the student in the lesson.

---

## A. Classroom scanning — teacher-driven

### Flow

1. **Teacher opens the current lesson.** `TeacherCurrentLesson.tsx` already resolves it (`/api/teacher/me/current-lesson`, window `BEFORE | OPEN | CLOSED`). The register opens 5 min before start and closes 15 min after end — reuse that window, do not redefine it.
2. **"Activer le scan"** in the register header (only while the window is `OPEN`). Starts a scan session **bound to this lesson occurrence** (section + slot + date), not to a section alone.
3. **Students badge in** on either:
   - the room terminal, if one is paired to this room (it discovers the active teacher session through `kiosk/current-session`);
   - the teacher's phone: the register shows a camera panel (reuse the jsqr decoder from phase 7).
4. **Live count** in the register: *"14 / 28 arrivés"*, names appearing as they scan, each tagged **à l'heure** or **retard N min** against this occurrence's start + the tenant grace setting (exceptions honoured: a moved lesson uses the exception time).
5. **Review.** Three groups: *Scannés*, *En retard*, *Non scannés*. Non-scanned students default to **absent**. The teacher can change any row (present / late / absent / excused, and a "badge oublié" quick action that marks present with source `manual`).
6. **"Valider l'appel"** submits the register exactly like a manual roll-call. Only now do marks become final. The scan session closes.
7. **Manual only** is always available: the same register without activating scan.

### Rules

- **Provisional until validated.** Today `qr/verify-and-stage` writes `attendance` rows directly (upsert, `route.ts` ~532-548). In classroom mode it must write only the scan event + a staged status on the session; the register submission writes the marks. Pick one storage (a staged-status column on `attendance_scan_events`, or a `status='provisional'` register) — do not create a second attendance table.
- **Auto-close.** If the teacher never validates, the scan session closes at end + 15 min. Staged scans stay staged; the lesson shows **À compléter** in Appel du jour (and becomes eligible for "Compléter en retard", fix-plan-01 item 4). Never auto-submit.
- **Who may activate.** The occurrence's teacher (including a replacement teacher set by a session exception) or a school_admin. Anyone else: 403.
- **Wrong section badge.** Refused with the student's **name** shown to the teacher ("Rania Sefrioui — 2nde A, pas dans ce cours"), recorded as a rejected scan. Never silently ignored.
- **Duplicate badge** in the same session: no second entry, the UI flashes the existing row.
- **Branch scope** as today: a device's branch wins over the page.
- **Scanner session model.** `qr/scanner-sessions` currently keys on `classSectionId` only (`route.ts:13`). Add the occurrence identity (slot + date, or the phase-1 session-occurrence key). If this needs a column, claim `task:migration-NNNN` after checking both trees (0165 main tree, your 0167).

### Tests

- Teacher activates at 14:02 for a 14:00 lesson → session bound to that occurrence; scan at 14:03 → staged `present`; at 14:12 with 10-min grace → staged `late`.
- Nothing in `attendance` until "Valider l'appel"; after it, marks equal the reviewed list.
- Another teacher / a student → 403. Replacement teacher from a session exception → allowed.
- Wrong-section badge → 422 with the student's name; duplicate → no new row.
- Not validated by end + 15 → session closed, no marks, lesson "À compléter".
- Cancelled lesson → cannot activate.

---

## B. Entrance scanning — `/dashboard/attendance/scanner`

1. **No class picker, no "Ouvrir la Session".** Remove both from the main flow. The "Mode Libre / Portique" label goes away — the entrance mode is real now.
2. **Any student badge** is accepted (tenant + branch scope as today). Result: a campus arrival event (feeds `attendance/onsite` headcount). **No lesson mark is written**, whatever the time.
3. **Result card** after each scan: photo, name, class, and one line:
   - *"Arrivé à 08:12"*;
   - *"Arrivé à 14:07 — en retard pour Français (14:00)"* when the student's current lesson has already started (informational; the lesson mark is still the teacher's);
   - refusal reasons in plain French (badge révoqué, expiré, inconnu).
4. **The teacher sees it.** In the classroom register, a non-scanned student who arrived at the entrance shows *"arrivé à l'école à 08:12"* so the teacher can tell "absent from lesson" from "absent from school".
5. **Counters, one scope, labelled:** *Arrivés aujourd'hui*, *Dont en retard*, *Encore attendus* (students with a lesson today who have not arrived). Remove the per-terminal vs campus-wide mix.
6. **Input:** USB scanner always listening; camera is an optional toggle. No "Douchette USB / Caméra Vidéo" mode switch.
7. **Operator vs admin.** Move terminal pairing (secret field, "Appairer") and the manual matricule keypad behind an admin-only "Réglages du terminal" drawer. The keypad is labelled *Saisie manuelle — secours* and every use is logged as a bypass.
8. **Wording.** Drop "Station de Scan Unifiée", "WebRTC", "Borne & Scanner QR de Présence". Title: *Accueil — pointage des arrivées*.

### Tests

- Scan at 07:50, 10:30 (mid-lesson), 12:15 (lunch): each writes one arrival event and **zero** `attendance` rows.
- Second scan of the same student the same day: no second arrival, card says "déjà arrivé à 07:50".
- Revoked / expired / other-tenant badge: refused as today.
- Headcount and "Encore attendus" match the arrival events.

---

## C. Out of scope here

- The "Mode Libre" and class-select code paths can be deleted once A and B ship; keep the API accepting `classSectionId` only for the admin override "Choisir un autre cours" (lesson picker, logged), per fix-plan-01 item 6.3.
- Hardware: camera decode on a real Android and iPhone, and a USB scanner, remain **NOT VERIFIED** until physically tried. Phone scanning is now on the teacher's critical path, so this physical test is required before release, not optional.

## Definition of done

- Guide tests 19-23 rewritten into: E1-E4 (entrance) and C1-C6 (classroom), FR desktop, phone 390, AR RTL.
- Gates green; full `vitest run` shows only the 3 pre-existing failures (security cross-tenant delete, payment-posting-status, fine-run-idempotency).
- Report each test PASS / FAIL / NOT VERIFIED; hardware stays NOT VERIFIED until tried on a device.
