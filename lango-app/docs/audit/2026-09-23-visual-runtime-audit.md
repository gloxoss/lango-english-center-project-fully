# SchoolOS visual runtime audit — Wave 1 (school director) + teacher

Date: 2026-09-23 (00:00–01:00 Casablanca) · Mode 3 (post-implementation cross-check) with real screenshots · Server: the other agent's dev server `http://localhost:3111`, seed tenant "Groupe Scolaire Atlas" (6 students) · Capture: `scripts/visual-capture.mjs` (read-only, never clicks) · Evidence: `docs/audit/2026-09-23-shots/`

Covered: `/dashboard`, `/dashboard/academics/exams`, `/dashboard/academics/grading/policies`, `/dashboard/students`, `/dashboard/attendance`, `/dashboard/finance`, `/dashboard/finance/collection-desk` (desktop 1440, phone 390, Arabic), teacher home, accountant finance.
Not covered: **parent and student portals** — the only seeded parent (`karim.amrani@email.com`) has no password and the audit does not write data.

## 1. Executive diagnosis

The fixed pages now tell the truth on screen: the exams page shows an honest empty state instead of mock exams, the grading page says which rules are applied, phone layouts turn tables into cards with no horizontal scroll, and Arabic mirrors correctly.

The biggest remaining risk is **two finance screens disagreeing about money**. The director dashboard says **3 000 MAD overdue (1 invoice)**; the finance home says **"Créances en retard 6 000 MAD (2 factures)"**. The finance home runs on a separate summary (`/api/accountant/me/home`) that never received the pass-1 finance definitions.

Second: **Arabic is mostly French.** The layout flips, but dashboard cards, headings and CTAs stay French, and numbers jump sides.

Third: **teachers can list every family's contact details in the school** (CNDP data minimisation).

## 2. What works (seen on screen)

- Dashboard: Action Center → KPIs → finance / attendance split; bounded lists; honest "Aucun événement" empty state; phone keeps priority order.
- Dashboard numbers reconcile with each other: 9 000 invoiced, 3 000 collected, 6 000 remaining, 33.3 %; distribution 5 + 1 = 6 active students.
- Exams: no mock data; empty state with "Planifier un examen".
- Grading policy: amber notice "Seuil + note éliminatoire appliqués… pondérations pas encore appliquées".
- Students list: KPI cards, guardian verification badges ("À confirmer"), finance status per student; phone view uses cards.
- Collection desk: payment blocked until a cash session is opened, stated clearly.
- No page scrolls horizontally on a 390 px phone.

## 3. Findings

### P0

**V-1 · Finance home and dashboard contradict each other on overdue money** (`/dashboard/finance` vs `/dashboard`)
- Screen: dashboard "Impayés échus 3 000 MAD · 1 facture"; finance home "Créances en retard 6 000 MAD · 2 factures impayées à relancer".
- Code: `src/app/api/accountant/me/home/route.ts:36-46` counts every `pending|overdue|partial` invoice as overdue with **no due-date check**, sums `invoices.amount` (gross, ignores discounts) instead of `netAmount`, and "Encaissements aujourd'hui" (`:20-32`) sums payments of **any status** (refunded / reversed included). No branch filter.
- Same wrong definitions in: `api/accountant/me/receivables/route.ts:27,38`, `features/portal/services/portal-home.ts:91-94,118-121`, and `api/students/route.ts:624` (`NOT IN ('paid','cancelled','draft')` still counts **credited** invoices as overdue).
- Fix: route all four through `libs/finance/definitions.ts` (`overdueInvoiceCondition`, `invoicedInvoiceCondition`, `collectedPaymentCondition` + `netCollectedSumSql`), balance = `netAmount − paidAmount`, add `context.branchId` filter. Test: the same seed gives the same overdue amount and count on both screens.

### P1

**V-2 · Arabic dashboard is ~80 % French, with bidi breaks** (`/ar/dashboard`, screenshot `school_admin-dashboard-ar.png`)
- Headings, Action Center, KPI labels, finance chart, "Derniers règlements", "À venir", "Répartition" are French under `dir=rtl`.
- Numbers flip: "factures en retard 1", "1 1 فاتورة", logo reads "OSSchool".
- Fix: extract the dashboard widgets' remaining strings to `locales/ar.json`; wrap the brand and mixed number+word runs in `<bdi>` / `dir="auto"`.

**V-3 · Teachers can read every family's contact data** (`GET /api/students/parents`)
- Teacher sidebar shows "Parents & Tuteurs". The route allows `teacher` and selects full guardian rows (`.select()`) with no restriction to the teacher's own classes.
- Fix: for `teacher`, restrict to guardians of students in sections the teacher teaches, and project name + relationship + phone only (no email / national id / address). Test with a teacher of 2nde A who must not see 1ère B families.
- Note: this file was being edited by the other agent at 23:25; coordinate.

**V-4 · Grading policy page implies per-class policy** (`/dashboard/academics/grading/policies`)
- Cycle / class / semester dropdowns ("Secondaire Qualifiant (BAC)", "2nde", "Semestre 1") sit above rules that save **school-wide**. The green "Pondération globale 100 % (Valide ✓)" badge highlights weights that are not applied.
- Fix: remove or disable the three selectors on the weights tab (keep them for the coefficients tab where they matter), and make the badge neutral until weights are applied.

**V-5 · Dashboard copy bugs a director will notice**
- "Impayés échus … **1 1 facture · 1 1 famille**" (count rendered twice), "**1 factures** en retard", "**1 retards**" (no singular).
- "Derniers règlements": raw timestamp `2026-09-22 12:57:10.70146` and the English word `transfer`.
- Fix: ICU plural messages; format date with the locale; translate payment methods.

