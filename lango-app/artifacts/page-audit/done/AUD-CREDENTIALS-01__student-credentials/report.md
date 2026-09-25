# AUD-CREDENTIALS-01 Audit & Hardening Report
## Student Cards, Certificates, Convocations & Official School Documents

**Execution Date:** 2026-09-24  
**Campaign ID:** `AUD-CREDENTIALS-01`  
**Executor Agent:** `antigravity-1` (Agent A)  
**Target Git Branch:** `audit/agent-a/AUD-CREDENTIALS-01-cards-certificates`  
**Host Application:** SchoolOS (Moroccan Multi-Tenant School Management Platform)  
**Target Tenant:** Groupe Scolaire Atlas (`c47ac10b-58cc-4372-a567-0e02b2c3d479`)

---

### 1. Executive Summary & Audit Scope

The `AUD-CREDENTIALS-01` campaign performed an end-to-end technical audit, defect remediation, and production hardening across the entire student credentials and official school document issuance subsystem in SchoolOS.

The audit verified the complete lifecycle of official school credentials:
```
Eligible Student / Candidate
  → Select Credential / Certificate Definition
  → Compile Snapshot & Official Sequential Serial Number (Loi 06-00)
  → Cryptographic SHA-256 Public Verification Token Hash
  → Issue & Render (PDF / Print / QR Code)
  → Reissue / Reprint / Revoke / Replace Audit Trail
  → Zero-PII-Leak Public Verification Portal & Anti-Enumeration Protection
```

#### Key Architecture & Regulatory Invariants Verified:
1. **Moroccan Law 06-00 & 09-08 Compliance**:
   - Official attestations (Attestation de Scolarité, Certificat de Réussite, Relevé de Notes Officiel) adhere to the Ministry of National Education guidelines.
   - Strict CNDP compliance: Public verification endpoints (`/api/public/cards/verify` and `/api/public/certificates/verify`) **never** expose student dates of birth, national ID (CIN/Massar), guardian contacts, financial records, or internal notes.
2. **Cryptographic Anti-Counterfeiting & Anti-Enumeration**:
   - Raw tokens are generated with high-entropy cryptographic randomness (`crypto.randomBytes(32)`).
   - Only SHA-256 hashes (`publicTokenHash`, `verificationTokenHash`) are stored in the database.
   - Verification responses never distinguish between revoked, replaced, expired, or non-existent tokens (identical `{ valid: false }` response shape, eliminating enumeration vectors).
   - Bot protection enforced via bot honeypot fields (`website_hp`) and sliding-window IP rate limiting (10 req/hour).
3. **Multi-Tenant Isolation & IDOR Protection**:
   - Every database query, update, replacement, and revocation enforces `eq(table.tenantId, ctx.tenantId)`.
   - Cross-tenant token collision prevention enforced via compound unique indices (`issued_documents_tenant_token_idx`, `issued_certificates_tenant_serial_idx`).
4. **Interactive Document Studio & Webpack Hardening**:
   - Resolved client-side Webpack bundling failures when embedding `@pdfme/ui` and `@pdfme/converter` (`clawpdf` Node.js built-ins resolution).
   - Preserved interactive WYSIWYG card and certificate designer functionality with dynamic imports.

---

### 2. Subsystem Inventory: Routes, APIs, Schemas & Services

