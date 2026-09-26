# Attendance settings analysis

## The page

`/settings/attendance` (guard `settings.attendance.manage`, not in the sidebar, not on the hub) renders `AttendanceSettingsView`, which is a "Fonctionnalité à venir" placeholder. Status: MOCK / COMING SOON.

## Where attendance behaviour is actually configured today

| Behaviour | Authoritative source | Default | Edited where | Consumed by |
|---|---|---|---|---|
| Late grace (minutes) | `setting_values attendance.lateGraceMinutes`, fallback `school_settings.attendance_late_grace_minutes` | 15 | Organisation form payload (no visible field; sent with its default) or the generic `/settings/values` editor | QR scan staging only: `app/api/attendance/qr/verify-and-stage/route.ts:47,218` (`computeStagedStatus`) |
| Period start time | `attendance.periodStartTime`, fallback `school_settings.attendance_period_start_time` | 08:00 | same | QR scan staging only (single start time for the whole day) |
| Timezone | `localization.timezone`, fallback `school_settings.locale_timezone` | Africa/Casablanca | Organisation page | QR scan staging |
| Consecutive-absence alert threshold | `attendance.consecutiveAbsenceThreshold` | code default (≥2 enforced) | generic `/settings/values` editor only | `libs/api/attendance-flags.ts:86` |
| Repeated-late alert threshold | `attendance.repeatedLateThreshold` | code default | generic `/settings/values` only | `libs/api/attendance-flags.ts:87` |
| Parent absence SMS | `attendance.smsAlerts` | on unless false | `/settings/policies` | `app/api/attendance/route.ts:381` |
| Presence modes (présence, retard, absence justifiée…, matin/après-midi) | `school_settings.presence_modes` + `attendance.presenceModes` | all on | Organisation page | **nothing** at runtime |
| Attendance windows | none | — | — | none: manual marking is not time-bounded; QR uses the single period start |

Stored today (dev, Atlas): `attendance.presenceModes` (all true), `attendance.lateGraceMinutes` 15, `attendance.periodStartTime` "08:00". The thresholds and smsAlerts are unset (defaults apply).

## How the Attendance reform (IMPL-ATTENDANCE-REFORM-01) should consume them

The reform identifies a register by timetable slot × date (`class_schedule_slots`, migration 0162). With real lesson times available:
- **Period start time becomes obsolete**: lateness should be measured against the lesson's own `start_time`, not one daily 08:00.
- **Late grace stays**, applied per lesson, and should be the single source for both QR and manual marking.
- **Thresholds** belong on the future Attendance settings page with the SMS toggle (today they are only reachable through the raw Values editor).
- **Presence modes**: decide whether they restrict the status choices in the register; today they do nothing.

## Recommendation (not implemented)

Build the Attendance settings page on the registry keys above (grace, thresholds, SMS, presence modes, register lock time); remove the hidden late-grace/period-start fields from the Organisation payload; make QR and manual marking read the same lesson-based rule.
