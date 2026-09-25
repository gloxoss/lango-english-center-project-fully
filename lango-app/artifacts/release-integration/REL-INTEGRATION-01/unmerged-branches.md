# REL-INTEGRATION-01: Unmerged Branches Analysis

**Generated:** 2026-09-24T23:55:00Z  
**Release Base:** `origin/student-directory-hardening` (`f42c2bc41cb2386afed52244c5355c31c8a91f96`)  
**Auditor:** Agent B (REL-INTEGRATION-01 Replacement Executor)

---

## 1. Methodology
To determine the exact integration status of each campaign branch, we used:
1. `git merge-base origin/student-directory-hardening <branch>`
2. `git cherry origin/student-directory-hardening <branch>`
3. `git diff --stat origin/student-directory-hardening...<branch>`
4. `git patch-id` and commit content comparison

A branch is classified as:
- **MERGED**: All commits are part of base ancestry or commit patch-ids are present.
- **NOT MERGED**: Distinct unmerged commits (`cherry +`) and positive code delta against base.
- **PARTIALLY PRESENT**: Certain files from the branch are in base, but other key files or commits are unmerged.
- **SUPERSEDED**: Branch changes have been completely superseded or incorporated by a newer commit on base (zero code delta).

---

## 2. Unmerged Branches Table (Trusted Verified Campaigns)

| Campaign ID | Branch | Remote HEAD | Cherry (+) | Changed Files | Insertions / Deletions | Status |
|---|---|---|---|---|---|---|
| `AUD-PARENT-01` | `origin/audit/agent-a/AUD-PARENT-01-parent-portal` | `8f7d980` | +2 | 17 files | +245 / -5 | **NOT MERGED** |
| `AUD-OPS-01` | `origin/audit/agent-c/AUD-OPS-01-transport-hostel` | `c44d20f` | +2 | 64 files | +1,056 / -14 | **NOT MERGED** |
| `AUD-COMMS-01` | `origin/audit/agent-c/AUD-COMMS-01-communication-documents` | `f8bee5f` | +2 | 52 files | +898 / -15 | **NOT MERGED** |
| `AUD-STUDENT-01` | `origin/audit/agent-a/AUD-STUDENT-01-student-portal` | `348630d` | +1 | 20 files | +863 / -0 | **NOT MERGED** |
| `AUD-PUBLIC-01` | `origin/audit/agent-c/AUD-PUBLIC-01-public-admissions` | `a509402` | +2 | 24 files | +590 / -7 | **NOT MERGED** |
| `AUD-ADMISSIONS-02` | `origin/audit/agent-a/AUD-ADMISSIONS-02-admissions-enrollment` | `5edc4ff` | +1 | 19 files | +989 / -0 | **NOT MERGED** |
| `AUD-SETTINGS-01` | `origin/audit/agent-d/AUD-SETTINGS-01-users-roles-organization` | `127d5be` | +2 | 50 files | +3,998 / -892 | **NOT MERGED** |
| `AUD-LIBINV-01` | `origin/audit/agent-c/AUD-LIBINV-01-library-inventory` | `26a4f7b` | +2 | 42 files | +755 / -25 | **NOT MERGED** |
| `AUD-TEACHER-01` | `origin/audit/agent-b/AUD-TEACHER-01` | `05d907a` | +3 | 106 files | +2,226 / -287 | **NOT MERGED** |
| `AUD-SUPPORT-RECEPTION-01` | `origin/audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-rec` | `3298b13` | +2 | 18 files | +569 / -7 | **NOT MERGED** |
| `AUD-HR-01` | `origin/audit/agent-a/AUD-HR-01-hr-payroll` | `c6fb4b3` | +2 | 22 files | +1,849 / -76 | **NOT MERGED** |
| `AUD-ANALYTICS-01` | `origin/audit/agent-c/AUD-ANALYTICS-01-analytics-direction` | `e8a9e36` | +2 | 26 files | +548 / -33 | **NOT MERGED** |
| `AUD-RECEPTION-01` | `origin/audit/agent-b/AUD-RECEPTION-01` | `d38140d` | +2 | 69 files | +1,602 / -135 | **NOT MERGED** |
| `AUD-FINANCE-01` | `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier` | `85f0571` | +5 | 66 files | +2,694 / -293 | **NOT MERGED** |
| `AUD-CALENDAR-01` | `origin/audit/agent-c/AUD-CALENDAR-01-events-calendar` | `a37ecc2` | +2 | 19 files | +516 / -3 | **NOT MERGED** |
| `AUD-SAFETY-01` | `origin/audit/agent-b/AUD-SAFETY-01` | `a68d644` | +4 | 68 files | +1,715 / -20 | **NOT MERGED** |
| `AUD-LIVE-01` | `origin/audit/agent-d/AUD-LIVE-01-live-classrooms` | `7a2c36f` | +2 | 23 files | +1,838 / -1 | **NOT MERGED** |
| `AUD-ACADEMICS-01` | `origin/agentb/academics-audit` | `f42c2bc` | 0 | 0 files | 0 / 0 | **SUPERSEDED / MERGED** |

---

## 3. Analysis of Non-Trusted / Reverify Branches

| Campaign ID | Branch | Remote HEAD | Cherry (+) | Changed Files | Insertions / Deletions | Status | Notes |
|---|---|---|---|---|---|---|---|
| `AUD-CRM-01` | `origin/audit/agent-c/AUD-CRM-01-crm-inquiries` | `5497a01` | +2 | 17 files | +509 / -51 | **NOT MERGED** | Needs Agent 5 verification |
| `AUD-CONTENT-01` | `origin/audit/agent-d/AUD-CONTENT-01-attachments-book` | `b71022c` | +1 | 17 files | +1,455 / -6 | **NOT MERGED** | Needs Agent 5 verification |
| `FIX-DASH-FIN-KPI-01` | `origin/audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance` | `8203068` | +2 | 14 files | +483 / -3 | **NOT MERGED** | Needs Agent 5 verification |
| `AUD-CREDENTIALS-01` | `origin/audit/agent-a/AUD-CREDENTIALS-01-cards-certificates` | `51a0573` | +2 | 58 files | +2,210 / -170 | **NOT MERGED** | Remediated, needs Agent 5 reverification |
| `AUD-PLATFORM-01` | `origin/audit/agent-c/AUD-PLATFORM-01-platform-entitlements` | `8cdf9d3` | +3 | 26 files | +858 / -26 | **NOT MERGED** | BLOCKED on missing TOTP |
| `AUD-WEBSITE-01` | `audit/agent-b/AUD-WEBSITE-01` | `6f3b143` | +1 | 18 files | +440 / -31 | **NOT MERGED** | Active WIP under opencode-1 |

---

## 4. Key Findings
1. Exactly **17 trusted verified branches** are genuinely unmerged and contain active application enhancements, security fixes, and compliance hardening.
2. `AUD-ACADEMICS-01` (`origin/agentb/academics-audit`) has **0 code delta** against base `f42c2bc` because its fixes (`S-11`, `S-12`, `S-14`) were merged into `origin/student-directory-hardening` prior to this audit.
3. No cherry commits from the 17 trusted unmerged branches have been cherry-picked into `f42c2bc` under alternative commit hashes; their diffs remain 100% unmerged.