#### 2.1 Dashboard & Public Routes Audited (23 Pages)
| Route | Category | Description | Verification Status |
|---|---|---|---|
| `/dashboard/cards` | Cards | Central card generation and issuance overview | **PASS** |
| `/dashboard/cards/students` | Cards | Student ID card batch issuance and preview | **PASS** |
| `/dashboard/cards/employees` | Cards | Faculty and administrative staff ID cards | **PASS** |
| `/dashboard/cards/admit-cards` | Convocations | Official exam admit cards / Convocations d'examen | **PASS** |
| `/dashboard/cards/issued` | Cards Registry | Historical ledger of issued cards, reprints, and revocations | **PASS** |
| `/dashboard/cards/templates` | Cards Studio | Template catalog for ID card layouts | **PASS** |
| `/dashboard/cards/templates/[id]/edit` | Cards Studio | Interactive visual WYSIWYG template designer | **PASS** |
| `/dashboard/cards/jobs` | Background Jobs | Bulk card generation asynchronous job monitor | **PASS** |
| `/dashboard/certificates` | Certificates | Official certificates and attestations dashboard | **PASS** |
| `/dashboard/certificates/issue/students` | Certificates | Student certificate and attestation issuance wizard | **PASS** |
| `/dashboard/certificates/issue/employees` | Certificates | Work attestations (Attestation de travail) issuance | **PASS** |
| `/dashboard/certificates/definitions` | Certificate Catalog | Official certificate definitions and legal requirements | **PASS** |
| `/dashboard/certificates/definitions/[id]` | Certificate Catalog | Definition details, required evidence, and validity rules | **PASS** |
| `/dashboard/certificates/issued` | Certificate Registry | Official ledger of issued certificates and serial numbers | **PASS** |
| `/dashboard/certificates/issued/[id]` | Certificate Registry | Certificate lifecycle management (reprint, revoke, replace) | **PASS** |
| `/dashboard/certificates/templates` | Certificate Studio | Certificate template list and layout versions | **PASS** |
| `/dashboard/certificates/templates/[id]/edit` | Certificate Studio | Interactive certificate layout and signature box designer | **PASS** |
| `/dashboard/certificates/requests` | Requests | Parent and student certificate request workflows | **PASS** |
| `/dashboard/certificates/jobs` | Background Jobs | Batch certificate generation job monitor | **PASS** |
| `/dashboard/certificates/settings` | Settings | School signatories, stamp storage, and numbering prefixes | **PASS** |
| `/dashboard/documents/generator` | Document Studio | Unified document generation and merge-tag studio | **PASS** |
| `/verify/card` | Public | Public QR verification portal for ID cards | **PASS** |
| `/verify/certificate` | Public | Public QR verification portal for official certificates | **PASS** |

#### 2.2 API Endpoints Audited (27 Routes)
- `GET|POST /api/cards/templates`
- `GET|PUT|DELETE /api/cards/templates/[id]`
- `GET|POST /api/cards/templates/[id]/versions`
- `GET|POST /api/cards/issue`
- `GET|POST /api/cards/batch`
- `GET /api/cards/issued`
- `POST /api/cards/issued/[id]/reprint`
- `POST /api/cards/issued/[id]/revoke`
- `POST /api/cards/issued/[id]/replace`
- `GET /api/cards/jobs`
- `POST /api/cards/jobs/[id]/process`
- `GET|POST /api/certificates/definitions`
- `GET|PUT|DELETE /api/certificates/definitions/[id]`
- `GET|POST /api/certificates/templates`
- `GET|PUT|DELETE /api/certificates/templates/[id]`
- `GET|POST /api/certificates/issued`
- `GET /api/certificates/issued/[id]`
- `POST /api/certificates/issued/[id]/reprint`
- `POST /api/certificates/issued/[id]/revoke`
- `POST /api/certificates/issued/[id]/replace`
- `GET|POST /api/certificates/requests`
- `PATCH /api/certificates/requests/[id]`
- `GET|POST /api/certificates/signatories`
- `GET /api/certificates/jobs`
- `POST /api/public/cards/verify` (Rate-limited, anti-enumeration, CNDP compliant)
- `POST /api/public/certificates/verify` (Rate-limited, anti-enumeration, CNDP compliant)

#### 2.3 Core Database Tables
1. **Cards & Convocations**:
   - `document_templates`: Card template records, default flags, and metadata.
   - `document_template_versions`: Dimension-locked schemas, page widths, orientations, and JSON merge schemas.
   - `issued_documents`: Active, revoked, expired, or replaced cards with cryptographic hashes and candidate links.
   - `document_generation_jobs`: Batch card processing job states.
   - `document_generation_items`: Individual student card job statuses and error messages.
   - `document_events`: Immutable audit trail (`issued`, `downloaded`, `printed`, `reprinted`, `replaced`, `revoked`, `verified`).
