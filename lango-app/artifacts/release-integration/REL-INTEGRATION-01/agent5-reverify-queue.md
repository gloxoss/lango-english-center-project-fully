# REL-INTEGRATION-01: Agent 5 Verification Queue

**Generated:** 2026-09-24T23:55:00Z  
**Release Base:** `origin/student-directory-hardening` (`f42c2bc`)  
**Auditor:** Agent B (REL-INTEGRATION-01 Replacement Executor)

---

## 1. Queue Priority Guidelines
- **P0**: Security, authentication, multi-tenant isolation, data loss, credential forgery.
- **P1**: Financial truth, money handling, permissions, tenant boundaries.
- **P2**: Operational workflow, UI hydration, visual rendering.

> **CRITICAL RULE**: Agent B does not perform verification. The items below must be independently executed, swept, and verified by Agent 5 (`antigravity-2` or designated verifier).

---

## 2. Active Verification Queue

### [P0] `AUD-PLATFORM-01`: Platform Entitlements & Tenant Lifecycle
- **Branch:** `origin/audit/agent-c/AUD-PLATFORM-01-platform-entitlements`
- **Remote HEAD:** `8cdf9d33f04ce6b75ee909fcc14c15ae969aed80`
- **Executor:** `codex-2`
- **Current Status:** **BLOCKED** on missing Super Admin TOTP.
- **Concrete Mismatch / Barrier:**
  - Live super_admin portal cannot be logged into or audited without the TOTP secret file.
  - Runtime verification blocked; visual sweeps incomplete for super-admin views.
- **Action Required Before Agent 5 Sweep:**
  - Provide `TOTP_SECRET_FILE` or test secret fixture.
- **Minimum Tests Agent 5 Must Run:**
  ```bash
  cd lango-app
  npx vitest run src/features/subscriptions/__tests__/
  npm run check:types
  npm run check:isolation
  ```
- **Evidence / Screenshots Agent 5 Must Inspect:**
  - Verify super_admin pages render without bypass; verify tenant creation, addon suspension, plan downgrade, and license expiry rules.

---

### [P1] `AUD-CREDENTIALS-01`: Student Cards, Certificates, Convocations & Verification Engine
- **Branch:** `origin/audit/agent-a/AUD-CREDENTIALS-01-cards-certificates`
- **Remote HEAD:** `51a05736ec9af7441506bba08982b9888afaeb29`
- **Executor:** `antigravity-1`
- **Current Status:** **REMEDIATED BY EXECUTOR (2026-09-24T23:52:29Z) — AWAITING AGENT 5 RE-VERIFICATION**.
- **Historical Concrete Mismatch:**
  - Agent 5 previously REJECTED initial submission due to:
    1. Template Designer runtime error during component mounting.
    2. Definition detail page crash.
    3. 9 unhydrated/error screenshots showing Next.js Error Badges.
- **Remediation Completed by Executor:**
  - Fixed `header.tsx`, `sidebar.tsx`, and `impersonation-banner.tsx` hydration mismatches.
  - Recaptured 9 visual routes in `artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/evidence/runtime-browser-remediation.md`.
  - Claimed 8/8 tests clean and Next.js portal Error Badge = false.
- **Minimum Tests Agent 5 Must Run:**
  ```bash
  cd lango-app
  npx vitest run src/features/certificates/__tests__/credentials-domain-e2e.test.ts
  npm run check:types
  npm run check:isolation
  ```
- **Screenshots / Visual Evidence Agent 5 Must Inspect:**
  - Inspect all 9 remediated screenshots in `lango-app/artifacts/page-audit/done/AUD-CREDENTIALS-01__student-credentials/` across desktop FR, mobile 390, and Arabic RTL. Verify Template Designer canvas mounts cleanly with 0 errors.

---

### [P1] `AUD-CRM-01`: CRM Inquiries, Leads Pipeline & Prospect Conversion
- **Branch:** `origin/audit/agent-c/AUD-CRM-01-crm-inquiries`
- **Remote HEAD:** `5497a019f8c454e50f7413dde7c06287eeb3049d`
- **Executor:** `codex-2`
- **Current Status:** **MARKED DONE BY EXECUTOR — NEVER INDEPENDENTLY VERIFIED**.
- **Concrete Concern / Mismatch:**
  - Executor logged completion at 21:30:17Z, but no independent Agent 5 verification was recorded.
  - Executor flagged an unaddressed schema limitation: converting a lead to an applicant fabricates placeholder phone `0600000000` because `applicants.phone` is `NOT NULL`, potentially dialable.
