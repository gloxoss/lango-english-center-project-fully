# Page inventory and UX review — DISC-ATTENDANCE-01

On-screen mobile and RTL behaviour was NOT observed (no browser in this campaign); rows below come from code.

| Page | Intended user | Works end-to-end? | Good | Confusing / redundant | Should be automatic | Primary CTA | View-only for | Decision |
|---|---|---|---|---|---|---|---|---|
| Saisie des Présences | admin, teacher | yes (manual) | registers lock/reopen, audit trail, teacher write-scope | Période 1–8, subject and class dropdowns disconnected from the timetable; same form for teacher and admin | pick today's session from the timetable; teacher's current class | "Enregistrer l'appel" | past/future dates | REDESIGN |
| Badges QR | admin | yes | secure random token, hash-only storage, revoke/reissue | separate from Cards; "HMAC-SHA256 Chiffrement Actif"; seeded ATL-STU prefixes | — | "Émettre / remplacer la carte" | — | MERGE into Cards |
| Audit & Rapports QR | admin | yes | real filters, CSV/PDF | technical columns (Event ID, staged status, terminal); no branch/teacher scope | — | "Exporter" | all | KEEP (simplify, scope) |
| Scanner Kiosque QR | admin, teacher, kiosk | partial | real camera, USB wedge, duplicate handling | manual class pick; period always 1; camera decode browser-limited; "4 terminaux" cosmetic | class/session from terminal + timetable | "Démarrer la session" | — | REDESIGN |
| Pointeuse Employés | HR, reception | partial | real API, staff badges | seeded identical timestamps; free in/out choice; under Présence menu | next punch type from last punch | "Pointer" | — | MOVE to HR/Workforce + REDESIGN |
| Justificatifs | admin (review), parent (submit) | yes | full approve→excused→alert→totals chain | admin page offers "Soumettre" | notification on decision | admin: "Enregistrer une justification reçue" / "Examiner" | — | KEEP (role-specific UX) |
| Signalements | admin, CPE | partial | real detector, notes, contact guardian | seeded random alerts; thin lifecycle | thresholds from settings, reopen on recurrence | "Prendre en charge" | — | KEEP + REDESIGN lifecycle |
| Audit & Alertes | admin | partial | real reminder SMS, honest simulation message | duplicates dashboard rate and Signalements counts; wrong missing-register rule; fabricated rate source | missing = ended sessions without register | "Relancer l'enseignant" | — | MERGE into a "Suivi des registres" view |
| Settings › Présences | admin | no (Coming soon) | honest placeholder | — | — | — | — | KEEP until thresholds/lateness move here |
| Settings › Dispositifs de scan | admin | cosmetic | pairing UI | devices never used | — | — | — | REDESIGN (only if kiosks are adopted) |
