# AUD-SAFETY-01 — Screenshot manifest

Real renders on `http://localhost:3449` against `schoolos_audit`, captured with
`scripts/visual-sweep.mjs`.

## Sets

| Folder | Role / locale / viewport | Routes |
|---|---|---|
| `screenshots/baseline-guard` | guard · FR · 1440 | 8 (7 portal + `/dashboard`) |
| `screenshots/baseline-admin` | school_admin · FR · 1440 | 8 |
| `screenshots/final-guard-fr` | guard · FR · 1440 | 8 |
| `screenshots/final-guard-ar` | guard · AR RTL · 1440 | 8 |
| `screenshots/final-guard-phone` | guard · FR · 390×844 | 8 |
| `screenshots/final-admin-fr` | school_admin · FR · 1440 | 8 |

Each folder carries its `sweep-<role>-<locale>.json`.

## What the key shots prove

| File | Proves |
|---|---|
| `final-guard-fr/guard-fr-portals__guard.png` | Home: shift/gate header "Portail principal · Entrée", expected pickups, recent incident (canonical category) |
| `final-guard-fr/guard-fr-portals__guard__scanner.png` | Scanner gate badge now reads "Entrée" (was "Sortie" with the legacy value); honest "Aucune session en cours" state |
| `final-admin-fr/school_admin-fr-portals__guard__config.png` | Gate list shows canonical directions "Entrée"/"Sortie" |
| `final-guard-fr/guard-fr-portals__guard__visitors.png` | Visitor register with pass/check-in/call-out actions |
| `final-guard-fr/guard-fr-portals__guard__pickups.png` | Pickup safeguarding screen (search → authorized persons → release) |
| `final-guard-fr/guard-fr-portals__guard__incidents.png` | Incident board with severity/status/trail |
| `final-guard-fr/guard-fr-portals__guard__emergency.png` | Procedures + contacts (activation hidden for guard — permission-gated) |
| `final-admin-fr/school_admin-fr-portals__guard__emergency.png` | Admin variant with activation controls |
| `final-guard-ar/guard-ar-portals__guard.png` | Arabic RTL portal home |
| `final-guard-phone/guard-fr-phone-portals__guard.png` | 390px portal home, no horizontal scroll |

## Expected sweep flags

- guard: `/dashboard/portals/guard/config` → `/fr/dashboard/access-denied`
  (guard lacks `guard.gates.manage`; nav entry hidden, in-app denial on direct URL).
- guard/admin: `/dashboard` → portal/dashboard landing redirect (correct).
- admin: guard-only duty stations (home, scanner, visitors, pickups) →
  in-app access-denied (by design; nav role-restricted).
- No text defects (NaN/undefined/raw keys), no horizontal scroll on any route in
  any of the four final sweeps.

## Coverage statement

- Every audited page: final desktop FR screenshot (guard, plus admin for the
  three admin-visible pages). ✅
- Pages with changes (scanner gate label, home) and security-sensitive screens:
  additionally AR RTL and 390px mobile. ✅
- Before/after: baseline-guard/baseline-admin vs final sets for every route. ✅
- Role-specific portal: all guard shots under the real `guard` account. ✅
