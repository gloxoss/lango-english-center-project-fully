# SchoolOS deep visual sweep — all modules (school_admin, teacher, accountant)

Date: 2026-09-23 · Mode 3 with runtime evidence · Server: other agent's dev server `:3111`, seed tenant "Groupe Scolaire Atlas" · Tools (read-only, never click):
- `scripts/visual-sweep.mjs` — one login, many routes, one screenshot each + automatic flags (redirects, failed API calls, console errors, NaN/undefined/null/Invalid Date, raw i18n keys, horizontal scroll).
- `scripts/check-missing-i18n-keys.mjs` — translation keys used in code but missing from `locales/fr.json`.

Status: COMPLETE — 246 school_admin routes, 16 teacher, 51 accountant, 11 super-admin, plus Arabic and 390 px phone passes on 9 key director pages.

## Executive summary

The core director flows (students, attendance, invoices, collection desk, classes, results) now read real data and show honest empty states; money on invoices, reminders and the dashboard agrees (3 000 MAD overdue).

What still misleads a school, in order:
1. **Fake screens and false claims**: five Communication pages are fully mock (S-1); the header claims CNDP compliance on every page while the school has not filed (S-18); readiness counts empty checks as 100 % (S-4); the SMS reminder screen says "tout est au vert" while a family is 14 days late (S-2).
2. **Money that does not reach the books**: the finance home says 6 000 MAD overdue against 3 000 everywhere else (V-1); payments never reach the general ledger and reports say "Équilibré" (S-3); late fees are assessed but never billed and can double (S-19).
3. **Navigation that throws staff out**: 86 sidebar links are looser than their page; teachers and accountants land on the public homepage (S-32); the accountant's own cash desk cannot load classes (S-35).
4. **Safety**: the emergency headcount ignores manual attendance (S-20); gate release does not re-check guardianship (S-8).

Additional coverage notes: super-admin pages are gated by mandatory 2FA enrolment (good), so their content was not reachable without writing data. School directors are not required to use 2FA although they hold all student and finance data (recommendation).

Coverage limits (stated up front):
- Only 4 roles can log in on this seed: super_admin, school_admin, teacher, accountant. **Parent, student, guard, receptionist, librarian portals are not verifiable** without writing credentials.
- Add-on modules not enabled for this tenant (hostel, inventory, live classes, events, online exams, content library, …) redirect to entitlements, which is correct gating; their screens are not visible without enabling them.
- Harness noise excluded: 429s from parallel sessions, and "Failed to fetch" console errors — verified to be the warm-up load's requests aborted by the measured reload (the same pages render their data; `visual-sweep.mjs` now ignores it).
- The local stack stopped overnight (dev server + Docker). The sweep resumed on a separate dev server (`:3222`, auth URL overridden) so the other agent's `:3111` stays free; one Turbopack cache crash was restarted.

## P0

**S-1 · Five live Communication pages run entirely on invented data** — `/dashboard/communication/{leads,segments,forms,milestones,templates-automation}`
- Screen (`leads`): "Nouveaux leads 128 · +18 %", "Prospects qualifiés 82", "Visites 37", "Taux de conversion 21,4 %", ~16 named prospects dated May 2025, contact email `prospect@schoolos.ma`.
- Code: `features/crm/ui/lead-pipeline-client.tsx:184-217` hardcodes the KPI numbers; state is seeded from `data/lead-pipeline-config.ts` (`KANBAN_COLUMNS`) and the file makes **no fetch**. Same pattern in `audience-segments-client`, `form-intake-client`, `milestone-triggers-client`, `templates-automation-client`.
- Not linked from the sidebar (reachable by URL), hence P0 downgraded to **P1 exposure / P0 truth**: archive to `future-implementation/_archived-ui` like the earlier mock screens.
- The `check:ui` ratchet ("mock screens 0/0") misses this: it only detects arrays declared in the same file. Extend it to flag a client with no fetch that seeds state from an imported `data/*` module.

## P1

