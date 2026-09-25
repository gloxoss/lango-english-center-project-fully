# ENH-ADMIN-DASH-01 — Manual Test Guide

**Base URL:** http://localhost:3455
**Login (all tests):** `y.elamrani@atlas.ma` / `Admin123!` (Direction / Admin)
**Note:** if a page looks stale, hard-refresh (Ctrl+Shift+R). The dev server on 3455 is kept running for you.

---

## MANUAL TEST 01 — MAIN DASHBOARD

Open: http://localhost:3455/fr/dashboard

Steps:
1. Log in as the Atlas school admin.
2. Wait for the dashboard to fully load.

Expected:
- Sidebar top shows **"Groupe Scolaire Atlas"** + logo + **"Propulsé par SchoolOS"** (not "SchoolOS / Plateforme Multi-tenant").
- Page is SHORTER and operational: Action Center → 4 KPI cards → Finance | Attendance week → Agenda | Payments → Absenteeism | Admissions.
- **No student-distribution ("Répartition des élèves") widget** on the daily page.

## MANUAL TEST 02 — BRANCH SWITCHING (P0)

Open: http://localhost:3455/fr/dashboard

Steps:
1. Open the branch selector in the TOP HEADER (pill "Toutes les succursales…" with building icon). Note: the page header has NO selector of its own — exactly ONE selector exists.
2. Select **Siège - Casablanca (ATL)**.

Expected (exact values):
| Metric | Siège | Annexe Maarif | Toutes |
|---|---|---|---|
| Élèves actifs | **149** | **51** | **200** |
| Impayés échus | **608 000 MAD · 30 factures · 30 familles** | **159 500 MAD · 10 factures · 10 familles** | **767 500 MAD · 40 factures · 40 familles** |
| Factures d'admission à examiner (notifications) | 10 | 3 | 13 |
| Classes sans pointage (action card) | 8–9 | 3 | 11–12 |
| Absentéisme total (footer link) | 6 | 2 | 8 |

3. Switch to **Annexe Maarif (BR-2)** → values become the Maarif column (NO reload needed; cards refresh in place).
4. Switch to **Toutes les succursales** → tenant-wide values; Siège+Maarif totals reconcile to the "Toutes" column.
5. No zeros anywhere (unless a metric is genuinely empty), no stale mixing, selector stays visibly set.

## MANUAL TEST 03 — GLOBAL SEARCH

Open: http://localhost:3455/fr/dashboard, click the header search, type **yousse**

Expected:
- Results grouped under **ÉLÈVES** with lines like "3ème A · ATL-2526-0109".
- Only Youssef* students (8 total; first 5 shown) — **no Anas/Ghita/Tarik results**.
- Footer link **"Voir tous les résultats"** → students list pre-filtered.

Seeded search values that must work:
- **yousse** → Youssef Belkadi (3ème A), Youssef Chraibi ×3 (different matricules), Youssef Rami, Youssef Idrissi, Youssef Alaoui, Youssef Lamrani
- **ATL-2526-0109** → Youssef Belkadi (matricule search)
- **BOUTAINA** or any teacher name → PERSONNEL group
- **yousse** while branch = Annexe Maarif → only the 2 Maarif Youssefs
- **zzzqqq** → "Aucun résultat pour « zzzqqq »"

## MANUAL TEST 04 — NOTIFICATION CENTER

Open: http://localhost:3455/fr/dashboard, click the bell (red badge shows the unread count).

Expected:
- Title **"Notifications"** with count badge.
- Groups: **À traiter** (real: "40 facture(s) en retard", "Pointage incomplet : 1/12 classes", "13 dossier(s) d'admission à examiner"), **Mises à jour** (real announcements), **Système** (only if failed SMS exist in last 7 days).
- Every item is click-through to its console. "Tout marquer comme lu" clears announcement unread state.
- No fabricated events; empty state if nothing needs attention.

## MANUAL TEST 05 — PROFILE MENU

Open the avatar menu (top-right).

Expected:
- Your session name **Yassine El Amrani**, email **y.elamrani@atlas.ma**, role badge **Direction / Admin**.
- **Paramètres de l'établissement** → opens Settings (works).
- **Déconnexion** → logs out.
- No "Mon profil" dead link (no personal-profile route exists today — documented product gap).

## MANUAL TEST 06 — ATTENDANCE BUSINESS TRUTH

