---
name: schoolos-fix-and-polish
description: Comprehensive playbook for diagnosing, debugging, fixing business logic bugs, resolving database constraint conflicts, polishing UI/UX issues, and implementing new features in SchoolOS. Enforces zero-downtime VPS deployment, 100% dynamic data, multi-tenant isolation, i18n/RTL parity, and automated quality gates.
version: 1.0.0
category: debugging-and-polish
tags: [schoolos, debugging, troubleshooting, ux-polish, business-logic, nextjs, drizzle, postgresql, vps-deployment, i18n]
---

# SchoolOS Fix & Polish: Master Troubleshooting & Implementation Skill

> **Mission**: Rapidly, safely, and systematically diagnose runtime errors, fix business logic flaws, repair database/relational discrepancies, elevate UI/UX interactions, and build new feature workflows across SchoolOS without regressing quality gates or causing remote VPS downtime.

---

## 🏛️ 1. Diagnostic Protocol: Pinpoint Before Patching

When an error, UX defect, or unexpected behavior is reported (e.g., HTTP 409, 401, 500, foreign key error, unclickable control):

### Step 1.1: Inspect the Full Error Surface
1. **Client Console & Network Response**:
   - Inspect the raw JSON payload: SchoolOS API errors use `{ success: false, error: { code, message, details } }`.
   - Never rely solely on `err.message` or `json.message`—always check `json.error?.message || json.message`.
2. **Server & Database Container Logs**:
   - If deploying to or testing against VPS (`43.157.17.129`), inspect remote container logs via SSH:
     ```bash
     ssh ubuntu@43.157.17.129 "docker logs --tail 100 schoolos-app"
     ssh ubuntu@43.157.17.129 "docker logs --tail 100 schoolos-db"
     ```
   - Identify the exact PostgreSQL error code:
     - `23503` (**foreign_key_violation**): A foreign key constraint was violated. (e.g., passing a `class_sections.id` where `classes.id` is expected, or referencing a non-existent student/user ID).
     - `23505` (**unique_violation**): A duplicate record or conflict occurred (e.g., duplicate matricule, code, or existing register).
     - `REGISTER_LOCKED` (**HTTP 409**): Attendance register or exam term is locked and requires an administrative reopen with an audit reason.
     - `403 FORBIDDEN`: Teacher attempting to mark students outside their assigned sections (`getTeacherClassSectionIds`) or missing role capability.

### Step 1.2: Relational Discrepancy Matrix
Always verify the entity level being passed between client and database:

| User Interface Concept | Section Level (`class_sections`) | Class Level (`classes`) | Notes & Resolution |
| :--- | :--- | :--- | :--- |
| **Student Roster** | `user.classSectionId` | Indirect via section | Students belong to sections. Query by `classSectionId`. |
| **Attendance Register** | Section selected in UI | `attendance_registers.class_id` | Foreign key references `classes.id`. **Resolve section to parent class!** |
| **Attendance Record** | Filtered by section | `attendance.student_group_id` | Foreign key references `classes.id`. Resolve section to parent class. |
| **Class Subjects** | Section offerings | `class_subjects.class_id` | Subjects belong to classes/streams. |

**Code Pattern for Section-to-Class Resolution**:
```ts
// In API routes or services accepting studentGroupId / classId:
let resolvedClassId = inputId;
if (resolvedClassId) {
  const [sec] = await db
    .select({ classId: classSections.classId })
    .from(classSections)
    .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, resolvedClassId)))
    .limit(1);
  if (sec?.classId) {
    resolvedClassId = sec.classId;
  }
}
```

---

## 🎨 2. UI/UX Polish Standards

Every interactive screen in SchoolOS must meet the following UX bar:

### 2.1 Zero Dead Controls
- Every `<Button>` or `<button>` element must have a functional `onClick`, `type="submit"`, link wrapper (`<Link href="...">`), or Radix trigger parent (`DialogTrigger`, `DropdownMenuTrigger`).
- Never leave decorative or phantom action buttons (e.g. unlinked `⋮` actions, non-functional filter tags, or fake export links).
- Run `npm run check:ui` to ensure dead controls count remains at or below the ratchet baseline.

### 2.2 Entity Lifecycle & Lock State Visibility
When a workflow involves state locks (e.g., Attendance Registers, Exam Terms, Fiscal Closings, Payroll Runs):
1. **Locked (`LOCKED`) State**:
   - Show a clear warning banner with reference number (`REG-...`), submission timestamp, and submitter name.
   - Disable input fields to prevent unauthorized edits.
   - For authorized administrators (`school_admin`, `super_admin`), display a *"Rouvrir"* (Reopen) button prompting for a mandatory audit justification.
2. **Reopened (`REOPENED`) State**:
   - Show an amber alert banner displaying the reopen reason.
   - Provide a mandatory `correctionNote` input field required for saving changes.
   - Saving resubmits with the correction note and transitions status cleanly back to locked.

