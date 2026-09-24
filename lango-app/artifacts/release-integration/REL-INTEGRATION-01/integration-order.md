# REL-INTEGRATION-01: Final Recommended Integration Order

**Target Release Base:** `origin/student-directory-hardening` (`f42c2bc`)  
**Generated:** 2026-09-24T23:55:00Z  
**Total Campaigns Evaluated:** 24  
**Auditor:** Agent B (REL-INTEGRATION-01 Replacement Executor)

---

## 1. Explicit Integration Sequence

The table below provides the authoritative step-by-step sequence for integrating campaign branches into the release baseline. Every campaign is assigned one of the five mandatory states:
- **`SAFE TO INTEGRATE`**
- **`INTEGRATE AFTER <X>`**
- **`REVERIFY FIRST`**
- **`BLOCKED`**
- **`SUPERSEDED`**

---

### Step-by-Step Staging Pipeline

| Step | Campaign ID | Branch | Remote HEAD | State | Rationale & Prerequisites |
|---|---|---|---|---|---|
| **1** | `AUD-PUBLIC-01` | `origin/audit/agent-c/AUD-PUBLIC-01-public-admissions` | `a509402` | **SAFE TO INTEGRATE** | 100% isolated public website/admissions routes. Hardens public endpoints, IP rate limiting, and invitation acceptance. Zero collisions. |
| **2** | `AUD-PARENT-01` | `origin/audit/agent-a/AUD-PARENT-01-parent-portal` | `8f7d980` | **SAFE TO INTEGRATE** | 100% isolated parent portal. Anti-IDOR sibling isolation and i18n fallback fixes verified. Zero collisions. |
| **3** | `AUD-STUDENT-01` | `origin/audit/agent-a/AUD-STUDENT-01-student-portal` | `348630d` | **SAFE TO INTEGRATE** | 100% isolated student learner space. Learner session and cross-student boundary checks verified. Zero collisions. |
| **4** | `AUD-CALENDAR-01` | `origin/audit/agent-c/AUD-CALENDAR-01-events-calendar` | `a37ecc2` | **SAFE TO INTEGRATE** | Isolated master calendar events module. End-before-start validation fixed. Zero collisions. |
| **5** | `AUD-OPS-01` | `origin/audit/agent-c/AUD-OPS-01-transport-hostel` | `c44d20f` | **SAFE TO INTEGRATE** | Transport & hostel operational workflows. Casablanca business date boundaries and overdue return instants fixed. Zero collisions. |
| **6** | `AUD-LIBINV-01` | `origin/audit/agent-c/AUD-LIBINV-01-library-inventory` | `26a4f7b` | **SAFE TO INTEGRATE** | Library & inventory ledgers. Casablanca business-date midnight fix applied. Zero collisions. |
| **7** | `AUD-SUPPORT-RECEPTION-01` | `origin/audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-rec` | `3298b13` | **SAFE TO INTEGRATE** | Fixes critical unauthenticated support upload leak; enforces tenant isolation on support attachments. Zero collisions. |
| **8** | `AUD-COMMS-01` | `origin/audit/agent-c/AUD-COMMS-01-communication-documents` | `f8bee5f` | **SAFE TO INTEGRATE** | Fixes communication delivery contradiction by routing SMS through authoritative dispatcher. Zero collisions. |
| **9** | `AUD-LIVE-01` | `origin/audit/agent-d/AUD-LIVE-01-live-classrooms` | `7a2c36f` | **SAFE TO INTEGRATE** | Virtual classrooms and live sessions. Atomic PostgreSQL anti-replay defense verified. Trivial `tsconfig.json` overlap. |
| **10** | `AUD-HR-01` | `origin/audit/agent-a/AUD-HR-01-hr-payroll` | `c6fb4b3` | **SAFE TO INTEGRATE** | HR staff lifecycle and Moroccan payroll engine (CNSS ceiling + progressive IR). Isolated workforce module. Zero collisions. |
| **11** | `AUD-SAFETY-01` | `origin/audit/agent-b/AUD-SAFETY-01` | `a68d644` | **SAFE TO INTEGRATE** | Guard portal, badge scanning idempotency, and S-08 branch boundary ruling on visitor check-in/out. Zero collisions. |
| **12** | `AUD-ADMISSIONS-02` | `origin/audit/agent-a/AUD-ADMISSIONS-02-admissions-enrollment` | `5edc4ff` | **SAFE TO INTEGRATE** | Staff admissions review console, sequential matricule generator, and capacity enforcement. Zero collisions. |
| **13** | `AUD-SETTINGS-01` | `origin/audit/agent-d/AUD-SETTINGS-01-users-roles-org` | `127d5be` | **SAFE TO INTEGRATE** | Settings, users, roles, and organization profile. Establishes permissions baseline and salary confidentiality. Overlaps locales with Finance. |
| **14** | `AUD-ANALYTICS-01` | `origin/audit/agent-c/AUD-ANALYTICS-01-analytics-direction` | `e8a9e36` | **SAFE TO INTEGRATE** | Executive KPIs and dashboard analytics layer. Conforms to canonical `libs/finance/definitions.ts`. Zero collisions. |
| **15** | `AUD-RECEPTION-01` | `origin/audit/agent-b/AUD-RECEPTION-01` | `d38140d` | **SAFE TO INTEGRATE** | Receptionist front desk and visitor management. Modifies `src/app/api/students/route.ts` with least-privilege projection. Must integrate before `AUD-TEACHER-01`. |
| **16** | `AUD-TEACHER-01` | `origin/audit/agent-b/AUD-TEACHER-01` | `05d907a` | **INTEGRATE AFTER AUD-RECEPTION-01** | Teacher portal and grade entry. Modifies `src/app/api/students/route.ts` to enforce teacher scoping and mask family financial balances. Classified compatible with RECEPTION-01. |
| **17** | `AUD-FINANCE-01` | `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier` | `85f0571` | **INTEGRATE AFTER AUD-SETTINGS-01, AUD-RECEPTION-01, AUD-TEACHER-01** | Full billing, cashier, receipts, and migration `0156`. Additively merges locales with SETTINGS-01; preserves teacher and receptionist masking in `students/route.ts`. |
| — | `AUD-ACADEMICS-01` | `origin/agentb/academics-audit` | `f42c2bc` | **SUPERSEDED** | Already incorporated into base `f42c2bc` (0 code delta). No integration action required. |
| — | `AUD-CREDENTIALS-01` | `origin/audit/agent-a/AUD-CREDENTIALS-01-cards-certificates` | `51a0573` | **REVERIFY FIRST** | Remediated by executor at 23:52Z; awaiting Agent 5 re-verification of Template Designer canvas mounting and 9 screenshots. |
| — | `AUD-CRM-01` | `origin/audit/agent-c/AUD-CRM-01-crm-inquiries` | `5497a01` | **REVERIFY FIRST** | Marked done by executor; requires independent Agent 5 verification of 17 tests and lead conversion idempotency. |
| — | `AUD-CONTENT-01` | `origin/audit/agent-d/AUD-CONTENT-01-attachments-book` | `b71022c` | **REVERIFY FIRST** | Marked done by executor at 23:43Z; requires independent Agent 5 verification of 42-step runtime E2E test. |
| — | `FIX-DASH-FIN-KPI-01` | `origin/audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance` | `8203068` | **REVERIFY FIRST** | Top-level formula corrected, but monthly breakdown remaining fix open; requires Agent 5 verification. |
| — | `AUD-PLATFORM-01` | `origin/audit/agent-c/AUD-PLATFORM-01-platform-entitlements` | `8cdf9d3` | **BLOCKED** | Missing Super Admin TOTP secret file. Integration blocked until credentials supplied and live sweep executed. |
| — | `AUD-WEBSITE-01` | `audit/agent-b/AUD-WEBSITE-01` | `6f3b143` | **BLOCKED** | In-progress campaign held under active claim by opencode-1. Integration blocked until audit completion. |

---

## 2. Summary by Status
- **SAFE TO INTEGRATE (Immediate Batches 1–15):** 15 campaigns
- **INTEGRATE AFTER PREREQUISITES (Steps 16 & 17):** 2 campaigns (`AUD-TEACHER-01`, `AUD-FINANCE-01`)
- **REVERIFY FIRST (Awaiting Agent 5):** 4 campaigns (`AUD-CREDENTIALS-01`, `AUD-CRM-01`, `AUD-CONTENT-01`, `FIX-DASH-FIN-KPI-01`)
- **BLOCKED (External Dependency / In Progress):** 2 campaigns (`AUD-PLATFORM-01`, `AUD-WEBSITE-01`)
- **SUPERSEDED (Zero Delta):** 1 campaign (`AUD-ACADEMICS-01`)
- **Total Campaigns Accounted For:** **24**