2. **Certificates & Attestations**:
   - `certificate_definitions`: Attestation types, legal regulatory categories, validity durations, and prerequisites.
   - `certificate_templates`: Visual certificate templates and merge tags.
   - `certificate_signatories`: Authorized school directors, headmasters, and registrars with digital signatures/stamps.
   - `issued_certificates`: Official certificate ledger with serial numbers (`CERT-YYYY-XXXXXX`) and verification hashes.
   - `certificate_requests`: Inquiries and attestation requests submitted by students/guardians.
   - `certificate_jobs`: Asynchronous batch certificate generation queues.
   - `certificate_job_items`: Itemized batch progress records.
   - `certificate_events`: Immutable audit log for certificate lifecycle events.

---

### 3. Key Defects Fixed & Hardened

#### 3.1 Webpack Client-Side Node Protocol Resolution in Template Designer (DEF-CRED-01)
- **Problem**: When rendering `/dashboard/cards/templates/[id]/edit`, Webpack failed with `UnhandledSchemeError: Reading from "node:..." is not handled by plugins` due to `@pdfme/ui` -> `@pdfme/converter` -> `clawpdf` importing `node:fs/promises`, `node:module`, `node:url`, and `node:zlib`.
- **Fix**:
  1. Configured `webpack.NormalModuleReplacementPlugin(/^node:/, r => { r.request = r.request.replace(/^node:/, ''); })` in `next.config.ts`.
  2. Injected client-side fallback mocks (`zlib: false, fs: false, module: false, url: false, stream: false`).
  3. Switched `TemplateDesigner.tsx` to `import type { Designer } from '@pdfme/ui'` so Webpack never includes the designer bundle in the initial static server evaluation.

#### 3.2 Tenant Isolation in Document & Certificate Replacement (DEF-CRED-02)
- **Problem**: In `/api/certificates/issued/[id]/replace` and `/api/cards/jobs/[id]/process`, queries selected records without strict tenant scoping in intermediate joins.
- **Fix**: Enforced `eq(table.tenantId, ctx.tenantId)` across all issuance, replacement, and job processing queries. Audited with `scripts/check-tenant-isolation.ts` (0 errors, 69 non-failing warnings).

#### 3.3 Public Verification Token Hardening & Anti-Enumeration (DEF-CRED-03)
- **Problem**: Potential enumeration vulnerability where invalid tokens could be differentiated from revoked tokens, and potential exposure of sensitive PII in public verification responses.
- **Fix**:
  1. Hashed token lookup: endpoints now query using `createHash('sha256').update(body.token).digest('hex')`. Raw tokens are never stored in plaintext.
  2. Anti-enumeration: non-existent, tampered, expired, and revoked tokens return an identical `{ valid: false }` payload.
  3. CNDP privacy: responses only expose the minimum necessary verification data (`subjectName`, `documentType`/`certificateTitle`, `issuedAt`, `schoolName`). Sensitive PII is completely omitted.
  4. Bot protection: enforced hidden honeypot validation (`website_hp`) and IP sliding window rate-limiter.

#### 3.4 Convocations d'Examen Integration with Exam Master (DEF-CRED-04)
- **Problem**: Admit cards previously lacked linkage to actual exam seat allocations and candidate identifiers.
- **Fix**: Linked `issuedDocuments.examCandidateId` and student matricules to the exam seating registry. Created dedicated view `/dashboard/cards/admit-cards` supporting French and Arabic RTL layouts with room and seat metadata.

---

### 4. Verification Gates & Test Evidence

All quality gates passed with zero regressions:

1. **TypeScript Type Safety**:
   ```
   npm run check:types -> PASSED (0 errors)
   ```
2. **Tenant Isolation**:
   ```
   npm run check:isolation -> PASSED (0 errors, warnings holding at 69)
   ```
3. **i18n Localization Integrity**:
   ```
   npm run check:i18n -> PASSED (0 missing keys, 0 invalid translations)
   npm run check:i18n:keys -> PASSED (0 missing keys)
   ```
4. **UI Reality Ratchet**:
   ```
   npm run check:ui -> PASSED (Dead controls: 38/39 holding, mock screens: 0/0, unlinked pages: 28/28)
   ```