### 2.3 Contextual Empty States (No Mock Screens)
- ❌ **Forbidden**: Hardcoded demo arrays (`DEFAULT_DEMO_*`, `MOCK_*`) when 0 records exist.
- ✅ **Mandatory**: When database returns 0 rows, render an informative empty state with:
  - An intuitive Lucide icon (e.g., `Users`, `BookOpen`, `Calendar`).
  - Clear heading explaining the table is empty.
  - Subtext explaining what records will appear here.
  - Primary CTA button taking the user directly to the creation action/wizard.

### 2.4 Error & Feedback Handling
- Never show raw technical exceptions (`Failed to fetch`, `[object Object]`).
- Display errors in styled `<Alert>` banners with `AlertTriangle` and an actionable retry button or clear remediation instruction.
- Provide affirmative feedback on successful mutations (e.g. green check banner, auto-dismissing toast, and immediate local state or query invalidation).

---

## 🌐 3. Moroccan Localization & i18n Invariants

Every string rendered to the user must maintain complete trilingual parity:
- English (`locales/en.json`)
- French (`locales/fr.json` - primary institutional administrative language)
- Arabic (`locales/ar.json` - official national language, strictly RTL)

### Rules:
1. **Never Hardcode Text in JSX**: Always use `useTranslations('Namespace')` or `getTranslations()`.
2. **Format Conventions**:
   - Currency: Moroccan Dirham (`MAD` or `DH`), formatted as `1 250,00 DH`.
   - Grades: Strict official Moroccan **/20 scale** (e.g. `15.50 / 20`), never percentage unless explicitly requested.
   - Telephone: Moroccan telecom prefix validation (`+212 6...` or `+212 7...`), GSM-7 compatible SMS templates.
   - Dates: French format (`DD/MM/YYYY`) or Arabic local formats.
3. **RTL Parity**:
   - Every server layout/page must declare `<main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>`.
   - Use logical CSS flex/grid spacing: `gap-x-*`, `start-*`, `end-*`, or conditional alignment.
4. **Verification**: Run `npm run check:i18n` before committing. Must report `0 missing keys found` and `0 invalid translations found`.

---

## 🔒 4. Multi-Tenant Safety & Moroccan Regulatory Compliance

### 4.1 Strict Row-Level Tenancy
- **The Golden Rule**: Every database query (`select`, `update`, `insert`, `delete`) modifying or fetching tenant data MUST include:
  ```ts
  eq(table.tenantId, ctx.tenantId)
  ```
- **Execution Pipeline**:
  ```
  requireRequestContext(req, [roles]) -> requireTenant(ctx) -> requireCapability(ctx, 'perm.action') -> Zod .strict() -> tenant-scoped Drizzle query -> recordAudit() -> apiErrorResponse()
  ```
- **Static Verification**: Run `npm run check:isolation`. It validates that all 799+ API route files correctly isolate tenant data and never bind `tenantId` from client body/query input.

### 4.2 CNDP Law 09-08 Compliance
- Maintain user privacy by redacting sensitive student/guardian PII from application logs.
- Audit all mutations with `recordAudit(context, action, entity, entityId, metadata)`.

---

## 🚀 5. Testing & Verification Quality Gates

Run these four mandatory checks before any production deployment:

```bash
# 1. TypeScript compilation (App Router + feature modules)
npm run check:types

# 2. i18n translation key parity across en, fr, ar
npm run check:i18n

# 3. UI reality check (dead controls, mock screens, unlinked pages, orphaned components)
npm run check:ui

# 4. Multi-tenant isolation static security audit
npm run check:isolation

# 5. Build/refresh Knowledge Graph after adding routes or features
npm run graph:build
```

---

## 🚢 6. Safe Production Deployment to VPS

### Invariants:
- **Host**: `43.157.17.129` (`https://schoolos.epioso.com`).
- **RAM Constraint**: 1,935 MB shared memory.
- **Strict Rule**: **NEVER run `npm run build` or build Docker images on the VPS host.**

### Deployment Command:
```powershell
# In lango-app directory:
npm run deploy:vps

# Or skip migration runner if only frontend/API code changed:
powershell -ExecutionPolicy Bypass -NoProfile -File ./scripts/deploy-to-vps.ps1 -SkipMigrate
```

### Automated Steps Performed by Deploy Script:
1. Validates local Docker Desktop and SSH key connectivity.
2. Executes local quality gates (`check:types`, `check:i18n`).
3. Builds release images locally for `linux/amd64` (`schoolos-app:latest` and optional `schoolos-migrate:latest`).
4. Gzip compresses archives and transfers via SCP to `~/releases/`.
5. Takes pre-deploy remote PostgreSQL snapshot (`backup-db.sh`).
6. Applies Drizzle migrations (if schema changed) and recreates container with zero downtime.
7. Verifies live health endpoint: `curl https://schoolos.epioso.com/api/health`.
