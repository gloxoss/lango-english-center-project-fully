# STU-PORTAL-02: Runtime Sweep & Consistency Report (Section S7-02)

**Date:** 2026-09-25  
**Actor:** `antigravity-stu-1`  
**Logged-in User:** `etudiant.0001@atlas.ma` (`STU-0001`, Sabrine Jbilou)  
**Host & Port:** `http://localhost:3111` (Trusted auth origin)  
**Target View:** Student Portal (`/fr/dashboard/student` and `/ar/dashboard/student`)  
**Screenshots Path:** `artifacts/product-enhancements/STU-PORTAL-02/screenshots/`

---

## 1. Contradictions & Consistency Verification Matrix

| Data Dimension | Aujourd'hui Tab Card | Dedicated Tab | Issued PDF Document | Verification Status |
|---|---|---|---|---|
| **Next Exam Title** | `Examen – Français (3ème)` | `Examen – Français (3ème)` (Examens tab, upcoming) | N/A | **Consistent (Match)** |
| **Next Exam Date & Time** | `Oct 10 · 05:58 PM–07:58 PM` | `Oct 10 · 05:58 PM–07:58 PM` | N/A | **Consistent (Match)** |
| **Next Exam Hall & Seat** | `Salle 1 · Place n°1` | `Salle 1` · `Place n°1` (Desk D1, Cand. CND-0001) | N/A | **Consistent (Match)** |
| **Latest Published Grade** | `Français: 16 / 20` | `Français: 16 / 20` (Notes tab, grouped by subject) | `Français: 16.00 / 20` | **Consistent (Match)** |
| **Provisional Subject Avg** | `16 / 20` (derived from latest) | `16/20` (Matières tab: Français) | `16.00 / 20` (Subject average) | **Consistent (Match)** |
| **Next Homework Title** | `Compte-rendu de TP : Conductivité...` | `Compte-rendu de TP : Conductivité...` (Devoirs tab) | N/A | **Consistent (Match)** |
| **Next Homework Due Date** | `Oct 5, 2026` | `Oct 5, 2026` (`closeAt: 2026-10-05T17:58:02Z`) | N/A | **Consistent (Match)** |
| **Open Homework Count** | 2 open homework items total | 1 Mathématiques, 1 Physique-Chimie (Matières tab) | N/A | **Consistent (Match)** |
| **Report Card Term Label** | N/A | `Bulletin scolaire` (3ème A) | `Bulletin scolaire` (3ème A) | **Consistent (Match)** |
| **Report Card Average** | N/A | `16 / 20` (Bulletins tab card) | `16.00 / 20` | **Consistent (Match)** |
| **Report Card Rank** | N/A | `4 / 17` (Bulletins tab card) | `4 / 17` | **Consistent (Match)** |
| **Report Card Mention** | N/A | `Très Bien` | `Très Bien` | **Consistent (Match)** |
| **Report Card Decision** | N/A | `Admis` | `Admis` | **Consistent (Match)** |
| **PDF Download Response** | N/A | Triggered via button "Télécharger le PDF" | HTTP 200 `application/pdf` (7,256 B) | **Consistent (Match)** |

**Contradictions Found:** **0**. All values match across cards, tabs, and rendered PDF snapshots.

---

## 2. Screenshot Manifest

### Desktop Suite (1280x900, French)
- `01-desktop-01-today.png`: Aujourd'hui tab displaying 3 top stats widgets (1 séance, 10 matières, 8 pointages), 3 interactive summary cards (Prochain examen, Dernière note publiée, Devoir à rendre), today's timetable slot, and announcements.
- `01-desktop-02-timetable.png`: Emploi du temps tab showing weekly Monday–Sunday grid with allocated rooms and teachers.
- `01-desktop-03-subjects.png`: Mes matières tab showing 10 subjects with teachers, coefficients, open homework badges, and provisional averages.
- `01-desktop-04-grades.png`: Notes tab grouping published results by subject with scores, status badges, and evaluation types.
- `01-desktop-05-exams.png`: Examens tab showing upcoming exam with hall and seat allocation, and online exams list.
- `01-desktop-06-homework.png`: Devoirs tab showing 2 active homework cards with deadlines, submission status, and instructions.
- `01-desktop-07-reportcards.png`: Bulletins tab showing official issued report card card (16/20, Rang 4/17, Très Bien, Admis) with "Télécharger le PDF" button.
- `01-desktop-08-attendance.png`: Présences tab showing 100% attendance rate, 8 present records, and summary chips.

### Mobile Suite (390x844, French)
- `02-mobile-today.png`: Compact mobile layout with stacked summary cards, touch targets >= 44px, and scrollable tab bar.
- `02-mobile-timetable.png`: Mobile timetable view with day accordion/cards.
- `02-mobile-subjects.png`: Mobile subjects list with clear coefficients and status badges.
- `02-mobile-grades.png`: Mobile grades list with /20 scores and status indicators.
- `02-mobile-exams.png`: Mobile exams view with seat number and hall badge.
- `02-mobile-homework.png`: Mobile homework cards with action buttons.
- `02-mobile-reportCards.png`: Mobile bulletin card with prominent download button.
- `02-mobile-attendance.png`: Mobile attendance pointages.

### Arabic RTL Suite (Arabic, Desktop & Mobile)
- `03-rtl-desktop-today.png`: Full RTL mirrored desktop view (sidebar on right, right-to-left tab navigation, mirrored cards and icons).
- `03-rtl-desktop-grades.png`: RTL grades list (النقط والتقييمات).
- `03-rtl-desktop-exams.png`: RTL exams list (الامتحانات).
- `03-rtl-desktop-homework.png`: RTL homework list (الواجبات المنزلية).
- `03-rtl-desktop-reportcards.png`: RTL report cards view (بيانات النقط).
- `04-rtl-mobile-today.png`: RTL mobile view at 390px.