5. **E2E Domain Integration Suite**:
   ```
   npx vitest run src/features/certificates/__tests__/credentials-domain-e2e.test.ts
   -> 8 tests passed (100% PASS in 6.56s)
   ```
   - Test 1: Issues a student ID card with valid token hash and verified via public API
   - Test 2: Blocks verification of tampered card tokens
   - Test 3: Correctly identifies expired cards
   - Test 4: Replaces an issued card and revokes the predecessor
   - Test 5: Issues an official certificate with sequential Moroccan serial number
   - Test 6: Verifies valid certificate token via public verification API
   - Test 7: Prevents duplicate certificate issuance for identical criteria
   - Test 8: Revokes certificate and marks audit log immutably

---

### 5. Visual Evidence Manifest (31 Screenshots Captured)

All captures are saved in `artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/screenshots/`:

| # | File Name | Viewport / Locale | Description |
|---|---|---|---|
| 01 | `01-cards-dashboard-desktop-fr.png` | 1440x900 / FR | Cards overview dashboard with live metrics |
| 02 | `02-cards-students-desktop-fr.png` | 1440x900 / FR | Student ID cards issuance directory and filters |
| 03 | `03-cards-students-mobile-390.png` | 390x844 / FR | Student ID cards mobile view |
| 04 | `04-cards-students-arabic-rtl.png` | 1440x900 / AR | Student ID cards Arabic RTL layout |
| 05 | `05-cards-employees-desktop-fr.png` | 1440x900 / FR | Employee ID cards management |
| 06 | `06-cards-admit-cards-desktop-fr.png` | 1440x900 / FR | Official exam convocations (Admit Cards) |
| 07 | `07-cards-admit-cards-mobile-390.png` | 390x844 / FR | Convocations mobile layout |
| 08 | `08-cards-admit-cards-arabic-rtl.png` | 1440x900 / AR | Convocations Arabic RTL layout |
| 09 | `09-cards-issued-desktop-fr.png` | 1440x900 / FR | Cards issued historical ledger |
| 10 | `10-cards-templates-desktop-fr.png` | 1440x900 / FR | Card template catalog |
| 11 | `11-cards-templates-edit-desktop-fr.png` | 1440x900 / FR | Interactive card visual designer |
| 12 | `12-cards-jobs-desktop-fr.png` | 1440x900 / FR | Bulk card generation jobs monitor |
| 13 | `13-certificates-dashboard-desktop-fr.png` | 1440x900 / FR | Certificates & attestations dashboard |
| 14 | `14-certificates-issue-students-desktop-fr.png` | 1440x900 / FR | Student certificate issuance wizard |
| 15 | `15-certificates-issue-employees-desktop-fr.png` | 1440x900 / FR | Staff work attestation issuance wizard |
| 16 | `16-certificates-definitions-desktop-fr.png` | 1440x900 / FR | Certificate definitions registry |
| 17 | `17-certificates-definitions-detail-desktop-fr.png` | 1440x900 / FR | Certificate definition criteria detail |
| 18 | `18-certificates-issued-desktop-fr.png` | 1440x900 / FR | Issued certificates registry with serial numbers |
| 19 | `19-certificates-issued-mobile-390.png` | 390x844 / FR | Issued certificates mobile view |
| 20 | `20-certificates-issued-arabic-rtl.png` | 1440x900 / AR | Issued certificates Arabic RTL view |
| 21 | `21-certificates-issued-detail-desktop-fr.png` | 1440x900 / FR | Issued certificate detail and actions |
| 22 | `22-certificates-templates-desktop-fr.png` | 1440x900 / FR | Certificate templates list |
| 23 | `23-certificates-templates-edit-desktop-fr.png` | 1440x900 / FR | Interactive certificate template designer |
| 24 | `24-certificates-requests-desktop-fr.png` | 1440x900 / FR | Certificate requests workflow desk |
| 25 | `25-certificates-requests-mobile-390.png` | 390x844 / FR | Certificate requests mobile view |
| 26 | `26-certificates-requests-arabic-rtl.png` | 1440x900 / AR | Certificate requests Arabic RTL view |
| 27 | `27-certificates-jobs-desktop-fr.png` | 1440x900 / FR | Certificate batch generation jobs monitor |
| 28 | `28-certificates-settings-desktop-fr.png` | 1440x900 / FR | Signatories, stamps, and numbering rules |
| 29 | `29-documents-generator-desktop-fr.png` | 1440x900 / FR | Unified Document Studio generator |
| 30 | `30-verify-card-public-desktop-fr.png` | 1440x900 / FR | Public QR card verification portal |
| 31 | `31-verify-certificate-public-desktop-fr.png` | 1440x900 / FR | Public QR certificate verification portal |

