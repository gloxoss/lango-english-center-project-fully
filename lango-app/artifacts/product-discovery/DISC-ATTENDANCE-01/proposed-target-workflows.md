# Proposed target workflows — DISC-ATTENDANCE-01 (for human approval, not implemented)

## Admin
Opens "Appel du jour": list of today's sessions from the published timetable version, Casablanca time — e.g. "14:00–14:55 · Mathématiques · 1ère année · Section 2 · Mme X · Salle B12" with status À venir / En cours / Pointage terminé / Manquant. Can open any session of today. Past dates view-only; "Corriger le registre" with mandatory reason (stored: who, when, before, after). Future dates show the schedule only.

## Teacher
Logs in → system finds the teacher's session now (Casablanca) → class, section, subject preselected → teacher only marks students. No class now → "Vous n'avez aucun cours en ce moment." plus today's list read-only. Window: opens 5 min before start, closes N min after end (N to decide); afterwards corrections go through the admin.

## Student credential
Student identity = user + matricule. The QR on the student card is a credential (random token, hash stored), with issue / replace / revoke / expire. Expired or revoked = refused.

## Kiosk
A kiosk is a paired device bound to a branch (and optionally a room or gate). Classroom kiosk: knows the current session from room + timetable, no manual class pick. Gate kiosk: records school arrival, separate from classroom attendance.

## Employee
Staff badge on the pointeuse (HR). Next punch type derived from the last one; corrections with reason by HR; hours feed payroll only after this is reliable.

## Parent
Sees the child's marks; submits a justification with a document; is notified of the decision and of unjustified absences (existing SMS alert setting `attendance.smsAlerts`).
