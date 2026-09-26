# 🏛️ Architecture & System Invariants

## 1. Multi-Tenant Isolation Invariants

### 1.1 Row-Level Multi-Tenancy Architecture
SchoolOS uses a shared-database, row-level partitioning model. Every tenant (private school, learning center, or educational group) operates within the same PostgreSQL instance, isolated strictly by `tenant_id` (`tenants.id`).

```
                    ┌───────────────────────────────┐
                    │      HTTP Inbound Request     │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     requireRequestContext     │  <-- Authenticates JWT & Role
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │         requireTenant         │  <-- Extracts & validates tenantId
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       requireCapability       │  <-- Verifies RBAC / permissions
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Zod .strict() Schema     │  <-- Validates payload, strips extras
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Drizzle Tenant-Scoped Query  │  <-- eq(table.tenantId, ctx.tenantId)
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │          recordAudit          │  <-- Law 09-08 compliant audit trail
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   apiSuccess / apiErrorResp   │  <-- Standardized JSON response
                    └───────────────────────────────┘
```

### 1.2 Mandatory Tenancy Code Invariants
1. **Never Trust Client Tenant ID**: No route may ever read `tenantId` from request bodies, URL query parameters, or route params. It **must strictly be resolved** from the authenticated server session via `requireTenant(ctx)`.
2. **Mandatory Tenant Filtering in Drizzle**:
   ```typescript
   // Correct pattern:
   const rows = await db
     .select()
     .from(students)
     .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

   // FORBIDDEN pattern (causes cross-tenant data leak):
   const rows = await db.select().from(students).where(eq(students.id, studentId));
   ```
3. **Automated Static Gate Enforcement**: The repository runs `scripts/check-tenant-isolation.ts` on every build. Any query or mutation on tenant-scoped tables lacking an explicit `tenantId` filter fails the CI gate.

---

## 2. Moroccan Regulatory & Legal Compliance

SchoolOS is specifically architected for the legal and operational standards of the Kingdom of Morocco:

### 2.1 Law 09-08 (CNDP Data Privacy & Protection)
- **National Commission for the Protection of Personal Data (CNDP)** compliance:
  - All audit trails record user, tenant ID, timestamp, and action while redacting sensitive PII.
  - Explicit **Guardian Consent Flags** (`guardian_consent_data`, `guardian_consent_photos`) are required before processing student data or publishing class photos.
  - Right to erasure / anonymization tools are built into the Super Admin console (`/api/super-admin/schools/anonymize`).

### 2.2 Moroccan Academic & Grading Standard
- **Official /20 Grading Scale**: Grades in Moroccan primary, middle (Collège), and high schools (Lycée) are strictly evaluated on a scale of **0 to 20**.
- **Subject Coefficients (`coefficient`)**: Every subject has a defined weight depending on the student's **Filière/Branch** (e.g. Sciences Mathématiques, Sciences Expérimentales, Lettres, Économie).
- **Trimester/Semester Lifecycle**: Exam terms progress through four immutable states:
  $$\text{Draft} \longrightarrow \text{Open (Saisie des notes)} \longrightarrow \text{Locked (Verrouillé)} \longrightarrow \text{Published (Publié)}$$
- **Moroccan Ministry (MEN) Report Cards**: Generates official Bulletins Scolaires including weighted averages, class rank, general appreciation, and official school seal.

### 2.3 Moroccan Labor Code, Tax & Payroll Engine
- **CNSS (Caisse Nationale de Sécurité Sociale)**:
  - Dahir n° 1-72-184.
  - Statutory gross ceiling of **6 000 DH per month**.
  - Employee contribution: 4.48% | Employer contribution: 8.98% + Family allowance 6.40% + Professional training tax 1.60%.
- **AMO (Assurance Maladie Obligatoire)**:
  - Mandatory health insurance withholding (2.26% employee, 4.11% employer) without ceiling.
- **Impôt sur le Revenu (IR) Progressive Tax**:
  - Official Moroccan progressive tax brackets (0%, 10%, 20%, 30%, 34%, 38%).
  - Professional expense deduction: 35% capped at 35 000 DH/year (or 25% capped at 35 000 DH for high earners).
  - Family dependent abatement: 30 DH per dependent per month, up to 6 dependents (180 DH/month maximum).
- **Bank Export Format**: Generates official Moroccan interbank direct debit and salary transfer files (RIB format 24 digits).

### 2.4 Massar System Integration
- **Massar Format Compatibility**: Seamless import and export of student lists, grades, and matricules compatible with the Ministry of National Education's **Massar (مسار)** system.
- Bi-directional sync preserves Massar student national codes (`Code Massar`, e.g. `R130000000`) alongside the school's internal institutional matricule.

### 2.5 Telecom & GSM-7 SMS Compliance
- Moroccan telcos (Maroc Telecom, Orange Morocco, Inwi) bill SMS in 160-character 7-bit GSM-7 segments.
- SchoolOS includes an automatic GSM-7 sanitizer ([`gsm7.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/libs/sms/gsm7.ts)) that normalizes accented French characters into standard GSM-7 characters to prevent accidental double-billing of SMS segments.

---

## 3. Production Deployment & VPS Invariants

### 3.1 Host Specification
- **VPS IP**: `43.157.17.129`
- **Domain**: `https://schoolos.epioso.com`
- **Reverse Proxy**: Caddy (Automatic HTTPS Let's Encrypt certificates, reverse proxy to Docker port 3000).
- **RAM Constraint**: Host has **1,935 MB of RAM** shared across 5 services (App, PostgreSQL, Redis, WAHA WhatsApp, Caddy).

### 3.2 Cardinal Rule for Production
> [!CAUTION]
> **NEVER run `npm run build` or build Docker images on the VPS host.**  
> Running Next.js builds on the 1,935 MB VPS causes immediate Linux OOM (Out Of Memory) panics and kills active production services.

### 3.3 Safe Local-Build Pipeline (`deploy-to-vps.ps1`)
1. **Local AMD64 Build**: Docker image built locally on workstation (`--platform linux/amd64`) with multi-stage Next.js standalone output.
2. **Compression**: The resulting image is exported to a compressed tarball (`schoolos-app-latest.tar.gz`, ~120 MB).
3. **SCP Transfer**: Transferred securely over SSH to `/home/ubuntu/releases/`.
4. **Remote Pre-Deploy DB Backup**: Automatic gzipped snapshot created in `/home/ubuntu/backups/daily/` before touching any containers.
5. **Zero-Downtime Reload**: Remote Docker loads the image and recreates the `schoolos-app` container with health verification.
6. **Automatic Cleanup**: Prunes older dangling images on the host to keep disk usage under 40%.