Current state (someone marked 1 class today): Action center shows
- PRÉSENCES (orange): "11 présences non saisies / 11 classes terminées sans pointage"
- ASSIDUITÉ (neutral grey, badge "Pointage incomplet"): **"Pointage incomplet"** — NEVER green "Aucune absence injustifiée" while marking is unfinished.

To see the green state: complete the pointage of all 12 sections (Prise de Présence → mark all present) with zero unjustified absences → ASSIDUITÉ turns green "Aucune absence injustifiée".
To see the warning state: mark all classes with at least 1 unjustified absence → amber "N absences injustifiées".

Expected: the three states are mutually exclusive and truthful.

## MANUAL TEST 07 — FINANCE TRUTH

Expected labels on the dashboard:
- KPI card 3 = **"Encaissements reçus ce mois"** → actual posted cash receipts this month (1 438 500 MAD) with an honest **"24% vs mois précédent"** — **no 153% recovery figure**.
- Finance panel = **"Recouvrement des factures – 2026–2027"** with subtitle "Une seule cohorte de factures : les quatre montants se réconcilient." → Facturé 943 000 / **Encaissé sur ces factures** 713 000 / Restant dû 230 000 / Taux 75,6%.
- These two are DIFFERENT metrics and now clearly labeled: monthly cash ≠ invoice-cohort recovery. 713 000/943 000 = 75,6% exactly; rate can never exceed 100%.

## MANUAL TEST 08 — ATTENDANCE WEEK

"Présence cette semaine" panel.

Expected:
- No-class day (Dim): **"Pas de cours"**.
- Scheduled days without finished marking: **"Pointage incomplet"** chip (amber), not "—".
- Days with complete marking: real percentage.
- Under the summary: real chips — "2 retard(s) cette semaine", "11 classe(s) sans pointage aujourd'hui" — only facts backed by data.

## MANUAL TEST 09 — RECENT PAYMENTS

"Derniers règlements" panel.

Expected:
- Human dates: "11 sept. 2026 · 01:00" — **never "2026-09-11 00:00:00"**.
- Each row: student, class, payment method (Chèque/Virement), amount, date.
- Clicking a row opens the invoice detail (or the student page).

## MANUAL TEST 10 — ABSENTEEISM

"Absentéisme à surveiller" panel.

Expected:
- Explicit reason per row: **"0 cette semaine · 3 ce mois"** style (unjustified absences, week + month).
- Student + class shown. Badge "À surveiller" / "Critique".
- Rows and "Voir les N cas à surveiller" go to the attendance console. No vague AI score.

## MANUAL TEST 11 — ADMISSIONS WIDGET

"Admissions en attente" panel.

Expected:
- Action chips: "13 dossier(s) à examiner", "1 inscription(s) convertie(s) ce mois", interviews-today chip when any exist.
- Recent applicants with real statuses (Nouveau / Contacté / Qualifié).
- "Voir les admissions" → /dashboard/students/admissions (works).
- The old "Répartition des élèves" chart is gone from the daily page.

## MANUAL TEST 12 — MOBILE

Open: http://localhost:3455/fr/dashboard at 390px width (DevTools responsive mode).

Expected:
- Clean stacking, no horizontal overflow.
- Hamburger opens the drawer sidebar with the same tenant branding.
- Branch/search/notifications reachable; numbers readable; charts not broken.

## MANUAL TEST 13 — ARABIC RTL

Open: http://localhost:3455/ar/dashboard

Expected:
- Real RTL mirroring: sidebar on the right, cards and arrows mirrored.
- Sidebar shows **"Groupe Scolaire Atlas"** + **"مدعوم بـ SchoolOS"**.
- New dashboard strings translated: الأجندة، الغيابات المطلوب متابعتها، طلبات التسجيل المعلقة، المدفوعات الأخيرة، المقبوضات المستلمة هذا الشهر، نقطة التسجيل غير مكتملة…
- No clipped Arabic, no untranslated new strings, numbers readable.

## MANUAL TEST 14 — BRANCH-PINNED USER (permission)

Optional (needs a branch-pinned account): a pinned principal sees a **static branch pill with a lock icon** in the header — no menu, no "Toutes les succursales". Behaviour is safe but NOT uniform: the dashboard summary **rejects with 403** a pinned admin's request for another branch, while global search **silently returns only their own branch's results** (the requested branch is ignored). Both leak nothing.

---

**After testing:** report anything that doesn't match; the dev server stays on 3455.