**S-2 · SMS reminders page shows a false all-clear** — `/dashboard/communication/reminders`
- Screen: "Élèves à risque (0) · Tous les indicateurs sont au vert !" while the dashboard lists Salma Bennani "Paiement en retard 14 jours" and 1 unjustified absence.
- Code: `features/communication/ui/sms-reminders-view.tsx:238` reads `summary.data.atRiskStudents`; the rewritten dashboard summary returns `watchlist.students` (bounded preview). The at-risk list is therefore always empty. Using the bounded dashboard preview as an SMS audience would also silently drop families.
- Fix: dedicated at-risk endpoint (full list, class filter) and consume it; show an error, never "au vert", when the fetch fails.
- Same screen: header badge "SMS : Simulation" while the selected channel card says "SMS Direct · Télécom Maroc" — the director cannot tell whether messages will really be sent.

**S-3 · General ledger silently empty; reports say "Équilibré"** — `/dashboard/finance/accounting/statements`, `/periods`, `/student-accounting`
- Screen: "Aucune transaction enregistrée sur la période · Total Débit 0.00 · Total Crédit 0.00 — Équilibré" while finance shows 9 000 MAD invoiced / 3 000 MAD collected; "Périodes comptables: Aucune donnée"; "Exceptions de passerelle (0)".
- Cause: no fiscal period exists, so every payment's GL posting is skipped (`gl-auto-post.ts` fail-open) with no exception row (the refund path now raises one; payments do not).
- Fix: raise an `accounting_adapter_exceptions` row for skipped **payment** postings too; show a setup banner on accounting pages ("Aucun exercice ouvert — N encaissements non passés au grand livre"); never show "Équilibré" when source documents are unposted.

**S-4 · Readiness scores empty checks as 100 % "Conforme"** — `/dashboard/academics/readiness`
- Screen: "Professeurs principaux — Conforme 100 % — 0 / 0 classes ont un titulaire" (3 sections exist); "Salles — Conforme 100 % — 0 / 0 créneaux". Overall 67 % is inflated.
- Code: `libs/services/academic-readiness.ts:49,65,77,98,106` return 100 when the denominator is 0. A check blocked by an unmet prerequisite must show "Bloqué / à configurer" and count as 0.
- Same pattern: `advanced-reporting/adapters/attendance-adapter.ts:80` (attendance 100 % with no marks), `dashboard/summary/route.ts:626` (collection rate 100 % with nothing invoiced), `super-admin/sms/route.ts:74` (100 % success with no SMS).

**S-5 · Report card generator shows "Moyenne générale 0.00 /20" with no marks, print enabled** — `/dashboard/documents/generator`
- Screen: "0 matière(s) notée(s) · Moyenne générale 0.00/20", buttons "Télécharger PDF / Imprimer" active; no term selector although report cards are now term-scoped.
- Fix: "—" and disabled print/PDF when no subject is graded; add a term/semester selector that passes `examTermId`.

**S-6 · 134 translation keys used in code are missing** (`node scripts/check-missing-i18n-keys.mjs`)
- 21 files; users see raw keys. Worst: Certificates module (definitions 21, jobs 20, issued 15, requests 13, settings 13, templates 6 …), `question-bank-view` 10, `schedule-client` 2 (`Academics.scheduleModuleTag` is visible as a badge on the timetable page).
- Also formatting errors on `/academics/rooms`: `"Capacité : {capacity} places"`, `"Type : {type}"` rendered without values.

**S-7 · ~1 375 hardcoded French UI strings bypass translation** (accented strings only; real count higher). Top: settings 318, students 205, crm 115, events 78, super-admin 75, academics 66. This is why the Arabic UI stays French (the `ar.json` values themselves are 99.9 % real Arabic).

**S-8 · Gate pickup does not re-check guardianship at release** — `features/guard/services/release-service.ts:225-300`
- An authorization created while a guardian could pick up remains usable after the link is revoked (`guardianStudents.canPickup=false` or status not active, e.g. custody order). Re-check the live link inside the release transaction.

**S-9 · Promotion wizard** — `/dashboard/academics/promotions`
- "Effectif 4 — Élèves évalués" while all four rows show "Non évalué"; "Taux de réussite 0 %" with no marks (should be "—"); target session defaults to the **current** active year (2026–2027) instead of the next; "Valider et Confirmer la Promotion" enabled with 4 pending decisions.

