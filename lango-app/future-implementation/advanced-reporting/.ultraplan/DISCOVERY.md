# UltraPlan Discovery — Advanced Reporting Add-on

## Project Idea
Build an enterprise-grade, governed Advanced Reporting Add-on for the Lango English Center platform (`lango-app`), covering catalog management, cross-module navigation, parameter validation, asynchronous CSV/XLSX/PDF exports, immutable period snapshots, scheduled background delivery, projection watermarks, and domain-specific operational & statutory reports (Student, Fees, Financial, Attendance, HR, Examination, Inventory).

## Codebase Context
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, React 19, Recharts.
- **ORM & DB:** Drizzle ORM, PostgreSQL (via Docker `db` container), migration runner (`migrations/*.sql`).
- **Addon System:** `src/addons/registry.ts`, entitlement check `requireAddon('advanced-reporting')` in `src/libs/api/entitlements.ts`.
- **Authorization:** Role-based access control with `requireCapability()`, `PermissionKey` union in `src/libs/api/permissions.ts`.

## Key Discovery Q&A

### 1. Core Requirements
- **Q:** What is the primary purpose of the Advanced Reporting Add-on?
  - **A:** Provide a governed, central catalog for cross-module operational reporting, background exports, snapshotting, and scheduled delivery without bypassing domain permissions or introducing ungoverned client-side raw SQL.
- **Q:** What happens if a domain module (e.g. HR or Inventory) is not installed?
  - **A:** Its reports remain visibly `not_ready` in the catalog with a readiness badge explaining missing contracts. Mock data is never shown.

### 2. User & Access Context
- **Q:** Who accesses report outputs?
  - **A:** School Leadership, Accountants, HR Managers, Teachers, Admissions Staff, and Guardians (portal-safe subset).
- **Q:** How are report outputs restricted per user?
  - **A:** Base capabilities (`reporting.catalog.read`, `reporting.run`, `reporting.export`, `reporting.schedule`, `reporting.admin`) plus domain-level row/field checks. Guardians and students only see pre-filtered portal-safe snapshots of their household/self.

### 3. Integration & Data Strategy
- **Q:** How are operational vs closed-period reports executed?
  - **A:** Operational queries run against live indexed tables with strict limits. Statutory/period outputs (report cards, closed balance sheets, payroll summaries) query immutable `report_snapshots` with source watermarks.
- **Q:** How are exports delivered and rendered?
  - **A:** Small preview results stream to JSON. Heavy exports (CSV/XLSX/PDF) run asynchronously via background queue, stored in private object storage, with signed expiring download links.

### 4. Security & Compliance
- **Q:** How is PII and sensitive data handled in reports?
  - **A:** Credentials, passwords, and password hashes are never exported. Salary/person-level HR data enforces minimum-group suppression to prevent disclosure. CSV/XLSX exports sanitize spreadsheet formula injection (e.g. escaping leading `=`, `+`, `-`, `@`).

### 5. Delivery & Performance
- **Q:** What safety guards exist for expensive queries?
  - **A:** Query execution timeouts (30s max), concurrency quotas, row limits (max 50,000 rows per export), and projection freshness watermarks.

## Discovery Summary
- 9 categories evaluated.
- Architectural boundary established: curated operational reports first; self-service BI deferred to future phases.
- Zero mock totals allowed; domain readiness enforced.
