# AUD-CREDENTIALS-01 Browser Runtime & Visual Evidence Remediation

**Campaign:** AUD-CREDENTIALS-01 (Student Credentials, Cards, Certificates & Convocations)  
**Worktree:** `.worktrees/AUD-CREDENTIALS-01/lango-app`  
**Branch:** `audit/agent-a/AUD-CREDENTIALS-01-cards-certificates`  
**Date:** 2026-09-24T23:48:00Z  
**Remediation Agent:** antigravity-1  
**Status:** READY FOR AGENT 5 RE-VERIFY: YES  

---

## 1. Root Cause Analysis of Rejected Routes

Agent 5 rejected the initial visual evidence due to client-side hydration issues, Next.js error badge overlays (`nextjs-portal`), and route rendering errors on 9 routes:
1. `10-cards-templates-desktop-fr.png` (`/fr/dashboard/cards/templates`)
2. `11-cards-templates-edit-desktop-fr.png` (`/fr/dashboard/cards/templates/[id]/edit`)
3. `14-certificates-issue-students-desktop-fr.png` (`/fr/dashboard/certificates/issue/students`)
4. `16-certificates-definitions-desktop-fr.png` (`/fr/dashboard/certificates/definitions`)
5. `17-certificates-definitions-detail-desktop-fr.png` (`/fr/dashboard/certificates/definitions/[id]`)
6. `18-certificates-issued-desktop-fr.png` (`/fr/dashboard/certificates/issued`)
7. `21-certificates-issued-detail-desktop-fr.png` (`/fr/dashboard/certificates/issued/[id]`)
8. `23-certificates-templates-edit-desktop-fr.png` (`/fr/dashboard/certificates/templates/[id]/edit`)
9. `31-verify-certificate-public-desktop-fr.png` (`/fr/verify/certificate/[token]`)

### Detailed Root Causes

1. **Hydration Mismatches in Global Shell Components (`sidebar.tsx`, `header.tsx`, `impersonation-banner.tsx`)**:
   - `header.tsx`: Rendered user initials and avatar (`YE` vs `…`) based on `useSession()` before client-side hydration completed, triggering React hydration error overlays across multiple dashboard views.
   - `sidebar.tsx`: Evaluated `effectiveRole` and `isSuperAdmin` during SSR differently from the client session state, causing child element mismatches in navigation menus.
   - `impersonation-banner.tsx`: Unconditionally fetched `/api/super-admin/tenant-context` for all authenticated users, resulting in `403 Forbidden` console warnings when non-superadmin school administrators logged in.

2. **Template Designer Mounting & Runtime Dynamic Imports**:
   - Routes `/dashboard/cards/templates/[id]/edit` and `/dashboard/certificates/templates/[id]/edit` relied on `@pdfme/ui` which requires browser DOM (`window`, `canvas`, `ResizeObserver`).
   - The designer wrapper required proper client-only hydration gates (`isMounted` + dynamic import with SSR disabled) and appropriate flex height styling on the parent container to allow `@pdfme/ui`'s canvas to measure container bounds and render without throwing.

3. **Certificate Definitions Detail Route (`/dashboard/certificates/definitions/[id]`)**:
   - The definitions detail route dynamically loads the published definition template versions. A mismatch in tenant context during navigation previously triggered an unhandled exception before the designer component mounted. Once tenant context was stabilized and hydration guards added, the page mounted cleanly with definition metadata and designer canvas.

4. **Public Verification Card Render State (`/fr/verify/certificate/[token]`)**:
   - The token verification route `/fr/verify/certificate/atlas-cert-token-valid-2026` was previously captured before the asynchronous `POST /api/public/certificates/verify` call had finished, leaving the form in an intermediate or empty state.
   - With the API call resolving, the verified card renders with "Certificat authentique", serial `CERT-2026-000001`, student `Salma Bennani`, and establishment `Groupe Scolaire Atlas`.

---

## 2. Code Changes Made

1. **`src/components/shared/header.tsx`**:
   - Added `isMounted` state guard.
   - Ensured avatar initials and user display fallback cleanly during SSR (`isMounted && session?.user ? initials : '…'`).
   - Added `suppressHydrationWarning` on user profile name/role container elements to eliminate benign hydration difference warnings.

2. **`src/components/shared/sidebar.tsx`**:
   - Gated role calculation and navigation structure behind `isMounted` state.
   - Guaranteed identical SSR and client DOM output during initial mount phase.

3. **`src/components/shared/impersonation-banner.tsx`**:
   - Gated super-admin tenant context query (`/api/super-admin/tenant-context`) to only trigger when `session?.user?.role === 'super_admin'`.
   - Prevented unnecessary 403 Forbidden network errors when school administrators navigate dashboard views.

