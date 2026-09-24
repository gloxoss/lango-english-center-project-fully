# Unmerged Branches Analysis — REL-INTEGRATION-01
**Target Base:** `origin/student-directory-hardening` (`f42c2bc41cb2386afed52244c5355c31c8a91f96`)  
**Methodology:** `git cherry`, `git merge-base`, `git branch --contains`, `git diff --name-status`, `git patch-id`.  
**Generated:** 2026-09-24T23:55:00Z  

---

## 1. Classification Matrix

Each branch is classified into one of four mutually exclusive states:
1. **MERGED**: All commits are part of `target base` history.
2. **SUPERSEDED**: All code modifications are already present in `target base` (0 code delta, identical patch IDs).
3. **PARTIALLY PRESENT**: Some commits/files have been cherry-picked into base, but branch has unique unintegrated commits.
4. **NOT MERGED**: Branch contains distinct unmerged commits and non-zero code deltas against base.

| Campaign ID | Remote Branch Name | HEAD SHA | Merge-Base with Target | Cherry Status (+ / total) | Code Delta vs Base | Classification |
|---|---|---|---|---|---|---|
| **AUD-ADMISSIONS-02** | `origin/audit/agent-a/AUD-ADMISSIONS-02-admissions-enrollment` | `5edc4ff4` | `f42c2bc4` | +1 / 1 | 19 files changed, 989 insertions(+) | **NOT MERGED** |
| **AUD-FINANCE-01** | `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier` | `85f05714` | `f42c2bc4` | +5 / 5 | 66 files changed, 2694 insertions(+), 293 deletions(-) | **NOT MERGED** |
| **AUD-HR-01** | `origin/audit/agent-a/AUD-HR-01-hr-payroll` | `c6fb4b31` | `f42c2bc4` | +2 / 2 | 22 files changed, 1849 insertions(+), 76 deletions(-) | **NOT MERGED** |
| **AUD-PARENT-01** | `origin/audit/agent-a/AUD-PARENT-01-parent-portal` | `8f7d9801` | `f42c2bc4` | +2 / 2 | 17 files changed, 245 insertions(+), 5 deletions(-) | **NOT MERGED** |
| **AUD-STUDENT-01** | `origin/audit/agent-a/AUD-STUDENT-01-student-portal` | `348630d8` | `f42c2bc4` | +1 / 1 | 20 files changed, 863 insertions(+) | **NOT MERGED** |
| **AUD-RECEPTION-01** | `origin/audit/agent-b/AUD-RECEPTION-01` | `d38140dc` | `f42c2bc4` | +2 / 2 | 69 files changed, 1602 insertions(+), 135 deletions(-) | **NOT MERGED** |
| **AUD-SAFETY-01** | `origin/audit/agent-b/AUD-SAFETY-01` | `a68d644b` | `f42c2bc4` | +4 / 4 | 68 files changed, 1715 insertions(+), 20 deletions(-) | **NOT MERGED** |
| **AUD-TEACHER-01** | `origin/audit/agent-b/AUD-TEACHER-01` | `05d907ae` | `f42c2bc4` | +3 / 3 | 106 files changed, 2226 insertions(+), 287 deletions(-) | **NOT MERGED** |
| **AUD-ANALYTICS-01** | `origin/audit/agent-c/AUD-ANALYTICS-01-analytics-direction` | `e8a9e36e` | `f42c2bc4` | +2 / 2 | 26 files changed, 548 insertions(+), 33 deletions(-) | **NOT MERGED** |
| **AUD-CALENDAR-01** | `origin/audit/agent-c/AUD-CALENDAR-01-events-calendar` | `a37ecc26` | `f42c2bc4` | +2 / 2 | 19 files changed, 516 insertions(+), 3 deletions(-) | **NOT MERGED** |
| **AUD-COMMS-01** | `origin/audit/agent-c/AUD-COMMS-01-communication-documents` | `f8bee5f1` | `f42c2bc4` | +2 / 2 | 52 files changed, 898 insertions(+), 15 deletions(-) | **NOT MERGED** |
| **AUD-LIBINV-01** | `origin/audit/agent-c/AUD-LIBINV-01-library-inventory` | `26a4f7bd` | `f42c2bc4` | +2 / 2 | 42 files changed, 755 insertions(+), 25 deletions(-) | **NOT MERGED** |
| **AUD-OPS-01** | `origin/audit/agent-c/AUD-OPS-01-transport-hostel` | `c44d20f7` | `f42c2bc4` | +2 / 2 | 64 files changed, 1056 insertions(+), 14 deletions(-) | **NOT MERGED** |
| **AUD-PUBLIC-01** | `origin/audit/agent-c/AUD-PUBLIC-01-public-admissions` | `a5094026` | `f42c2bc4` | +2 / 2 | 24 files changed, 590 insertions(+), 7 deletions(-) | **NOT MERGED** |
| **AUD-SUPPORT-RECEPTION-01** | `origin/audit/agent-c/AUD-SUPPORT-RECEPTION-01-support-reception` | `3298b138` | `f42c2bc4` | +2 / 2 | 18 files changed, 569 insertions(+), 7 deletions(-) | **NOT MERGED** |
| **AUD-LIVE-01** | `origin/audit/agent-d/AUD-LIVE-01-live-classrooms` | `7a2c36f2` | `f42c2bc4` | +2 / 2 | 23 files changed, 1838 insertions(+), 1 deletion(-) | **NOT MERGED** |
| **AUD-SETTINGS-01** | `origin/audit/agent-d/AUD-SETTINGS-01-users-roles-organization` | `127d5bea` | `f42c2bc4` | +2 / 2 | 50 files changed, 3998 insertions(+), 892 deletions(-) | **NOT MERGED** |
| **AUD-CREDENTIALS-01** | `origin/audit/agent-a/AUD-CREDENTIALS-01-cards-certificates` | `51a05736` | `f42c2bc4` | +2 / 2 | 56 files changed, 2185 insertions(+), 170 deletions(-) | **NOT MERGED** |
| **AUD-CRM-01** | `origin/audit/agent-c/AUD-CRM-01-crm-inquiries` | `5497a019` | `f42c2bc4` | +2 / 2 | 17 files changed, 509 insertions(+), 51 deletions(-) | **NOT MERGED** |
| **AUD-CONTENT-01** | `origin/audit/agent-d/AUD-CONTENT-01-attachments-book` | `b71022c0` | `f42c2bc4` | +1 / 1 | 17 files changed, 1455 insertions(+), 6 deletions(-) | **NOT MERGED** |
| **FIX-DASH-FIN-KPI-01** | `origin/audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance-kpi` | `8203068e` | `f42c2bc4` | +2 / 2 | 14 files changed, 483 insertions(+), 3 deletions(-) | **NOT MERGED** |
| **AUD-WEBSITE-01** | `audit/agent-b/AUD-WEBSITE-01` | `6f3b1437` | `f42c2bc4` | +1 / 1 | 18 files changed, 440 insertions(+), 31 deletions(-) | **NOT MERGED** |
| **AUD-PLATFORM-01** | `origin/audit/agent-c/AUD-PLATFORM-01-platform-entitlements` | `8cdf9d33` | `f42c2bc4` | +3 / 3 | 26 files changed, 858 insertions(+), 26 deletions(-) | **NOT MERGED** |
| **AUD-ACADEMICS-01** | `origin/agentb/academics-audit` | `f42c2bc4` | `f42c2bc4` | 0 / 0 | 0 files changed (NO DELTA) | **SUPERSEDED / MERGED** |
| *Admissions-Staff (C)* | `audit/agent-c/AUD-ADMISSIONS-STAFF-01-admissions-lifecycle` | `f42c2bc4` | `f42c2bc4` | 0 / 0 | 0 files changed (NO DELTA) | **SUPERSEDED / MERGED** |
| *Academic-Structure* | `origin/integration/academic-structure-audit` | `f42c2bc4` | `f42c2bc4` | 0 / 0 | 0 files changed (NO DELTA) | **SUPERSEDED / MERGED** |

---

## 2. Key Deductions

1. **Target Base Anchor:** Commit `f42c2bc4` (`origin/student-directory-hardening`) already incorporates all earlier base improvements:
   - S-14 broadcast parent nav gating
   - S-12 single generate entry point and canonical timetable grid
   - S-11 truthful empty-state titles
   - Attendance Phase 7B/8 & G15 closeout
2. **Genuinely Unmerged Verified Branches:** Exactly **17 branches** are verified, trusted, and genuinely unmerged.
3. **Genuinely Unmerged Pending Branches:** Exactly **5 branches** are unmerged and pending verification/remediation.
4. **Blocked Unmerged Branch:** Exactly **1 branch** (`AUD-PLATFORM-01`) is unmerged and blocked.
5. **No Code Delta Branches:** Exactly **3 branches** (`agentb/academics-audit`, `audit/agent-c/AUD-ADMISSIONS-STAFF-01`, `integration/academic-structure-audit`) are superseded/identical to target base `f42c2bc4`.