**S-18 · Header claims CNDP compliance on every page; the school has not filed** — `components/shared/header.tsx:221`
- Every page shows a blue shield badge "Conformité CNDP F211". `/settings/cndp` shows "Aucun récépissé — Non Déposé", and `/settings` shows "Statut de conformité 0 % — PCG 2026 & CNDP non configurés".
- The badge is static text. Show the real status (Non déposé / Déposé / Approuvé) or remove it; a false compliance claim is worse than none.

**S-19 · Late fees are assessed but never billed, and can double** — `api/finance/fine-runs/route.ts`
- A run writes `fine_assessments` rows and says "N amende(s) évaluée(s) pour un total de X MAD", but no invoice, balance, statement, collection desk or parent view reads those rows (only the fine-policies page and an advanced-reporting adapter). The fine can never be collected.
- Idempotency is a read-then-insert without a unique index on (tenant, invoice, policy): two concurrent runs (two admins, or job + manual) fine the same invoice twice.
- Fix: unique index + `onConflictDoNothing`; turn an assessed fine into a billable line (invoice item or linked fine invoice) so it appears in what the family owes.

**S-20 · Emergency headcount ignores manual attendance** — `/dashboard/attendance/scanner`
- "Effectif & sécurité — Élèves présents sur place : 0" next to the "Alerte Urgence" button, while manual roll call already marked students present today. In an evacuation the number is wrong. Combine manual attendance and scans (and exits) for the on-site count.
- Same screen: "VISEUR WEBRTC ACTIF" shown in green while the camera failed; matricule example "ETU-2025" matches no real format.

**S-21 · Approvals inbox shows "0 en attente" for a director with 0 authorities** — `/dashboard/portals/leadership/approvals`
- Counts are filtered by the director's active approval authorities; with none configured the inbox reads empty whatever is pending. Show "Aucune autorité d'approbation configurée — les demandes en attente ne sont pas visibles ici" with a link to set them up.

**S-32 · 86 sidebar links are looser than the page they open; denied users land on the public homepage** — evidence `docs/audit/2026-09-23-nav-permission-mismatch.txt`
- Runtime (teacher `fz.idrissi@atlas.ma`): "Emploi du temps", "Classes", "Banque de questions" in the teacher's sidebar redirect to `/fr` (marketing site). Cause: sidebar shows the link for `academics.read`, page requires `academics.manage` (`page-guard.ts:87,97` redirect to `/${locale}`).
- Same shape across finance (collection desk, fee structures, refunds… `finance.read` vs `finance.manage`), attendance, HR, hostel, inventory, broadcast, settings.
- 2 sidebar links point to pages that no longer exist: `/academics/class-subjects`, `/academics/class-section-teachers` (archived) → 404.
- Fix: derive the sidebar permission from the page guard (single source), and make a denial render an in-app "Accès refusé" page, never the public site. Add a test that walks the sidebar config and asserts each link's permission ≥ its page's `requiredCapability`.

## P2

