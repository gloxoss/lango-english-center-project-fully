# Manual review links — DISC-ATTENDANCE-01

Local dev server seen on port 3111 today. Log in as the school admin of the seeded school (fr locale).

1. Attendance entry — http://localhost:3111/fr/dashboard/attendance — inspect: the Période 1–8 and subject dropdowns; nothing comes from the timetable; same screen as a teacher.
2. Badge QR — http://localhost:3111/fr/dashboard/attendance/badges — inspect: "HMAC-SHA256 Chiffrement Actif" wording; ATL-STU-xxxx prefixes (seed format) vs a newly issued LANGQR-STU-… badge.
3. QR reports — http://localhost:3111/fr/dashboard/attendance/qr-reports — inspect: log in as a teacher and note you see all classes' scans; times in browser timezone.
4. Scanner — http://localhost:3111/fr/dashboard/attendance/scanner — inspect: on Windows Chrome the camera shows video but a QR is not read; on an Android phone it is; any scan lands in "Période 1".
5. Employee time clock — http://localhost:3111/fr/dashboard/workforce/timeclock — inspect: all punches share one timestamp (seed); pressing "Entrée" twice is accepted.
6. Justifications — http://localhost:3111/fr/dashboard/attendance/excuses — inspect: approve one and check the student's mark becomes "Justifié"; no message goes to the parent.
7. Signalements — http://localhost:3111/fr/dashboard/attendance/flags — inspect: the 12 alerts are random seed rows; only open/resolved.
8. Audit & Alerts — http://localhost:3111/fr/dashboard/attendance/audit — inspect: rate from fabricated summaries; "registres manquants" in the morning lists afternoon sessions too.