- **Minimum Tests Agent 5 Must Run:**
  ```bash
  cd lango-app
  npx vitest run src/features/crm src/app/api/crm
  npm run check:types
  npm run check:isolation
  ```
- **Screenshots / Visual Evidence Agent 5 Must Inspect:**
  - 6 screenshots in `lango-app/artifacts/page-audit/done/AUD-CRM-01__crm-inquiries/`: Desktop FR kanban, teacher role honest 403 access denial, mobile 390, Arabic RTL.

---

### [P1] `FIX-DASH-FIN-KPI-01`: Main Dashboard Finance KPI Truth
- **Branch:** `origin/audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance-kpi`
- **Remote HEAD:** `8203068e8a82eacb3954c58764746748d890f1d3`
- **Executor:** `codex-2`
- **Current Status:** **MARKED DONE BY EXECUTOR — FOLLOW-UP OPEN & UNVERIFIED**.
- **Concrete Concern / Mismatch:**
  - Executor fixed the top-level collection rate formula `(invoiced - outstanding)/invoiced <= 100%`.
  - However, executor explicitly noted in follow-up: `monthlyBreakdown[].remaining` is STILL cash-based (`max(0, invoiced - cash)`), which leaves a sub-level contradiction in per-month breakdown bars.
  - No independent Agent 5 verification recorded.
- **Minimum Tests Agent 5 Must Run:**
  ```bash
  cd lango-app
  npx vitest run src/features/dashboard/__tests__/finance-kpi-truth.test.ts
  npm run check:types
  npm run check:isolation
  ```
- **Screenshots / Visual Evidence Agent 5 Must Inspect:**
  - Before/after screenshots in `lango-app/artifacts/page-audit/done/FIX-DASH-FIN-KPI-01__dashboard-finance-kpi/`: Verify pulse rate and recovery rate display truthful values without cosmetic clamping.

---

### [P2] `AUD-CONTENT-01`: Attachments Book & Academic Resources Add-on
- **Branch:** `origin/audit/agent-d/AUD-CONTENT-01-attachments-book`
- **Remote HEAD:** `b71022c0a54cc1419e845393134b6d2c7454c59d`
- **Executor:** `antigravity-d`
- **Current Status:** **MARKED DONE BY EXECUTOR (2026-09-24T23:43:36Z) — UNVERIFIED**.
- **Concrete Concern / Mismatch:**
  - Recently finished; no second agent has validated the 42-step runtime E2E test or inspected the 9 captured screenshots.
- **Minimum Tests Agent 5 Must Run:**
  ```bash
  cd lango-app
  npx tsx scripts/test-attachments-runtime-e2e.ts
  npm run check:types
  npm run check:isolation
  ```
- **Screenshots / Visual Evidence Agent 5 Must Inspect:**
  - 9 screenshots in `lango-app/artifacts/page-audit/done/AUD-CONTENT-01__attachments-book/` verifying academic resource attachments UI across viewports.

---

### [P2] `AUD-WEBSITE-01`: School Website CMS & Theme Engine
- **Branch:** `audit/agent-b/AUD-WEBSITE-01`
- **Remote HEAD:** `6f3b143782c312e2de3f51ee4267c801eb510e2a`
- **Executor:** `opencode-1`
- **Current Status:** **IN PROGRESS (ACTIVE CLAIM)**.
- **Concrete Concern / Mismatch:**
  - Active work in progress; not ready for verification until executor marks done.

---

## 3. Queue Summary

| Priority | Campaign | Branch HEAD | Core Verification Focus |
|---|---|---|---|
| **P0** | `AUD-PLATFORM-01` | `8cdf9d3` | Super Admin authentication, TOTP fixture, tenant lifecycle |
| **P1** | `AUD-CREDENTIALS-01`| `51a0573` | Re-verify Designer mounting, definition details, 9 remediated screenshots |
| **P1** | `AUD-CRM-01` | `5497a01` | Independent verification of 17 tests, phone fabrication review |
| **P1** | `FIX-DASH-FIN-KPI-01`| `8203068` | Validate recovery rate truth and monthly breakdown remaining logic |
| **P2** | `AUD-CONTENT-01` | `b71022c` | Validate 42-step runtime E2E test and 9 screenshots |
| **P2** | `AUD-WEBSITE-01` | `6f3b143` | Await executor completion, then verify CMS and theme scoping |