- **S-35 (P1 for accountants)** The accountant role gets `403` from `/api/academics/class-sections` on the collection desk (the "Par Classe" collection tab cannot load classes) and from `/api/academics/semesters` on fee structures (empty semester picker). The cashier's own main screen is partly broken for the cashier. Grant `academics.read` projection for these lookups or add a finance-scoped lookup endpoint.
- **S-34** Student photos: two records point to missing files (broken images, `404 /api/students/photos`) yet count as "Avec Photo 2"; the bulk-upload hint names files by an `ETU-2025-0042.jpg` matricule format that no student has (uploads match by matricule, so following the hint matches nobody); spec code "(§2.7)" on the button.
- **S-33** `{count} demandes` rendered without a value on `/students/alumni/requests` (formatting error, same class as S-6).
- **S-22** Leadership admin calls `/api/hr/departments`, which 403s when the HR add-on is off: part of the page silently breaks. Check the add-on before calling.
- **S-23** Audit log shows internal module names (`accounting_adapter_reconciliation`, `guardian_student`) and raw UUIDs; opening the reconciliation page writes an "export" audit row on every view; an idempotent enrolment replay writes a second "Création student_from_admission" row.
- **S-24** Three matricule formats in one tenant: `STD-2026-0042`, `AAM-2425-0001`, `STD-14745779`.
- **S-25** Header falls back to a fabricated identity "Utilisateur / user@ecole.ma" when the session call is slow or rate-limited (`header.tsx:102`); show a skeleton instead.
- **S-26** Settings page: "Annexes & Multi-Sites — Configuré" while the multi-branch add-on is not enabled; raw English actions ("export", "update", "create") in recent changes; spec code "(PF-02)" in the title. License page: "Campus inclus 2 / 1" (over quota) shown without any warning.
- **S-28** Receivables aging (`/finance/receivables`) puts a not-yet-due invoice (INV-2026-0003, due 2026-10-06, "0 j") in the "0–30 jours" late bucket and offers "Relancer SMS" for it: a family that is not late can be sent a late-payment reminder. Add a "Non échu" bucket and hide the reminder for not-due invoices. Placeholder emails (`stu-003@placeholder.local`) shown on screen; title keeps English "(Aging Receivables)".
- **S-29** Overdue truth on screen: dashboard, invoices ("1 (3 000 MAD)") and finance reminders ("1 · 3 000,00 MAD") agree; only the finance home (6 000 / 2) disagrees — confirms V-1 is isolated to `/api/accountant/me/home`.
- **S-30** `/finance/payments` and `/finance/payments/new` redirect to the collection desk, so the dashboard link "Consulter l'historique complet des encaissements" lands on the cash desk; there is no payment history screen.
- **S-31** Developer copy on finance screens: "3 facture(s) réelle(s), tenant-scopées", "0 structure(s) réelle(s)", "SMS simulé via le module Finance réel". Two pages share the title "Rapports & Exports Comptables".
- **S-27** Cashier sessions: green check on "Écart cumulé 0 MAD" with zero sessions (vacuous all-clear).
- **S-10** Homework: developer copy on screen ("Liste réelle du tenant", "données réelles", badge "Grand Livre Sync Enregistré"), button "+ + Créer un Devoir", "0 %" for 0/0.
- **S-11** Marksheet opened directly: no title, no link to the exam list it asks you to open. Grade entry empty state names "Évaluations" without a link (no nav item has that name).
- **S-12** Timetable: two near-identical "Générer … automatiquement" buttons; grid fixed to 2-hour blocks (Moroccan timetables are usually hourly).
- **S-13** Exam planning exists twice (Exam Master & Salles vs Planification / Épreuves & Calendrier).
- **S-14** Sidebar lists add-on modules the tenant has not enabled; clicking lands on entitlements.
- **S-15** Two director dashboards (Tableau de bord and Portail direction/Analytics) with overlapping KPIs; the IGP composite (40 % attendance, 30 % academics, 30 % finance, re-weighted when a pillar is missing) is unexplained on screen; invoiced total labelled "Objectif".
- **S-16** Academics index redirects the director to the teacher schedule.
- **S-17** Classes page copy "2 classe(s) réelle(s)"; Filière / Cycle empty for lycée classes.

## P3
- Payroll maker-checker blocks a single-admin school from ever approving a run; document the override path.
- Mention band letters T/B/A/P/I.

## Verified solid (code or screen)
- Pickup release: FOR UPDATE lock, one-time consumption, time window, audit.
- Inventory: never negative (locked availability check). Hostel and library: no double allocation / double loan. Transport: per-segment capacity with lock.
- Payroll: maker-checker enforced. Certificates: eligibility rules before issue.
- Add-on gating now redirects correctly on every locale-prefixed add-on route.
- Attendance excuses, results, classes, exam master: honest empty states.

## Additional P2 from the role / Arabic / phone passes

- **S-36** Phone invoices (`/finance/invoices`, 390 px) squeezes the desktop table: status column off-screen, "Exporter" clipped. Use the card layout the students list already uses.
- **S-37** Arabic: invoices, finance and students are well translated; the dashboard widgets, "Sécurité & urgence" and class names stay French; the brand renders "OSSchool" under RTL (wrap in `<bdi>`).

