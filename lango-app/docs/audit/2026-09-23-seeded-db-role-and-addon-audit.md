# Seeded-DB role and add-on audit (2026-09-23)

Follows `2026-09-23-deep-visual-sweep.md` (S-1 to S-37). IDs here continue at S-38.

## Setup (reproducible, isolated)

- Database `schoolos_audit` (copy, never the main `schoolos`), served by its own dev server on `:3333` with `NEXT_DIST_DIR=.next-audit3333`.
- Super admin `superadmin@schoolos.ma` enrolled in TOTP on the audit DB only (`scripts/audit-superadmin-setup.mjs`), then enabled every add-on through the real `/api/super-admin/entitlements` API: 16 of 18 enabled. `whatsapp` and `online-examinations` are catalogue-disabled ("À venir"), so they can't be enabled.
- Logins (password `Admin123!`): super admin, school admin, 20 teachers (`prof.01..20`), accountant, 4 students, 1 alumni, 6 parents, receptionist, guard, librarian.
- Seed repair made on the audit DB only: `parent.001..006` linked to a guardian with 4 active children. Before that, every parent page said "Aucun enfant lié".
- Tool: `scripts/visual-sweep.mjs` (read-only: never clicks, one screenshot and text/API/console checks per page).

## Coverage

| Role / area | Pages | Result |
| :-- | :-- | :-- |
| Parent, student, alumni, guard, reception, librarian, teacher | 64 | All render real data; findings below |
| Super admin (TOTP login) | 11 | Render; dashboard numbers partly fabricated (S-39) |
| School admin, every enabled add-on | 109 | 80+ clean; findings below |

## P1

**S-38 HR self-service is locked for every employee.** `payroll.self.read` is required by `/api/employee/me/{payroll,advances,awards}` but is in no role's `DEFAULT_ROLE_PERMISSIONS` (`src/libs/api/permissions.ts:296`). `employee-portal-view.tsx:182` then treats any 403 as `NOT_AN_EMPLOYEE`, so active teacher `prof.01` (active `employee_profiles` row) sees "Aucun profil employé associé à ce compte" and the whole page is blocked.
Fix: grant `payroll.self.read` to every employee role (teacher, accountant, receptionist, guard, librarian, school_admin). Only map `error.code === 'NOT_AN_EMPLOYEE'` to that screen. For other 403s, hide just the section that failed.

**S-39 Super-admin dashboard shows invented numbers** (`src/app/api/super-admin/summary/route.ts:112-140`):
- attendance is a constant 94.2% students and 97.8% staff for every day, weekends included, under a "jours ouvrables" label;
- `admissions30Days = totalStudents * 0.12`;
- `totalSectionsCount = classes * 2`;
- with no data, `studentQuantityByBranch` falls back to fake schools "Icon School & College" and "Oxford International".

Fix: compute each figure from real tables, or remove the widget. Never ship placeholder numbers.

**S-40 Super-admin revenue card: collected > billed, "Reste dû 0".** It compares payments dated this month against invoices *issued* this month. Payments on August invoices therefore land in September, so the screen shows Encaissé 2,587,000 MAD against Facturé 2,162,000 MAD, and `remaining = max(0, …)` hides the real balance. It also counts cancelled or draft invoices and reversed payments.
Fix: outstanding = open invoice balances (same rules as finance: exclude cancelled/draft, use `netCollectedSumSql` so reversals are excluded). Show collected-this-month as its own figure.

**S-41 The auth rate limit covers session checks, per IP.** `rateLimit: { window: 60, max: 100 }` (`src/libs/auth.ts:65`) applies to every `/api/auth/*` call, including `get-session`, which every page makes. One admin browsing alone got 429 on 4 pages. A school puts many users behind one public IP (campus Wi-Fi), so the start of class can push the whole school over the limit together.
Fix: exempt or greatly raise `/get-session` and keep the tight limit on `/sign-in/*` and 2FA routes. Consider keying by user or session.

## P2

