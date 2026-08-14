# 📘 Master Operational & Business Logic Guide — Advanced Reporting Add-on

> **SchoolOS / Lango English Center Project**  
> **Status:** Active Add-on Module  
> **Target Audience:** School Administrators, Technical Leads, and System Operators  

---

## 📋 Table of Contents
1. [Architecture & Data Sourcing Flow](#1-architecture--data-sourcing-flow)
2. [Step-by-Step Manual Testing & Usage Guide](#2-step-by-step-manual-testing--usage-guide)
3. [Page Inventory & Expected Behaviors](#3-page-inventory--expected-behaviors)
4. [27 Core Reports Catalog Reference](#4-27-core-reports-catalog-reference)
5. [Business Logic Invariants & Security Defenses](#5-business-logic-invariants--security-defenses)

---

## 🔁 1. Architecture & Data Sourcing Flow

Advanced Reporting is a **governed decision platform**. Users do **NOT** enter data directly inside reporting pages. Instead, Advanced Reporting automatically reads live facts and historical snapshots from active operational modules across SchoolOS:

```
                  ┌─────────────────────────────────────────┐
                  │          OPERATIONAL MODULES            │
                  │ (Students, Attendance, Finance, HR...)  │
                  └────────────────────┬────────────────────┘
                                       │ Real-time & Snapshot Queries
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │         DOMAIN QUERY ADAPTERS           │
                  │ (StudentAdapter, AttendanceAdapter...) │
                  └────────────────────┬────────────────────┘
                                       │ Sanitized Data & Masks
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       ADVANCED REPORTING ADD-ON         │
                  │  (Preview, Run Engine, Exporters)       │
                  └─────────────────────────────────────────┘
```

### Data Sources by Operational Domain:
- **Élèves (Student)**: Sourced from `/api/students`, `/api/students/parents`, and `/api/admissions/inquiries`.
- **Présences (Attendance)**: Sourced from `/api/attendance/registers` and `/api/attendance/summary`.
- **Frais & Scolarité (Fees)**: Sourced from `/api/finance/invoices`, `/api/finance/payments`, and `/api/finance/reminders`.
- **Comptabilité (Financial)**: Sourced from double-entry general ledger journals (`/api/finance/journals` & `/api/finance/chart-of-accounts`).
- **Examens (Examination)**: Sourced from published assessment result snapshots (`/api/students/report-card`).
- **Ressources Humaines (HR)**: Sourced from `/api/hr/payroll/periods` and `/api/hr/leave/requests`.
- **Stocks & Inventaire (Inventory)**: Sourced from item stock ledgers and purchase/issue movement receipts.

---

## 🛠️ 2. Step-by-Step Manual Testing & Usage Guide

### Step 1: Browse & Star Reports in the Report Center
1. Open your browser and navigate to **`http://localhost:3000/fr/dashboard/reports`** (or click **Rapports & Analytics** in the sidebar).
2. Filter reports by domain using the top filter pills (*Tous les domaines*, *Élèves*, *Présences*, *Frais & Scolarité*, *Comptabilité*, *Examens*, *Ressources Humaines*, *Stocks*).
3. Search for any report title or keyword (e.g. `"Identifiants"`, `"Balance"`, `"Paie"`).
4. Click the **Star icon (⭐)** on any catalog card to toggle it as a favorite.
5. Click the **"Mes Favoris"** tab to view your starred reports in 1 click.

### Step 2: Configure Parameters & Aperçu in the Report Workspace
1. Click **Ouvrir →** on any ready report card (e.g. `http://localhost:3000/fr/dashboard/reports/student.credentials`).
2. Adjust your report parameters (e.g. Statut du Compte: *Tous* / *Actif* / *Inactif*, Date Début, Date Fin).
3. Click **Aperçu (50 lignes)**.
4. Verify that:
   - A fast $<100\text{ms}$ preview data table renders below with paginated rows.
   - An interactive Recharts bar graph displays quantitative distribution metrics.

### Step 3: Run Asynchronous Full Report & Export
1. Click **Lancer le Rapport (Complet)**.
2. Select your desired export format:
   - 📄 **CSV**: Raw tabular text with formula injection protection.
   - 📊 **Excel (XLSX)**: Formatted SpreadsheetML file with styled table headers.
   - 📑 **PDF**: Printable HTML document formatted with SchoolOS tenant headers.
3. The background **Run Engine** queues the execution asynchronously without freezing your browser.

### Step 4: Monitor & Download in "Mes Exécutions"
1. Navigate to **`http://localhost:3000/fr/dashboard/reports/runs`**.
2. Observe execution status transitions: `queued` $\rightarrow$ `running` $\rightarrow$ `completed`.
3. Click **Télécharger** to receive your exported artifact via a cryptographically signed, 24-hour expiring URL.

---

## 🖥️ 3. Page Inventory & Expected Behaviors

| Page Workspace | Route URL | Expected UI & Features |
|---|---|---|
| **Centre de Rapports** | `/dashboard/reports` | Catalog grid of 27 reports, French domain filter tabs, search toolbar, readiness badges, and interactive Favorites star toggling. |
| **Workspace de Rapport** | `/dashboard/reports/[key]` | Dynamic parameter form, live Recharts bar visualizer, 50-row preview table, and CSV/XLSX/PDF export triggers. |
| **Mes Exécutions** | `/dashboard/reports/runs` | Execution queue history listing run IDs, execution duration (ms), row counts, status badges, and signed download buttons. |
| **Planifications** | `/dashboard/reports/schedules` | Automated recurring delivery workspace displaying cron schedules, output formats, recipient lists, and active/suspended toggles. |
| **Console Admin** | `/dashboard/reports/admin` | Governance dashboard displaying artifact storage quotas, slow queries log, definition readiness matrix, and projection watermarks. |

---

## 📚 4. 27 Core Reports Catalog Reference

### 1. Student Reports (`Student`)
- **`student.credentials`**: Login Credential Status (masked emails, zero plain passwords/secrets).
- **`student.admission_funnel`**: Admission Conversion Funnel (inquiries $\rightarrow$ interviews $\rightarrow$ enrolled).
- **`student.class_section_occupancy`**: Class & Section Occupancy Rates (capacity vs. actual placement).
- **`student.sibling_distribution`**: Household & Sibling Distribution (grouped by explicit guardian links).

### 2. Attendance Reports (`Attendance`)
- **`attendance.student_log`**: Detailed Student Attendance Log (status, late minutes, excuse notes).
- **`attendance.daily_matrix`**: Daily Attendance Matrix (date $\times$ class register status grid).
- **`attendance.overview_streaks`**: Student Attendance Overview & Streaks (total scheduled registers as denominator).
- **`attendance.employee_summary`**: Employee Time & Attendance Summary.
- **`attendance.exam_sessions`**: Exam Room Attendance Log.

### 3. Fees Reports (`Fees`)
- **`fees.summary`**: Invoiced vs. Collected Fees Summary (gross, discounts, net paid).
- **`fees.cashier_receipts`**: Cashier Receipts Journal (posted payments by payment method/cashier).
- **`fees.due_aging`**: Receivables Aging Report (Current, 1–30, 31–60, 61–90, 90+ days).
- **`fees.fines_log`**: Assessed & Waived Fines Log.

### 4. Financial Reports (`Financial`)
- **`financial.account_statement`**: General Ledger Account Statement (opening, running, closing balances).
- **`financial.income_expense`**: Periodic Income & Expense Breakdown.
- **`financial.transactions`**: Journal Voucher Transactions Log.
- **`financial.balance_sheet`**: Balance Sheet ($\text{Assets} = \text{Liabilities} + \text{Equity}$).
- **`financial.income_vs_expense`**: Income vs. Expense Net Result.

### 5. Examination Reports (`Examination`)
- **`examination.report_card_snapshot`**: Official Report Card Snapshots (SHA-256 integrity checksum).
- **`examination.tabulation_sheet`**: Class Tabulation Sheet (candidates $\times$ subject marks grid).
- **`examination.progress_trends`**: Academic Progress & Trend Analysis.

### 6. Human Resource Reports (`HR`)
- **`hr.payroll_summary`**: Payroll Summary ($< 3$ staff salary suppression).
- **`hr.leave_balances`**: Staff Leave Entitlements & Balances.

### 7. Inventory Reports (`Inventory`)
- **`inventory.stock_valuation`**: Stock Valuation & On-Hand Inventory.
- **`inventory.purchase_orders`**: Purchase Orders & Supplier Receipts.
- **`inventory.sales_revenue`**: Item Sales & Revenue Analysis.
- **`inventory.equipment_custody`**: Equipment Loans & Custody Tracking.

---

## 🔒 5. Business Logic Invariants & Security Defenses

1. **CNDP Data Privacy & Secret Masking**:
   - Email addresses in credential reports are masked (`ya***@gmail.com`) and plain passwords/secrets are strictly excluded.
   - HR payroll summaries automatically suppress individual salary breakdowns for department groups with $< 3$ staff members to comply with privacy regulations.

2. **Accounting Ledger Balance Sheet Invariant**:
   - Balance Sheet reports evaluate double-entry journal lines, guaranteeing:
     $$\text{Assets} = \text{Liabilities} + \text{Equity}$$

3. **Attendance Denominator Accuracy**:
   - Attendance overview streak reports evaluate rates using **total scheduled registers as the denominator**, ensuring missing registers never falsely inflate presence percentages.

4. **CSV Formula Injection Defense**:
   - Tabular export values starting with `=`, `+`, `-`, or `@` are automatically prefixed with `'` to prevent Remote Code Execution (RCE) in Microsoft Excel.

5. **Cryptographic Signed Download Links**:
   - Exported artifacts generated by the Run Engine are assigned a unique HMAC SHA-256 token valid for 24 hours. Verification uses `crypto.timingSafeEqual` to prevent timing side-channel attacks.