## Coding-agent prompt (copy-paste)

```
Precision pass from docs/audit/2026-09-23-deep-visual-sweep.md. Do not redesign pages that already work (students list, invoices, collection desk, dashboard layout). Each fix needs a test or a screenshot via scripts/visual-sweep.mjs.

P0-level truth
1 (S-1) Archive the 5 mock Communication pages (leads, segments, forms, milestones, templates-automation) to future-implementation/_archived-ui like earlier mocks. Extend scripts/check-ui-reality.ts to flag a client with no fetch that seeds state from an imported data/* module.
2 (S-18) Header CNDP badge: show real status from the CNDP registry (Non déposé / Déposé / Approuvé) or remove it.
3 (V-1) /api/accountant/me/home, /api/accountant/me/receivables, features/portal/services/portal-home.ts, api/students/route.ts:624 -> libs/finance/definitions.ts (overdue = past due only; balance = netAmount - paidAmount; collected = posted net of refunds; branch filter).
4 (S-4) academic-readiness.ts (and attendance-adapter:80, dashboard summary :626, super-admin/sms :74): zero denominator => "à configurer / bloqué", never 100 %.
5 (S-2) Dedicated at-risk endpoint for communication reminders (full list, class filter); never show "au vert" on fetch failure; make the send mode (simulation vs real) unambiguous.

Money / books
6 (S-3) Raise accounting_adapter_exceptions for skipped PAYMENT GL postings (as refunds now do); setup banner on accounting pages when no fiscal period exists; no "Équilibré" while source documents are unposted.
7 (S-19) Unique index on fine_assessments(tenant_id, invoice_id, fine_policy_id) + onConflictDoNothing; make an assessed fine billable (invoice line) so families and the cash desk see it.
8 (S-28) Receivables aging: "Non échu" bucket; no "Relancer SMS" for not-yet-due invoices.

Navigation / roles
9 (S-32) Sidebar permission = page requiredCapability (single source; see docs/audit/2026-09-23-nav-permission-mismatch.txt). Denials render an in-app "Accès refusé", never /${locale}. Remove the 2 dead links (class-subjects, class-section-teachers). Test: walk sidebar config vs page guards.
10 (S-35) Accountant can load class sections and semesters on the collection desk and fee structures.

Safety
11 (S-20) Emergency headcount = manual attendance + scans - exits for today.
12 (S-8) releaseStudent re-checks the live guardian link (active, canPickup) inside the transaction.

Grades / documents
13 (S-5) Report card generator: "—" and disabled print/PDF with no graded subject; term selector passing examTermId.
14 (S-9) Promotions: target session defaults to next year; "—" instead of 0 % with no marks; confirm disabled while decisions are pending; fix "Élèves évalués" label.

i18n
15 (S-6, S-33) Add the 134 missing keys (node scripts/check-missing-i18n-keys.mjs must exit 0); fix {capacity}/{type}/{count} formatting calls.

Return: check:types, check:isolation, vitest, check-missing-i18n-keys exit 0, and re-run
  AUDIT_BASE=... node scripts/visual-sweep.mjs school_admin <routes> ; teacher ; accountant
with zero redirects to /fr and zero raw keys.
```

## Acceptance gate (this sweep)

| Area | Verdict |
|---|---|
| Director core (students, attendance, invoices, collection desk, classes, results) | ACCEPTED WITH BACKLOG |
| Director dashboard + finance home | NEEDS CORRECTION (V-1, S-18) |
| Communication | BLOCKED (S-1 mock pages, S-2 false all-clear) |
| Accounting / general ledger | NEEDS CORRECTION (S-3) |
| Academics readiness / promotions / report cards | NEEDS CORRECTION (S-4, S-5, S-9) |
| Teacher portal navigation | NEEDS CORRECTION (S-32) |
| Accountant cash desk | NEEDS CORRECTION (S-35) |
| Gate / emergency | NEEDS CORRECTION (S-8, S-20) |
| Parent, student, guard, receptionist, librarian portals; add-on modules | NOT VERIFIED (no credentials / not enabled) |
