# Manual review guide

Local server (clean committed code, commit 54d386a4): **http://localhost:3111** (log in at http://localhost:3111/fr/login). Login only works on port 3111.
Accounts (dev data, password `Admin123!`): director `y.elamrani@atlas.ma`, teacher `prof.20@atlas.ma`, accountant `accountant@atlas.ma`, receptionist `accueil@atlas.ma`, second school `admin@lango.ma`.

| # | What to check | URL | Steps | Expected today (finding) |
|---|---|---|---|---|
| 1 | Hub untranslated card | http://localhost:3111/fr/dashboard/settings | Find the "Modèles PDF" card | Title shows `Settings.mod_documents_title` (in dev: error overlay) |
| 2 | Two school years | http://localhost:3111/fr/dashboard/settings/onboarding then http://localhost:3111/fr/dashboard/academics/calendar | Compare the "Année scolaire" block with the list | Organisation: 2025-2026, 01/09/2025 → 30/06/2026. Calendar: 2025-2026 ends 2026-08-31, marked "Année active" |
| 3 | Active year vs today | http://localhost:3111/fr/dashboard/academics/calendar | Look at today's date (25/09/2026) vs the active year | 2025-2026 still "Par défaut" although it ended on 31/08 |
| 4 | Languages "0 / 1" | Live site https://schoolos.epioso.com/fr/dashboard/settings/onboarding → "Langues et localisation" | Look at the toggle labels | "0" and "1" instead of Français / العربية (fixed on dev by one save; still visible on the VPS) |
| 5 | Branches gated | http://localhost:3111/fr/dashboard/settings/branches | Open the page | Redirects to Modules with `?addon=multi-branch`; Modules shows "Campus inclus 2 / 1" |
| 6 | "test" module | https://schoolos.epioso.com/fr/dashboard/settings/entitlements | Scroll to the end | A card "test / À venir" (VPS only) |
| 7 | Attendance settings | http://localhost:3111/fr/dashboard/settings/attendance | Open | "Fonctionnalité à venir" |
| 8 | Grading weights not applied | http://localhost:3111/fr/dashboard/academics/grading/policies | Read the amber banner; change 50/30/15/5 and save | Saves (200), report-card averages unchanged (weights have no reader) |
| 9 | Pass mark in two places | …/settings/policies and …/academics/grading/policies | Change "Seuil de réussite" on one page, reload the other | The other page shows the new value (same store). Restore 10 afterwards |
| 10 | Numbering has no effect | http://localhost:3111/fr/dashboard/settings/numbering | Read the banner; compare "Numéro facture INV-2026-0201" with the last invoice number | Series are not used by invoices or matricules |
| 11 | Matricule format split | http://localhost:3111/fr/dashboard/students/matricules | Compare "test 111" (STD-2026-0001) with other students (ATL-2526-…) and the preview STD-2026-0002 | New students get STD-… instead of continuing ATL-2526-… (regex bug) |
| 12 | Custom fields not shown | http://localhost:3111/fr/dashboard/settings/custom-fields then any student page | Look for "Sport pratiqué" on a student | Not displayed anywhere |
| 13 | Isolation | http://localhost:3111/fr/dashboard/settings/custom-fields as `admin@lango.ma` | Open | Only Lango's fields (none of Atlas's) |
| 14 | Mobile and Arabic | any page above with `/ar/` and a phone-width window | Resize to 390 px | No horizontal scroll; Arabic pages right-to-left |

Screenshots for every page and variant are in `screenshots/` (`desktop-fr__*`, `mobile390-fr__*`, `desktop-ar__*`, `state__*`).
