

## Password (all accounts below)

```
Admin123!
```

## Login credentials by role

| Role                               | Name                           | Email                                         |
| ---------------------------------- | ------------------------------ | --------------------------------------------- |
| **Super Admin** (platform)         | Super Admin Plateforme         | `superadmin@schoolos.ma`                      |
| **School Admin** (Atlas)           | Yassine El Amrani              | `y.elamrani@atlas.ma`                         |
| **Accountant**                     | Karim Bennani                  | `accountant@atlas.ma`                         |
| **Teacher** (any of 20)            | Mouna Chraibi ... Hamza Hamidi | `prof.01@atlas.ma` → `prof.20@atlas.ma`       |
| **Parent** (any of 6)              | Parent 1–6 Atlas               | `parent.001@atlas.ma` → `parent.006@atlas.ma` |
| **Student** (4 of 200 have logins) | Sabrine Jbilou                 | `etudiant.0001@atlas.ma`                      |
|                                    | Badr Mouline                   | `etudiant.0051@atlas.ma`                      |
|                                    | Marwa Cherkaoui                | `etudiant.0101@atlas.ma`                      |
|                                    | Zakaria El Amrani              | `etudiant.0151@atlas.ma`                      |

Organization: **Groupe Scolaire Atlas** (slug `atlas`), 200 students / 21 teachers / 6 parents / full HR, hostel, finance, inventory, transport, CRM, library, exams, academics data already populated.

**Note on scope:** only these specific accounts have login credentials — the seed script (`seed-full.ts`) deliberately gives real passwords only to `USR-001`, `USR-ACC-001`, `USR-SUPER-001`, all 20 teachers, 4 sample students (not all 200), and the 6 parents. Other roles that exist in the schema (librarian, HR staff, etc.) aren't wired with credentials here — only two stray `@placeholder.local` librarian/teacher rows exist from an old test fixture, not real demo accounts, so I left those out.

**Suggested test flow for what you described** (super-admin → grant access → student sees result):

1. Log in as `superadmin@schoolos.ma` — go to Écoles Clientes / Lango Center, or Atlas itself, and manage its license/plan (the controls we just fixed).
2. Log in as `y.elamrani@atlas.ma` (school admin) — enter a grade for a student, e.g. via Academics → Grade Entry, or post an invoice.
3. Log in as `etudiant.0001@atlas.ma` and confirm the grade/invoice shows up on their side.

I did **not** run the destructive `npm run db:seed:full` reset — the Atlas tenant already holds this exact data live (created 2026-08-14, 230 users), so re-running it would only wipe and rebuild what's already there for no benefit. Say the word if you actually want a hard reset to a clean slate instead.

Complete, verified list of all 37 login accounts — every role covered, no gaps. **Password for all: `Admin123!`**

## Complete credentials — `https://schoolos.epioso.com`

| Role                    | Email                                               | Notes                                                                                                     |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Super Admin**         | `superadmin@schoolos.ma`                            | Platform-wide, manages all schools                                                                        |
| **School Admin**        | `y.elamrani@atlas.ma`                               | Full admin for Groupe Scolaire Atlas                                                                      |
| **Accountant**          | `accountant@atlas.ma`                               | Finance module                                                                                            |
| **Teacher** (any of 20) | `prof.01@atlas.ma` → `prof.20@atlas.ma`             | Same access level, interchangeable for testing                                                            |
| **Student** (4 of 200)  | `etudiant.0001@atlas.ma`, `.0051`, `.0101`, `.0151` | Each has real grades/attendance/finance data                                                              |
| **Parent** (6 of 6)     | `parent.001@atlas.ma` → `parent.006@atlas.ma`       | 001–004 are linked to real children (including the 4 students above); 005–006 have no linked children yet |
| **Alumni**              | `ancien.eleve@atlas.ma`                             | Newly added — self-service alumni portal                                                                  |
| **Receptionist**        | `accueil@atlas.ma`                                  | Newly added — front-desk portal                                                                           |
| **Guard**               | `securite@atlas.ma`                                 | Newly added — security/gate portal                                                                        |
| **Librarian**           | `bibliotheque@atlas.ma`                             | Newly added — library portal                                                                              |

**One honest caveat**: the 4 new accounts (alumni/receptionist/guard/librarian) are freshly created login-only records — they have real portal access and permissions like everyone else, but won't have the rich historical data (past checkouts, past incidents, past visitor logs) that the original 33 accounts have, since `seed-full.ts` never generated any of that for these roles to begin with. If your partners want to see those portals with realistic history, that'd need actual seed-script work, not just an account.