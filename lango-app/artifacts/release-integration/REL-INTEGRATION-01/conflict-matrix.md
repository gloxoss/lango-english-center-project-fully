# Collision Matrix & Semantic Overlap — REL-INTEGRATION-01
**Target Base:** `origin/student-directory-hardening` (`f42c2bc4`)  
**Generated:** 2026-09-24T23:55:00Z  

---

## 1. Overlapping Files Summary Across Trusted Branches

Across all **17 trusted verified branches**, exactly **7 files** have overlapping modifications. All other files are modified by exactly one branch (100% disjoint).

| Overlapping File | Campaigns Involved | Category | Textual Conflict Risk | Semantic Overlap | Risk Severity |
|---|---|---|---|---|---|
| `lango-app/src/app/api/students/route.ts` | `AUD-FINANCE-01`, `AUD-RECEPTION-01`, `AUD-TEACHER-01` | Students API | Low (Non-overlapping blocks) | Harmonious least-privilege & projection extraction | **MEDIUM** |
| `lango-app/src/features/students/ui/students-list-client.tsx` | `AUD-RECEPTION-01`, `AUD-TEACHER-01` | Students UI | Low (Clean AST integration) | Independently classified compatible | **LOW** |
| `lango-app/locales/ar.json` | `AUD-FINANCE-01`, `AUD-SETTINGS-01` | Localization | Low (Additive JSON keys) | Independent domain namespaces | **LOW** |
| `lango-app/locales/en.json` | `AUD-FINANCE-01`, `AUD-SETTINGS-01` | Localization | Low (Additive JSON keys) | Independent domain namespaces | **LOW** |
| `lango-app/locales/fr.json` | `AUD-FINANCE-01`, `AUD-SETTINGS-01` | Localization | Low (Additive JSON keys) | Independent domain namespaces | **LOW** |
| `lango-app/tsconfig.json` | `AUD-LIVE-01`, `AUD-SETTINGS-01` *(+ AUD-CREDENTIALS-01)* | TypeScript Config | Low (Array union) | Isolated dev server dist directories | **LOW** |
| `.agent-hub/CHANGELOG.md` | `AUD-FINANCE-01`, `AUD-SETTINGS-01` | Agent Coordination | Low (Append-only) | Distinct release audit timestamps | **LOW** |

---

## 2. Deep Dive: High & Medium Risk Intersections

### Intersection 1: `lango-app/src/app/api/students/route.ts`
- **Branches Involved:**
  - `origin/audit/agent-b/AUD-TEACHER-01`
  - `origin/audit/agent-b/AUD-RECEPTION-01`
  - `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier`
- **Code Modifications by Campaign:**
  1. `AUD-TEACHER-01`:
     - Checks `await hasCapability(context.userId, tenantId, context.role, 'finance.read')`.
     - When false (e.g. teachers), zeroes `totalOverdueMAD`, `overdueStudentsCount`, `overdueFamiliesCount`.
     - In CSV export, conditionally omits `Situation Financiere`, `Montant Restant`, and `Montant Echu`.
     - Touches lines 672-690 and 781-815.
  2. `AUD-RECEPTION-01`:
     - Expands allowed roles in `requireRequestContext(request, ['school_admin', 'teacher', 'accountant', 'receptionist'])`.
     - In single-student detail GET, returns `frontDeskSafeDetail` (stripping medical/identity papers and academic history).
     - In list GET, applies `roleFilteredData` for receptionists (zeroing financial balances while preserving Massar code).
     - Touches lines 465-525 and 777-790.
  3. `AUD-FINANCE-01`:
     - Refactors inline `StudentGuardianProjection` types and helper into modular `@/libs/services/student-guardian-projection`.
     - Replaces inline declaration with clean import.
     - Touches lines 1-60.
- **Semantic Compatibility:**
  - Perfect alignment. Both receptionist and teacher lack `finance.read`, so the `canSeeFinance` capability check introduced by `AUD-TEACHER-01` harmonizes with the receptionist projection in `AUD-RECEPTION-01`.
  - The extraction of `student-guardian-projection.ts` in `AUD-FINANCE-01` is purely additive at the top of the file.
- **Recommended Integration Order:**
  1. Integrate `AUD-TEACHER-01` first.
  2. Integrate `AUD-RECEPTION-01` second.
  3. Integrate `AUD-FINANCE-01` third.

### Intersection 2: `lango-app/src/features/students/ui/students-list-client.tsx`
- **Branches Involved:**
  - `origin/audit/agent-b/AUD-TEACHER-01`
  - `origin/audit/agent-b/AUD-RECEPTION-01`
- **Code Modifications by Campaign:**
  1. `AUD-TEACHER-01`:
     - Introduces `canSeeFinance` flag based on user permissions.
     - Hides the Financial Status column in desktop table, mobile card, and student detail modals.
  2. `AUD-RECEPTION-01`:
     - Adds front-desk search shortcuts, visitor check-in actions, and quick enrollment triggers.
- **Semantic Compatibility:**
  - Verified and confirmed compatible by prior independent Agent 5 verification on both campaigns.
- **Recommended Integration Order:**
  - `AUD-TEACHER-01` -> `AUD-RECEPTION-01`.

### Intersection 3: Localization Dictionaries (`locales/*.json`)
- **Branches Involved:**
  - `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier`
  - `origin/audit/agent-d/AUD-SETTINGS-01-users-roles-organization`
- **Analysis:**
  - `AUD-FINANCE-01` added `formatMoney`, `currency`, and `cashier` keys.
  - `AUD-SETTINGS-01` added `SettingsHub`, `UsersManagement`, and `RolesPermissions` namespaces.
  - No namespace collisions exist between the two sets of changes.
- **Recommended Integration Order:**
  - Integrate `AUD-FINANCE-01` before `AUD-SETTINGS-01`.

### Intersection 4: TypeScript Configuration (`tsconfig.json`)
- **Branches Involved:** `AUD-LIVE-01`, `AUD-SETTINGS-01`, `AUD-CREDENTIALS-01`.
- **Analysis:**
  - Each branch added an entry to `include`: `".next-aud-live/..."` and `".next-aud-settings/..."`.
  - Resolution is a simple JSON array union.
- **Risk:** Negligible.

---

## 3. Disjoint / Collision-Free Campaigns

The following 12 trusted campaigns have **zero overlapping code files** with any other campaign branch:
1. `AUD-PUBLIC-01` (Public admissions & site hardening)
2. `AUD-STUDENT-01` (Student portal)
3. `AUD-PARENT-01` (Parent portal)
4. `AUD-CALENDAR-01` (Events & Academic calendar)
5. `AUD-OPS-01` (Transport & Hostel)
6. `AUD-ANALYTICS-01` (Analytics direction)
7. `AUD-COMMS-01` (Communication & Documents)
8. `AUD-LIBINV-01` (Library & Inventory)
9. `AUD-HR-01` (HR & Payroll)
10. `AUD-SAFETY-01` (Guard portal & Gates)
11. `AUD-ADMISSIONS-02` (Admissions & Enrollment)
12. `AUD-SUPPORT-RECEPTION-01` (Support desk attachments)

These 12 campaigns can be integrated in any sequence or in parallel without any textual or semantic friction.