---

### 6. Remediation & Final Visual Cleanup Status

#### 6.1 Phase 1: Core Defect Remediation (Accepted)
1. **Global Shell Hydration**: Resolved client-side hydration mismatches in global shell components (`sidebar.tsx`, `header.tsx`, `impersonation-banner.tsx`) using `isMounted` guards and `suppressHydrationWarning`.
2. **Template Designer Studio**: Dynamic import and canvas bounding container stabilized for `@pdfme/ui`. Functional save probes (`POST /api/cards/templates/[id]/versions` and `POST /api/certificates/templates/[id]/versions`) return 200 OK.
3. **Detail Route & Verifier Settlement**: Definition detail route mounted cleanly with designer controls; public verification portal resolves authentic state for `atlas-cert-token-valid-2026`.
4. **Initial 9 Re-captures**: Screenshots `10`, `11`, `14`, `16`, `17`, `18`, `21`, `23`, `31` recaptured with 0 error badges.

#### 6.2 Phase 2: Final Full-Package Visual Cleanup (Settled States)
1. **Elimination of All Loading States**: Recaptured 9 remaining routes that previously exhibited intermediate loading states (`01`, `02`, `04`, `05`, `06`, `08`, `12`, `13`, `15`) after guaranteeing complete API response settlement:
   - `01-cards-dashboard-desktop-fr.png`: KPIs resolved (3, 9, 1, 1; zero `—`), recent issuances listed.
   - `02-cards-students-desktop-fr.png`: Students table populated with 5 active students, zero loading text.
   - `04-cards-students-arabic-rtl.png`: Arabic RTL layout populated with student records, zero "جاري التحميل".
   - `05-cards-employees-desktop-fr.png`: Employees table populated with 5 staff members and role badges.
   - `06-cards-admit-cards-desktop-fr.png`: Admit cards table populated with candidate desk & exam room assignments.
   - `08-cards-admit-cards-arabic-rtl.png`: Arabic RTL convocations table populated, zero "جاري التحميل".
   - `12-cards-jobs-desktop-fr.png`: Batch jobs monitor populated with completed batch job (5 cards).
   - `13-certificates-dashboard-desktop-fr.png`: KPIs resolved (3, 1, 4, 2; zero `—`), recent certificates list populated.
   - `15-certificates-issue-employees-desktop-fr.png`: Staff recipients table populated with 5 employees.
2. **Automated Package Assertion Sweep**: Executed `scripts/verify-all-31-package.mjs` verifying:
   - 0 "Chargement"
   - 0 "جاري التحميل"
   - 0 "Rendering..."
   - 0 unresolved spinners
   - 0 nextjs-portal error badges
   - 0 unhydrated user shells
   - Result: **31/31 PASS**
3. **Quality Gates Status**:
   - `npm run check:types`: **0 errors (PASS)**
   - `npm run check:ui`: **Ratchet holding (Dead controls 38/39, mock screens 0/0, unlinked pages 28/28) (PASS)**
   - `vitest` domain suite: **8/8 PASS**
   - Canonical production build: **PASS**

Detailed evidence is archived in [`evidence/runtime-browser-remediation.md`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/.worktrees/AUD-CREDENTIALS-01/lango-app/artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/evidence/runtime-browser-remediation.md).

---

### 7. Sign-off Summary

- previous rejected screenshots: 9/9 stable
- additional loading screenshots corrected: 9/9
- total final screenshots stable: 31/31
- loading placeholders remaining: 0
- Next.js error badges: 0
- unhydrated shells: 0
- Template Designer cards: PASS
- Template Designer certificates: PASS
- public certificate verification final state: PASS
- check:types: PASS
- check:ui: PASS

**READY FOR AGENT 5 TARGETED RE-VERIFY: YES**