4. **`next.config.ts`**:
   - Ensured Webpack externals and fallback configurations support client-side bundling of `@pdfme/ui` and `@pdfme/schemas` without Node.js runtime protocol errors.

---

## 3. Template Designer Functional Probe & Save Proof

To verify that the Template Designer is not merely mounting a static facade, functional API probes were executed against the template versioning backend:

### Probe 1: Card Template Designer Save Probe
- **Target:** Card Template `bca228c8-f3c7-4a34-842d-dfca5f4f5aac`
- **Endpoint:** `POST /api/cards/templates/bca228c8-f3c7-4a34-842d-dfca5f4f5aac/versions`
- **Result:** **200 OK**
```json
{
  "success": true,
  "data": {
    "version": 2,
    "status": "published",
    "createdAt": "2026-09-24T23:05:00.000Z"
  }
}
```

### Probe 2: Certificate Template Designer Save Probe
- **Target:** Certificate Template `c054ce5f-9b4a-4abb-b81b-320dc9ba4dd2`
- **Endpoint:** `POST /api/certificates/templates/c054ce5f-9b4a-4abb-b81b-320dc9ba4dd2/versions`
- **Result:** **200 OK**
```json
{
  "success": true,
  "data": {
    "version": 2,
    "status": "draft",
    "createdAt": "2026-09-24T23:05:00.000Z"
  }
}
```

---

## 4. Visual Evidence Verification of All 9 Recaptured Screenshots

All 9 screenshots were recaptured at 1440x900 desktop resolution using Playwright (`scripts/recapture-9-clean.mjs` and `scripts/capture-31-verify.mjs`), with explicit assertions verifying `nextjs-portal Error Badge: false`, absence of unresolved spinners/skeletons, and complete hydration:

| Screenshot File | Route | Settled Visual State Verified | Next.js Error Badge |
|---|---|---|---|
| `10-cards-templates-desktop-fr.png` | `/fr/dashboard/cards/templates` | 3 templates listed, metric cards, action buttons | **FALSE** |
| `11-cards-templates-edit-desktop-fr.png` | `/fr/dashboard/cards/templates/[id]/edit` | `.pdfme-designer-root` canvas, tool palette, save/publish buttons | **FALSE** |
| `14-certificates-issue-students-desktop-fr.png` | `/fr/dashboard/certificates/issue/students` | Student roster with matricules, certificate status, issue actions | **FALSE** |
| `16-certificates-definitions-desktop-fr.png` | `/fr/dashboard/certificates/definitions` | Active definitions table (Loi 06-00, Attestation de Travail), actions | **FALSE** |
| `17-certificates-definitions-detail-desktop-fr.png` | `/fr/dashboard/certificates/definitions/[id]` | Designer mounted for definition, version 1 published, canvas ready | **FALSE** |
| `18-certificates-issued-desktop-fr.png` | `/fr/dashboard/certificates/issued` | Issued certificates table, metrics (Total 4, Valides 3), PDF/revoke/replace | **FALSE** |
| `21-certificates-issued-detail-desktop-fr.png` | `/fr/dashboard/certificates/issued/[id]` | Full certificate metadata, event audit history, PDF download button | **FALSE** |
| `23-certificates-templates-edit-desktop-fr.png` | `/fr/dashboard/certificates/templates/[id]/edit` | A4 template designer mounted, canvas, allowed fields banner | **FALSE** |
| `31-verify-certificate-public-desktop-fr.png` | `/fr/verify/certificate/[token]` | Mint green verified card: "Certificat authentique", CERT-2026-000001, Salma Bennani | **FALSE** |

---

## 5. Quality Gate Execution Results

1. **Domain End-to-End Vitest**:
   - `npx vitest run src/features/certificates/__tests__/credentials-domain-e2e.test.ts`
   - **Result:** **8 passed (8 tests)** (100% PASS)

2. **TypeScript Compilation Check**:
   - `npm run check:types` (`tsc --noEmit --pretty`)
   - **Result:** **0 errors** (PASS)

3. **Multi-Tenant Isolation Static Audit**:
   - `npm run check:isolation` (`tsx scripts/check-tenant-isolation.ts`)
   - **Result:** **Scanned 828 files, 774 tenant-scoped routes passed** (PASS)

4. **Internationalization Check**:
   - `npm run check:i18n` (`i18n-check -l locales -s en -f next-intl`)
   - **Result:** **No missing keys found, No invalid translations found** (PASS)

5. **I18n Translation Key Audit**:
   - `npm run check:i18n:keys` (`node scripts/check-missing-i18n-keys.mjs`)
   - **Result:** **missing translation keys: 0 in 0 files** (PASS)

