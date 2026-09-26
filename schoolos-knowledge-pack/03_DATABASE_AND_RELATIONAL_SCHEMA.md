# 🗄️ Database Schema & Relational Map

## 1. ORM Architecture & Schema Definition

SchoolOS uses **Drizzle ORM** configured on top of **PostgreSQL 16**.
- **Primary Schema File**: [`src/models/Schema.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/models/Schema.ts) (~8 400 lines, ~200 KB, fully typed).
- **Migration Directory**: `migrations/` managed by Drizzle Kit.
- **Migration Journal**: `migrations/meta/_journal.json` tracks **147 sequential migrations** (latest applied: migration 0146+).

---

## 2. Core Relational Clusters

```
                       ┌───────────────────────────────┐
                       │            tenants            │
                       │───────────────────────────────│
                       │ id (UUID, PK)                 │
                       │ name                          │
                       │ slug                          │
                       │ plan_tier (trial/basic/...)   │
                       └───────────────┬───────────────┘
                                       │ 1:N
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌───────────────┐              ┌───────────────┐              ┌───────────────┐
│     users     │              │   students    │              │  class_secs   │
│───────────────│              │───────────────│              │───────────────│
│ id (PK)       │              │ id (PK)       │              │ id (PK)       │
│ tenant_id(FK) │              │ tenant_id(FK) │              │ tenant_id(FK) │
│ role          │              │ matricule     │              │ class_id (FK) │
└───────┬───────┘              └───────┬───────┘              └───────┬───────┘
        │                              │                              │
        │ 1:N                          │ N:M                          │
        ▼                              ▼                              ▼
┌───────────────┐              ┌───────────────┐              ┌───────────────┐
│  audit_logs   │              │guardian_studs │              │  marksheets   │
└───────────────┘              └───────────────┘              └───────────────┘
```

---

## 3. Entity Domain Details

### 3.1 Tenancy & Auth Cluster
- **`tenants`**: Institution accounts. Holds name, slug, domain, plan tier, locale, timezone, contact details.
- **`users`**: System users (school admins, teachers, accountants, receptionists, parents, students, super admins).
- **`tenant_users`**: Mapping for users participating in multiple schools.
- **`communication_connections`**: Stores outbound provider credentials (SMS, WhatsApp, Email). Includes encrypted `config_json` holding API keys, URLs, and tenant-scoped session names.

### 3.2 Academics Cluster
- **`academic_years`**: e.g., 2025-2026, with active flag.
- **`streams` (Filières)**: Moroccan academic branches (Sciences Math, Sciences Exp, Lettres, Eco).
- **`classes` & `class_sections`**: Grade levels (e.g. 1ère Année Bac) and sections (Groupe A, Groupe B).
- **`subjects`**: Course catalog with Moroccan coefficient definitions.
- **`timetable_slots` & `timetable_versions`**: Weekly schedule grid linking teacher, subject, room, day of week, and time intervals.

### 3.3 Students & Guardians Cluster
- **`students`**: Master student record. Contains national Massar code, institutional matricule, DOB, gender, enrollment date, status (`active`, `transferred`, `alumni`).
- **`guardians`**: Legal parents/tutors. Contains phone, email, profession, CIN (national ID card number).
- **`guardian_students`**: Junction table mapping child to guardian with critical flags:
  - `is_primary` (⭐ Tuteur Principal / Financier)
  - `is_emergency_contact` (🛡️ Contact d'Urgence)
  - `relationship` (`father`, `mother`, `legal_guardian`)
- **`student_matricules`**: Incremental sequence tracker for generating collision-free matricules.

### 3.4 Assessment & Homework Cluster
- **`exam_terms`**: Trimesters/semesters with strict lifecycle stages (`draft`, `open`, `locked`, `published`).
- **`assessments`**: Individual evaluated events (Devoir surveillé, Contrôle continu, Examen de synthèse).
- **`assessment_results` & `assessment_result_details`**: The raw /20 grades, absences, teacher appreciations, and weighted semester averages.
- **`homework` & `homework_attempts`**: Digital homework assignments with file uploads and student submission timestamps.

### 3.5 Finance & Billing Cluster
- **`fee_structures` & `fee_structure_versions`**: Multi-tiered pricing models (tuition, transport, registration, cantine).
- **`invoices` & `invoice_items`**: Monthly student tuition statements with due dates and balances.
- **`payments` & `payment_allocations`**: Cash, check, direct debit, or online card transactions.
- **`receipts`**: Official signed fiscal receipts generated upon payment capture.
- **`cashier_sessions`**: Point of Sale sessions with open balance, cash collected, and closing reconciliation.
- **`accounts` & `journal_entries`**: Moroccan General Accounting double-entry bookkeeping ledger.

### 3.6 Workforce & Moroccan Payroll Cluster
- **`employees`**: Staff profiles, CIN, CNSS registration number, contract type (`cdi`, `cdd`, `anapec`, `vacataire`), base salary.
- **`payroll_runs`**: Monthly payroll batches (e.g., Mars 2026).
- **`payroll_run_lines`**: Itemized payslip calculations:
  - `gross_salary`
  - `cnss_employee` (capped at 6 000 DH threshold)
  - `amo_employee`
  - `ir_tax` (progressive net taxable calculation after dependent abatements)
  - `net_payable`
- **`salary_advances`**: Advance salary requests, approvals, and monthly amortization deductions.

### 3.7 Communication & Multi-Channel Messaging
- **`sms_messages`**: Central audit ledger of all outbound communications. Stores recipient phone, channel (`sms` or `whatsapp`), message body, delivery status (`sent`, `delivered`, `failed`, `simulated`), provider reference, and student link.

---

## 4. Query Safety & Multi-Tenant Partitioning Rules

Every database query in SchoolOS **must** be tenant-scoped:

```typescript
// 1. SELECT with tenant scoping
const student = await db.query.students.findFirst({
  where: and(
    eq(students.tenantId, ctx.tenantId),
    eq(students.id, studentId)
  ),
});

// 2. INSERT with tenant scoping
await db.insert(invoices).values({
  tenantId: ctx.tenantId,
  studentId,
  amount: 2500,
  status: 'pending',
});

// 3. UPDATE with tenant scoping
await db
  .update(students)
  .set({ status: 'active', updatedAt: new Date().toISOString() })
  .where(and(
    eq(students.tenantId, ctx.tenantId),
    eq(students.id, studentId)
  ));
```