**S-42 The certificates module is untranslated and shows raw keys on screen**, e.g. buttons read "Certificates.btnNewDefinition". About 114 missing `fr` keys across 12 files (definitions, jobs, issued, requests, settings, templates, issue/*, detail, dialog). The static checker misses the keys built at runtime (`statStaff`, `statStudents`), so run the runtime sweep after adding keys.

**S-43 `HR.colStatus` is missing** and blanks the status column on 3 pages: departments, designations and employees.

**S-44 The staff campus switcher renders for non-staff.** Every parent, student and super-admin page calls `/api/settings/branches` and gets 403. The header shows "Campus Principal" and the CNDP badge to parents and students.
Fix: render the switcher only for roles that have branch scope.

**S-45 The parent sidebar reuses staff labels**: section "ADMINISTRATION", plus "Prise de Présence", "Finance & Recouvrement" and "Paramètres de l'Établissement" for a parent's own pages.

**S-46 Seed data contradicts itself** (`src/scripts/seed-full.ts`):
- 6 open `library_loans` sit on copies whose `state` is still `available`, so the librarian home shows 27 copies, 27 available and 6 loans. Set loaned copies to `checked_out` in the seed. The unique index `library_loans_copy_active_unique` stops a double loan, but the desk then fails with a DB error instead of a clean 409.
- Live-class sessions dated 2 to 18 Oct are "Terminée" and the 27 Sept one is "En direct" (today is 23 Sept). Build seed dates relative to `now()`.

## P3

- **S-47 Teacher home class card shows "— · 17 élève(s)"**: an empty subtitle is rendered as a dash. The parent child picker also shows "—" where the class should be.
- **S-48 Parent amounts are unformatted** ("24000 MAD"), while admin pages use grouped digits. Use the shared MAD formatter.
- **S-49 Super-admin header text**: "Aujourd"hui" (stray quote, calendar button), "utilisateurs" with no count in "Écoles Clientes Récentes", and mixed FR/EN titles ("All Branch Dashboard", "Student Quantity", "Élèves (Student)", "(Employee)").
- **S-50 `/dashboard/transport/allocations` renders a list without React `key` props.**
- **S-51 Cards "Émissions récentes" never shows the recipient**, only the card type and date.

## Coverage pass 2: detail, public and URL-guessing pages

Pass 1 skipped 38 pages (27 detail pages that need a record ID, 9 public school-site pages, 7 public/auth pages). 4 swept pages had also hit 429 (S-41). All of these are now covered:

- **Detail pages (school admin):** 19 real records, with IDs taken from the links each list page shows. All render; the only defects are missing keys (`Certificates.tableLoading` on 3 certificate details, `HR.colDate` on the employee profile).
- **Fake IDs** (student, invoice, employee, guardian, school): clean "not found", with no crash and no data.
- **4 pages re-run after 429:** all clean.
- **Parent typing 19 staff detail URLs:** 16 go to access-denied, and student/invoice show "not found" with every data call 403. The one gap is S-52.
- **Public pages (logged out):** login, signup, verify-document, invalid verify-card/certificate/invitation tokens and unknown school all show clean messages. `/dashboard` redirects to login.
- **School website:** it had no content in the seed (no theme, pages or news). I enabled it and published 1 news item through the real admin API (audit DB only), then swept all 10 pages: see S-55.
- **Eyeball review:** I opened the module homes and the main detail pages myself, not just the automatic checks.

### New findings from pass 2

**S-52 (P2) Event detail is readable by parents and students with no status or audience check.** `GET /api/addons/events/[id]` only needs `events.read`, which parents and students hold, and `getEventDetail` returns the full row. A draft or staff-only event can be read by ID. The page (`EventAdminDetailView`) also shows "Modifier" and "Annuler l'événement" to a parent. The server still blocks those actions (`events.manage_all` / `events.publish`), so nothing can be changed.
Fix: for non-staff roles, return only published events whose audience includes them, and route those roles to a read-only family view.

**S-53 (P2) Salary payments by bank transfer skip the RIB check.** `POST /api/workforce/payroll/payments` prepares a batch for every run line without checking bank details (teacher `prof.01` has no RIB, yet the June run is posted). I found no Moroccan bank transfer file export, although AGENTS.md lists one.
Fix: block or flag `bank_transfer` batches for employees with no RIB, and build the export or remove the claim.

**S-54 (P2) Expired hostel stays stay "checked_in" forever.** All 24 allocations ended on 2026-06-30 and are still `checked_in`. The board and roll call only count stays whose dates cover today, so these students silently vanish (the board shows 0/24 occupied). Seed dates are part of the cause, but nothing detects or closes an expired stay.
Fix: an "overdue checkout" list or alert, plus seed dates relative to `now()`.

**S-55 (P3) Public school site.** The header has no navigation when no menu items exist (generate a default menu from the fixed pages). The home page doesn't list published news. The hero title (dark text on `#2388b8`) fails contrast.

**S-56 (P2) Inventory quantities read as thousands.** Movements show "+12.000" for 12 units: a raw `numeric(…,3)` value that a French reader takes as 12 000. Format quantities with the locale and no trailing zeros. Also "5 catégorie" is missing its plural.

**S-57 (P3) Raw values and formats.**
- Raw English enum values: payroll status "posted", placement "Enrolled", employment "full_time", event type "event".
- Money is formatted two ways ("146.746,00" on payroll, "146 746,00" on HR).
- The student profile shows 2025-2026 as the current year on 2026-09-23.
- A floating widget covers the CNDP notice on the student profile.
- Missing keys `Certificates.tableLoading` and `HR.colDate`.

## By design (checked, no change needed)

- `/communication/events`, `/hr`, `/inventory` and `/library` (admin) redirect on purpose.
- Librarian `policies` needs `library.policy.manage`, and the nav hides it too.
- Library `me` for a non-member shows a clean "no library account" message.
- Reception pickups needs an explicit `reception.pickup.release` override (the page should still say why; see S-32 family).
- Online exams redirects to entitlements because the add-on is catalogue-disabled.

## Harness note

Mid-run, the audit server lost its `.next-audit3333` manifests (OneDrive sync). Payroll pages then showed 500 and "Internal Server Error". After a clean restart, all 7 payroll/workforce pages passed, so those were not app defects.

## Coding-agent prompt (copy-paste)

```
Fix these in SchoolOS. Keep the pipeline (requireRequestContext -> requireTenant ->
requireCapability -> Zod strict -> tenant-scoped query -> recordAudit). Add tests.

1. S-38: add 'payroll.self.read' to DEFAULT_ROLE_PERMISSIONS for teacher, accountant,
   receptionist, guard, librarian, school_admin. In employee-portal-view.tsx only show
   the "not an employee" screen when error.code === 'NOT_AN_EMPLOYEE'; for other 403s
   hide just that section.
2. S-39: in api/super-admin/summary remove hardcoded attendance (94.2/97.8), the
   0.12 admissions factor, classes*2 sections, and the fake-school fallback. Compute
   from real tables or omit the field (UI shows "—").
3. S-40: same route: outstanding = sum of open invoice balances (exclude cancelled/
   draft); collected = netCollectedSumSql for the month. Never clamp a negative.
4. S-41: in libs/auth.ts rateLimit, exempt or raise '/get-session'; keep strict
   limits on /sign-in/* and /two-factor/*.
5. S-42/S-43: add all missing fr (and ar/en) keys for Certificates.* and HR.colStatus.
6. S-44: render the branch switcher only for staff roles with branch scope.
7. S-45: parent-specific sidebar labels.
8. S-46: seed-full.ts sets checked_out on copies with open loans; live-class dates
   relative to now().
9. P3 items S-47..S-51.
10. S-52: GET /api/addons/events/[id] for parent/student/alumni: only status=published
    and audience includes the caller, else 404. Send those roles to a read-only view
    (no Modifier/Annuler buttons).
11. S-53: payroll payments POST: reject or flag bank_transfer lines whose employee has
    no RIB; add the Moroccan bank transfer export, or drop the claim from AGENTS.md.
12. S-54: surface hostel allocations that are checked_in with effective_end_date <= today
    (overdue checkout list and alert); seed allocation dates relative to now().
13. S-55: default public-site menu from the fixed pages; latest news on home; fix hero
    title contrast.
14. S-56/S-57: locale-aware quantity formatting; one shared MAD formatter; translate
    enum values; add Certificates.tableLoading and HR.colDate.
```

## Acceptance gate

| Check | Pass condition |
| :-- | :-- |
| Teacher `prof.01` opens `/dashboard/hr/self-service` | Payslips, advances and awards load, no 403 |
| Super-admin dashboard | No constant attendance values; collected <= billed or outstanding shown separately |
| 200 page loads in 2 min from one IP | No 429 on `get-session` |
| Runtime sweep of certificates and HR pages | Zero `MISSING_MESSAGE`, no raw keys visible |
| Parent/student sweep | No 403 on `/api/settings/branches` |
| Librarian home after reseed | available = total − open loans |
| Parent GETs a draft or staff-only event by ID | 404, and no management buttons render |
| Payment batch for a run with a no-RIB employee | Rejected or flagged before approval |
| Hostel stay past its end date, still checked_in | Listed as overdue checkout |
| Inventory movement of 12 units | Shows "+12", not "+12.000" |
