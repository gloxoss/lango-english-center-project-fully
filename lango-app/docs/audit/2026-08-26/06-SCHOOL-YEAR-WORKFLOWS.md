# SchoolOS — School Year Lifecycle End-to-End Execution Report (Task T11)

**Date:** 2026-08-27  
**Scope:** Full multi-tenant school year lifecycle from tenant provisioning to academic rollover  
**Environment:** Clean synthetic Moroccan tenant (`Lycée d'Excellence Al Khawarizmi`, Casablanca)  
**Automated Verification Suite:** `src/app/api/__tests__/school-year-lifecycle.test.ts`

---

## 1. Executive Summary

This document provides the definitive verification record and runbook for running a complete Moroccan K-12 school year lifecycle end-to-end within SchoolOS. Prior to this verification, individual subsystems (such as student admissions, attendance marking, or invoice generation) had been unit-tested in isolation, but no holistic end-to-end execution across the entire academic calendar had been documented.

The lifecycle execution was validated against official Moroccan Ministry of National Education (MEN) standards, including:
- **Trimester & Semester Calendar Structures:** `Semestre 1` (Sep–Jan) and `Semestre 2` (Feb–Jun).
- **Secondary Cycles & Streams:** `Tronc Commun Scientifique` (TC-SC) and `1ère Année Baccalauréat Sciences Expérimentales` (1BAC-SE).
- **Moroccan Grade Scale (/20):** Subject coefficients (Math: 7, PC: 5, SVT: 5, FR: 4, AR: 2, ANG: 2, PHIL: 2, EPS: 2; Total Coeff = 29), medical exemptions, ex-aequo competition ranking, and mention assignments (Très Bien, Bien, Assez Bien, Passable, Insuffisant).
- **Financial Double-Entry Reconciliation:** Itemized tuition & registration billing, cashier session management, and partial/full payment allocations.
- **Academic Rollover & Promotion Ledger:** Immutable promotion batch commitments, active placement updates, and historical transcript preservation.

---

## 2. End-to-End Workflow Architecture & State Transitions

```
+---------------------------------------------------------------------------------------------------+
|                                   PHASE 1: PROVISIONING & CALENDAR                                |
|  super_admin creates tenant -> Defines Session Years (2025-2026 & 2026-2027) -> Semesters S1/S2   |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                PHASE 2: ACADEMIC & STAFF STRUCTURE                                |
|  Mediums (FR/AR) -> Shifts -> Streams (TC-SC / 1BAC) -> Classes -> ClassSections -> Subjects      |
|  Assigns Moroccan Coefficients (Math: 7, PC: 5, SVT: 5...) -> Assigns Subject Teachers            |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 PHASE 3: ADMISSIONS & PLACEMENTS                                  |
|  Cohort Admissions -> Matricule Generation (2025-TCS-001..006) -> Guardian Links (+212 / CIN)    |
|  recordStudentPlacement() -> user.classSectionId & studentPlacements (isCurrent: true)            |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 PHASE 4: FEE SCHEDULING & CASHIER                                 |
|  Fee Structures -> Itemized Invoicing (3,500.00 MAD) -> Cashier Session Open                      |
|  Full Cash Payment (Amine) -> Partial Bank Transfer (Kenza) -> Unpaid (Omar) -> Cashier Close     |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                               PHASE 5: TIMETABLE & ATTENDANCE REGISTERS                           |
|  Attendance Registers Created -> Daily Roll Call (P/A/L/E) -> Medical Excuse Approval (Pediatric) |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                               PHASE 6: MOROCCAN GRADING ENGINE & COUNCIL                          |
|  Continuous Assessments (CC1, CC2, CC3) -> Weighted Subject Averages -> Medical Exemption (EPS)   |
|  calculateMoroccanAverage() -> Class Ranks (1..6) -> Deliberations: 5 Admis, 1 Redoublant         |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                PHASE 7: ACADEMIC ROLLOVER & PROMOTIONS                            |
|  POST /api/students/promotions -> promotionBatches (committed) -> promotionDecisions recorded      |
|  5 Promoted to 1BAC-SE-A (2026-2027) -> 1 Retained in TC-SC-A -> Historical Placements Closed     |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Milestone Verification

### 3.1 Milestone 1: Tenant & Academic Calendar Setup
- **Tenant:** `Lycée d'Excellence Al Khawarizmi` (Casablanca, Maroc).
- **Session Years:** `2025-2026` (`isDefault: true`, `2025-09-01` to `2026-06-30`) and `2026-2027` (`2026-09-01` to `2027-06-30`).
- **Semesters:**
  - `Semestre 1`: Months 9 to 1.
  - `Semestre 2`: Months 2 to 6.
- **Classes & Sections:**
  - Source class: `TC-SC` (`Section A`) with `mediumId: Français`, `cycle: lycee`.
  - Target promotion class: `1BAC-SE` (`Section A`).

### 3.2 Milestone 2: Moroccan Curriculum Subject Matrix
Official coefficients configured on `class_subjects` for `TC-SC`:

| Code | Subject Name | Type | Coefficient | Weekly Hours |
|---|---|---|---|---|
| `MATH` | Mathématiques | Theory | **7.00** | 6h |
| `PC` | Physique-Chimie | Practical | **5.00** | 4h |
| `SVT` | Sciences de la Vie et de la Terre | Practical | **5.00** | 4h |
| `FR` | Français | Theory | **4.00** | 4h |
| `AR` | Arabe | Theory | **2.00** | 2h |
| `ANG` | Anglais | Theory | **2.00** | 2h |
| `PHIL` | Philosophie | Theory | **2.00** | 2h |
| `EPS` | Éducation Physique et Sportive | Practical | **2.00** | 2h |
| **Total** | | | **29.00** | **26h** |

### 3.3 Milestone 3: Student Cohort Profiles & Enrollment
Six synthetic students admitted with structured matricules and Moroccan National Guardian details:

1. **Amine Bennani** (`2025-TCS-001`): Excellent student, top rank.
2. **Kenza El Idrissi** (`2025-TCS-002`): High-achieving student, approved medical excuse in S1.
3. **Youssef Alami** (`2025-TCS-003`): Solid consistent academic performance.
4. **Nadia Berrada** (`2025-TCS-004`): Medically exempt from Physical Education (`isExempt: true`), strong in STEM.
5. **Salma Tazi** (`2025-TCS-005`): Average performance, meets promotion threshold.
6. **Omar Chraibi** (`2025-TCS-006`): Academic difficulties, attendance gaps, retained for repetition.

### 3.4 Milestone 4: Financial Transactions & Cashier Reconciliation
- **Fee Structure:** `Frais de Scolarité Tronc Commun` (1,000.00 MAD Inscription + 2,500.00 MAD Mensualité = 3,500.00 MAD).
- **Invoices Issued:** 3 itemized invoices (`FAC-2025-001`, `FAC-2025-002`, `FAC-2025-003`).
- **Payments:**
  - Amine: Full payment of 3,500.00 MAD Cash -> `paid`, balance: 0.00 MAD.
  - Kenza: Partial payment of 2,000.00 MAD Virement -> `partially_paid`, balance: 1,500.00 MAD.
  - Omar: Unpaid -> `unpaid`, balance: 3,500.00 MAD.
- **Reconciliation:** `payment_allocations` sum matches exact receipts and invoice reduction.

### 3.5 Milestone 5: Attendance Registers & Medical Excuses
- Registers logged for `TC-SC-A` with individual student status rows.
- Kenza excused with pediatric medical certificate (`attendance_excuses.status = 'approved'`).
- Omar flagged with 3 unexcused absences and 2 lateness records.

### 3.6 Milestone 6: Moroccan Grade Engine Results & Class Ranking

```
Student Performance & Annual Council Deliberations:
========================================================================================
Rank  Student Name        S1 Moy   S2 Moy   Annuel   Mention       Council Decision
----------------------------------------------------------------------------------------
1     Amine Bennani       17.15    17.35    17.25    Très Bien     Admis (1BAC-SE)
2     Kenza El Idrissi    14.65    14.95    14.80    Bien          Admis (1BAC-SE)
3     Youssef Alami       12.95    13.25    13.10    Assez Bien    Admis (1BAC-SE)
4     Nadia Berrada*      12.60    12.90    12.75    Assez Bien    Admis (1BAC-SE)
5     Salma Tazi          10.30    10.50    10.40    Passable      Admis (1BAC-SE)
6     Omar Chraibi         8.10     8.20     8.15    Insuffisant   Autorisé à redoubler
========================================================================================
* Nadia Berrada: EPS exempted (total coefficients adjusted from 29.00 to 27.00).
```

### 3.7 Milestone 7: Academic Year Rollover Execution
- **Endpoint:** `POST /api/students/promotions` (School Admin authenticated).
- **Batch Record:** `promotion_batches` status = `'committed'`.
- **Decisions Recorded:** 6 rows in `promotion_decisions`.
- **Placement Transitions:**
  - 5 students promoted to `1BAC-SE` (`Section A`) in `2026-2027` with `isCurrent: true`.
  - 1 student (Omar) retained in `TC-SC` (`Section A`) in `2026-2027` with `isCurrent: true`.
  - 2025-2026 placements closed with `isCurrent: false` and `endDate: 2026-06-30`.
- **Transcript Preservation:** Historical marks, report cards, invoices, and attendance records from 2025-2026 remain queryable and immutable.

---

## 4. Verification Evidence & Quality Gates

1. **Automated Test Suite:** `src/app/api/__tests__/school-year-lifecycle.test.ts`
   - Verified: Tenant provisioning, curriculum coefficients, student placements, invoicing, cashiering, attendance excuses, Moroccan grade engine computations, and idempotent promotion batch commitment.
2. **TypeScript Compilation:** `npx tsc --noEmit` -> **Exit 0 (0 errors)**.
3. **Tenant Isolation AST Check:** `npx tsx scripts/check-tenant-isolation.ts` -> **Exit 0 (790 route files scanned, 0 leaks)**.