### P2

- **V-6 · "Today" computed in UTC in 32 API routes** (e.g. `accountant/me/home:17`), and the attendance date picker defaulted to 09/22 at 00:58 Casablanca time. Between 00:00 and 01:00 every night "today" is yesterday; weekly chart labels shifted ("Mer 22/09"). Use an `Africa/Casablanca` today helper everywhere.
- **V-7 · Exams page copy claims activity with zero data**: "0 Sessions — Période d'examen en cours", "0 Enseignants — Planning de garde validé"; "Imprimer les plans de table" enabled with nothing to print.
- **V-8 · Navigation overload / duplicates**: Notes & Évaluations has "Exam Master & Salles", "Planification des Épreuves", "Épreuves & Calendrier"; Finance has 10+ entries incl. "Caisse & Encaissements" and "Encaisser Paiement".
- **V-9 · Two matricule formats in one list**: `STD-2026-0042` and `AAM-2425-0001`; the matricule wraps on 3 lines in the table.
- **V-10 · Likely duplicate student**: "Salma Benjelloun-5728" and "Salma Benjelloun", same guardian and phone (probably a test fixture leaking into the dev DB; the admission duplicate-warning should still flag it).
- **V-11 · Untranslated relationship tag** "mother" next to "Parent" in the French UI.
- **V-12 · Phone dashboard puts the green all-clear card above the two real problems**; order Action Center cards by severity.
- **V-13 · Every page for non-super-admins fires `403 /api/super-admin/tenant-context`** (impersonation banner) and teachers/accountants fire `403 /api/guard/emergency/procedures`; call only for the right role.

### P3
- Teacher/accountant headers show the branch selector and "Conformité CNDP F211" badge, which mean nothing to them.
- Mention band letters "T/B/A/P/I" ("A" = Assez Bien) are not a Moroccan convention.

## 4. Report vs runtime

| Earlier claim | Runtime evidence | Verdict |
|---|---|---|
| Finance totals unified via `definitions.ts` (pass 1) | Finance home 6 000 vs dashboard 3 000 overdue | Contradiction (V-1) |
| Exam mocks removed | Honest empty state | Confirmed |
| Grading policy saved server-side, notice shown | Notice visible; selectors still suggest per-class | Confirmed, with V-4 |
| i18n / Arabic considered | Arabic dashboard mostly French | Not met (V-2) |
| Scanner/parent pages | Not reachable (no parent credentials in seed) | Unverified |

## 5. Coding-agent prompt (copy-paste)

```
Precision pass from the visual runtime audit (docs/audit/2026-09-23-visual-runtime-audit.md). Do not redesign any page. Keep the dashboard layout, exams empty state, students list and phone card views exactly as they are.

1 (P0) One finance truth. Route these through src/libs/finance/definitions.ts:
   - src/app/api/accountant/me/home/route.ts (overdue = overdueInvoiceCondition with today; balance = netAmount - paidAmount; collected today = collectedPaymentCondition + netCollectedSumSql; add context.branchId filter)
   - src/app/api/accountant/me/receivables/route.ts
   - src/features/portal/services/portal-home.ts (both queries)
   - src/app/api/students/route.ts:624 (credited must not be overdue)
   Test: with one invoice past due (3000) and one not yet due (3000), dashboard and /api/accountant/me/home both return overdue 3000 / count 1.

2 (P1) Arabic dashboard: move every remaining French string in the dashboard widgets to locales (fr/en/ar); <bdi> around the brand and number+word runs. Screenshot /ar/dashboard.

3 (P1) GET /api/students/parents for role teacher: only guardians of students in sections the teacher teaches; project name, relationship, phone only. Test: teacher of 2nde A cannot see a 1ère B guardian.

4 (P1) Grading policy weights tab: remove/disable cycle/class/semester selectors; neutral badge while weights are not applied.

5 (P1) Dashboard copy: ICU plurals ("1 facture", "2 factures", "1 retard"); fix the doubled count "1 1 facture · 1 1 famille"; format payment dates by locale; translate payment method labels.

6 (P2) Add a Casablanca "today" helper (Intl, timeZone 'Africa/Casablanca') and replace new Date().toISOString().slice(0,10)/split('T')[0] in API routes and the attendance date default.

7 (P2) Exams KPI subtitles must not claim activity at zero; disable "Imprimer les plans de table" when there is nothing to print.

8 (P2) Call /api/super-admin/tenant-context only for super_admin; /api/guard/emergency/procedures only for roles that use it.

Return: overdue amount + count from both endpoints on the same seed; screenshots of /fr/dashboard, /ar/dashboard, /fr/dashboard/finance (desktop + 390 px) via scripts/visual-capture.mjs; check:types, check:isolation, vitest.
```

## 6. Acceptance gate

| Page | Verdict |
|---|---|
| `/dashboard` | NEEDS CORRECTION (V-1 contradiction lives across screens, V-2, V-5) |
| `/dashboard/finance` | NEEDS CORRECTION (V-1) |
| `/dashboard/academics/exams` | ACCEPTED WITH BACKLOG (V-7, V-8) |
| `/dashboard/academics/grading/policies` | NEEDS CORRECTION (V-4) |
| `/dashboard/students` | ACCEPTED WITH BACKLOG (V-9, V-10, V-11) |
| `/dashboard/attendance` | ACCEPTED WITH BACKLOG (V-6) |
| `/dashboard/finance/collection-desk` | ACCEPTED |
| Teacher home | ACCEPTED WITH BACKLOG; V-3 blocks the Parents & Tuteurs page for teachers |
| Parent / student portals | NOT VERIFIED (no credentials in seed) |