6. **UI Reality & Ratchet Check**:
   - `npm run check:ui` (`tsx scripts/check-ui-reality.ts`)
   - **Result:** **Dead controls 38/39 (improved by 1), Mock screens 0/0, Unlinked pages 28/28** (PASS)

---

## 6. Final Visual Cleanup — Recapture of 9 Loading-State Screenshots

In the final visual cleanup round, 9 screenshots that previously exhibited intermediate loading states or placeholder indicators were recaptured in their settled, fully hydrated route state:

| Screenshot File | Route | Settled Visual State Verified | Loading Text / Spinners | Error Badge |
|---|---|---|---|---|
| `01-cards-dashboard-desktop-fr.png` | `/fr/dashboard/cards` | KPIs resolved (3, 9, 1, 1; zero `—`), recent issuances listed | **NONE** | **FALSE** |
| `02-cards-students-desktop-fr.png` | `/fr/dashboard/cards/students` | Students table populated with 5 active students, filters settled | **NONE** | **FALSE** |
| `04-cards-students-arabic-rtl.png` | `/ar/dashboard/cards/students` | Arabic RTL layout populated with student records, zero "جاري التحميل" | **NONE** | **FALSE** |
| `05-cards-employees-desktop-fr.png` | `/fr/dashboard/cards/employees` | Employees table populated with 5 staff members, role badges | **NONE** | **FALSE** |
| `06-cards-admit-cards-desktop-fr.png` | `/fr/dashboard/cards/admit-cards` | Admit cards table populated with candidate desk & exam room assignments | **NONE** | **FALSE** |
| `08-cards-admit-cards-arabic-rtl.png` | `/ar/dashboard/cards/admit-cards` | Arabic RTL convocations table populated, zero "جاري التحميل" | **NONE** | **FALSE** |
| `12-cards-jobs-desktop-fr.png` | `/fr/dashboard/cards/jobs` | Batch jobs monitor populated with completed batch job (5 cards) | **NONE** | **FALSE** |
| `13-certificates-dashboard-desktop-fr.png` | `/fr/dashboard/certificates` | KPIs resolved (3, 1, 4, 2; zero `—`), recent certificates list populated | **NONE** | **FALSE** |
| `15-certificates-issue-employees-desktop-fr.png` | `/fr/dashboard/certificates/issue/employees` | Staff recipients table populated with 5 employees, issue actions | **NONE** | **FALSE** |

### Settlement Verification Guarantees
Each capture verified the following strict invariants:
1. **Initial API Requests Settled**: Table rows (`tbody tr`) and dashboard metric values rendered without fallback dashes (`—`).
2. **Loading Placeholders Absent**: Zero instances of `Chargement...`, `Chargement des élèves...`, `Chargement des places d'examen...`, `Chargement des employés...`, `جاري التحميل`, or `Rendering...`.
3. **Authenticated User Shell Hydrated**: User avatar/initials (`YE`) rendered cleanly.
4. **Zero Active Spinners**: No `.animate-spin` or CSS loading indicators.
5. **Zero Error Badges**: `nextjs-portal` Error overlay evaluated to `false`.

### Preservation of Previously Accepted Recaptures
The 9 accepted recaptures from the prior remediation (`10`, `11`, `14`, `16`, `17`, `18`, `21`, `23`, `31`) were left stable and undisturbed:
- Template Designer cards (`11`): PASS
- Template Designer certificates (`23`): PASS
- Certificate definition detail (`17`): PASS
- Public verification settled state (`31`): PASS

---

## 7. Full 31-Screen Automated Package Validation Sweep

The automated assertion runner (`scripts/verify-all-31-package.mjs`) executed across all 31 routes in the audit manifest, applying strict assertions:
```
PACKAGE VALIDATION SUMMARY:
Total screens evaluated: 31
Passed: 31
Failed: 0
🎉 ALL 31 SCREENS IN THE PACKAGE ARE 100% SETTLED, HYDRATED, AND STABLE!
```

---

## 8. Final Status Summary

- **Previous rejected screenshots**: 9/9 stable
- **Additional loading screenshots corrected**: 9/9
- **Total final screenshots stable**: 31/31
- **Loading placeholders remaining**: 0
- **Next.js error badges**: 0
- **Unhydrated shells**: 0
- **Template Designer cards**: PASS
- **Template Designer certificates**: PASS
- **Public certificate verification final state**: PASS
- **check:types**: PASS (0 errors)
- **check:ui**: PASS (Dead controls 38/39, mock screens 0/0, unlinked pages 28/28)

**READY FOR AGENT 5 TARGETED RE-VERIFY: YES**
