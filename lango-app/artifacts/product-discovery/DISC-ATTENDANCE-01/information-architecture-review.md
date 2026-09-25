# Information architecture — DISC-ATTENDANCE-01

Today "Prise de Présence" holds 8 entries mixing four concepts: student attendance, identity credentials, kiosk devices and staff time. Four of them are hidden behind a stronger permission than the menu shows.

## Proposed (for review)

```
Présences
├─ Appel du jour          (today's sessions from the timetable; teacher = own current class)
├─ Registres & historique (past registers, corrections with reason, QR scan journal as a filter)
├─ Justificatifs          (admin: record + review; parent submits from the portal)
└─ Suivi & alertes        (missing registers + reminders + alerts lifecycle, one page)

Cartes & badges  (under Élèves / Cards & Convocations)
└─ card = identity, QR = credential on the card (issue / replace / revoke)

Kiosques          (only if schools adopt fixed scanners)
├─ Scanner
└─ Appareils (settings)

RH / Workforce
└─ Pointeuse du personnel
```

Rationale: school staff think in "today's roll call", "history", "justifications", "follow-up". Credentials and devices are setup tasks done rarely; staff time belongs with HR.
