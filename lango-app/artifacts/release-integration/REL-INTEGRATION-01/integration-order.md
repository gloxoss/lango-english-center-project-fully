# Recommended Integration Sequence — REL-INTEGRATION-01
**Target Base:** `origin/student-directory-hardening` (`f42c2bc4`)  
**Generated:** 2026-09-24T23:55:00Z  

---

## Explicit Sequence (1 to 24)

Every campaign is assigned exactly one status:
- **SAFE TO INTEGRATE**: Trusted, verified, and ready to merge with zero prerequisite conflicts.
- **INTEGRATE AFTER <X>**: Trusted, verified, but has an explicit ordering dependency on another campaign.
- **REVERIFY FIRST**: Requires independent second-agent review or completion before integration.
- **BLOCKED**: Blocked on missing external credentials (Super Admin TOTP).
- **SUPERSEDED**: Already present in target release base (0 code delta).

---

### Step 1: Base / Foundation Layer
1. **AUD-ACADEMICS-01** (`origin/agentb/academics-audit`)
   - **State:** **SUPERSEDED**
   - **Rationale:** 0 code delta against `origin/student-directory-hardening`; all changes already present in base.

2. **AUD-PUBLIC-01** (`origin/audit/agent-c/AUD-PUBLIC-01-public-admissions`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Self-contained public pages, rate-limiting, and token security. 0 code collisions.

3. **AUD-STUDENT-01** (`origin/audit/agent-a/AUD-STUDENT-01-student-portal`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Student portal security boundaries and anti-IDOR checks. 0 code collisions.

4. **AUD-PARENT-01** (`origin/audit/agent-a/AUD-PARENT-01-parent-portal`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Parent portal sibling isolation and guardian anti-IDOR. 0 code collisions.

---

### Step 2: Operational & Calendar Subsystems
5. **AUD-CALENDAR-01** (`origin/audit/agent-c/AUD-CALENDAR-01-events-calendar`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Academic & events calendar schedule boundaries (F-01). 0 code collisions.

6. **AUD-OPS-01** (`origin/audit/agent-c/AUD-OPS-01-transport-hostel`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Transport vehicle routes & hostel residency overdue-instant fix. 0 code collisions.

7. **AUD-ANALYTICS-01** (`origin/audit/agent-c/AUD-ANALYTICS-01-analytics-direction`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Executive dashboard finance KPIs following `libs/finance/definitions.ts`. 0 code collisions.

8. **AUD-COMMS-01** (`origin/audit/agent-c/AUD-COMMS-01-communication-documents`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Authoritative broadcast announcements delivery truth. 0 code collisions.

9. **AUD-LIBINV-01** (`origin/audit/agent-c/AUD-LIBINV-01-library-inventory`)
   - **State:** **SAFE TO INTEGRATE**
   - **Rationale:** Library and inventory Casablanca business-date midnight fix. 0 code collisions.

---

### Step 3: Workforce, Safety & Admissions
10. **AUD-HR-01** (`origin/audit/agent-a/AUD-HR-01-hr-payroll`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** HR employee profile UUID/matricule resolution & salary advances ledger. 0 code collisions.

11. **AUD-SAFETY-01** (`origin/audit/agent-b/AUD-SAFETY-01`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** Security guard badge scan idempotency, gate validation, visitor check-in. 0 code collisions.

12. **AUD-ADMISSIONS-02** (`origin/audit/agent-a/AUD-ADMISSIONS-02-admissions-enrollment`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** Student admissions lifecycle, sequential matricules, CNDP guardian consent. 0 code collisions.

13. **AUD-LIVE-01** (`origin/audit/agent-d/AUD-LIVE-01-live-classrooms`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** Live classrooms atomic PostgreSQL join-token anti-replay durability. Minor tsconfig addition.

14. **AUD-SUPPORT-RECEPTION-01** (`origin/audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-reception`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** Support desk file attachment security & tenant isolation. Supplementary to reception.

---

### Step 4: Core Intersecting Domains (Strict Order)
15. **AUD-TEACHER-01** (`origin/audit/agent-b/AUD-TEACHER-01`)
    - **State:** **SAFE TO INTEGRATE**
    - **Rationale:** Teacher portal scope & finance confidentiality hiding (`canSeeFinance` checks on `students/route.ts` and `students-list-client.tsx`). Must be integrated before `AUD-RECEPTION-01`.

16. **AUD-RECEPTION-01** (`origin/audit/agent-b/AUD-RECEPTION-01`)
    - **State:** **INTEGRATE AFTER AUD-TEACHER-01**
    - **Rationale:** Adds receptionist role to `students/route.ts` with front-desk projection. Proven 100% semantically compatible with teacher finance hiding.

17. **AUD-FINANCE-01** (`origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier`)
    - **State:** **INTEGRATE AFTER AUD-RECEPTION-01**
    - **Rationale:** Refactors `StudentGuardianProjection` out of `students/route.ts` into shared helper; introduces Migration 0156 (`0156_fine_assessment_unique.sql`); updates `locales/*.json`. Must integrate after students route changes.

18. **AUD-SETTINGS-01** (`origin/audit/agent-d/AUD-SETTINGS-01-users-roles-organization`)
    - **State:** **INTEGRATE AFTER AUD-FINANCE-01**
    - **Rationale:** Users, roles, and organization settings; adds Settings namespaces to `locales/*.json`. Clean additive merge on top of Finance translations.

---

### Step 5: Campaigns Awaiting Independent Verification / Remediation
19. **FIX-DASH-FIN-KPI-01** (`origin/audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance-kpi`)
    - **State:** **REVERIFY FIRST**
    - **Post-Verification Action:** **INTEGRATE AFTER AUD-FINANCE-01 & AUD-ANALYTICS-01**
    - **Rationale:** Code complete by `codex-2`; requires Agent 5 confirmation of invoice-based recovery formula before merge.

20. **AUD-CREDENTIALS-01** (`origin/audit/agent-a/AUD-CREDENTIALS-01-cards-certificates`)
    - **State:** **REVERIFY FIRST**
    - **Post-Verification Action:** **INTEGRATE AFTER AUD-STUDENT-01 & AUD-SETTINGS-01**
    - **Rationale:** Remediated by `antigravity-1` in commit `51a05736`; requires Agent 5 confirmation that 9 previously rejected visual routes mount cleanly.

21. **AUD-CRM-01** (`origin/audit/agent-c/AUD-CRM-01-crm-inquiries`)
    - **State:** **REVERIFY FIRST**
    - **Post-Verification Action:** **SAFE TO INTEGRATE**
    - **Rationale:** Code complete by `codex-2`; requires Agent 5 verification of applicant conversion locking.

22. **AUD-CONTENT-01** (`origin/audit/agent-d/AUD-CONTENT-01-attachments-book`)
    - **State:** **REVERIFY FIRST**
    - **Post-Verification Action:** **SAFE TO INTEGRATE**
    - **Rationale:** Code complete by `antigravity-d`; requires Agent 5 verification of 42-step E2E runtime test.

23. **AUD-WEBSITE-01** (`audit/agent-b/AUD-WEBSITE-01`)
    - **State:** **REVERIFY FIRST**
    - **Post-Verification Action:** **SAFE TO INTEGRATE**
    - **Rationale:** Audit in progress by `opencode-1`; awaiting completion and subsequent Agent 5 verification.

---

### Step 6: Blocked Campaign
24. **AUD-PLATFORM-01** (`origin/audit/agent-c/AUD-PLATFORM-01-platform-entitlements`)
    - **State:** **BLOCKED**
    - **Post-Unblock Action:** **INTEGRATE AFTER AUD-SETTINGS-01**
    - **Rationale:** Blocked on missing Super Admin TOTP credential on disk. Cannot be visually verified until test TOTP secret is provisioned.
