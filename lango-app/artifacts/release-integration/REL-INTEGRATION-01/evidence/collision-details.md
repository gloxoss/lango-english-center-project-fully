# Evidence: File Collision & Semantic Overlap Analysis

## 1. Executive Summary
Of the 21 unmerged candidate branches, exactly **7 pairwise overlaps** exist across application and configuration files. All other candidate branches touch completely isolated modules and directories.

---

## 2. Detailed Collision Pairs & Semantic Resolution

### Pair 1: `AUD-FINANCE-01` ↔ `AUD-SETTINGS-01`
- **Overlapping Files (4)**:
  1. `.agent-hub/CHANGELOG.md`
  2. `lango-app/locales/ar.json`
  3. `lango-app/locales/en.json`
  4. `lango-app/locales/fr.json`
- **Semantic Overlap**:
  - `CHANGELOG.md`: Standard append-only changelog entries from two independent executors. Both are chronological and non-contradictory.
  - `locales/*.json`: Both branches added namespace keys for S-7 localization compliance. `AUD-FINANCE-01` added Finance, cashier, and receipt translation tokens; `AUD-SETTINGS-01` added Users, Roles, Permissions, and SettingsHub namespaces.
- **Likely Textual Conflict**: Low to Moderate (JSON object top-level keys).
- **Resolution Strategy**: Merge `AUD-SETTINGS-01` first, then perform key-level additive merge of `AUD-FINANCE-01` locale tokens. Both suites run `npm run check:i18n` and `npm run check:i18n:keys` to guarantee zero collisions.

---

### Pair 2: `AUD-RECEPTION-01` ↔ `AUD-TEACHER-01`
- **Overlapping Files (2)**:
  1. `lango-app/src/app/api/students/route.ts`
  2. `lango-app/src/features/students/ui/students-list-client.tsx`
- **Semantic Overlap**:
  - `src/app/api/students/route.ts`:
    - `AUD-RECEPTION-01` unblocks receptionists by allowing directory search under least-privilege projection (name, matricule, class, status) without financial or private notes.
    - `AUD-TEACHER-01` enforces teacher role scoping (teachers only see students in their assigned classes; financial balance columns are completely masked/omitted).
  - `students-list-client.tsx`:
    - Column rendering adaptations for role-specific viewports (receptionist quick lookup vs teacher class roster).
- **Compatibility Status**: **CONFIRMED COMPATIBLE**. Both campaigns enforce complementary role boundaries under `requireRequestContext()`. The receptionist branch adds least-privilege projection, and the teacher branch adds class-scoped filtering and removes finance leakage.
- **Resolution Strategy**: Integrate `AUD-RECEPTION-01` first to establish least-privilege projection, then layer `AUD-TEACHER-01` class-scoping.

---

### Pair 3 & 4: `AUD-FINANCE-01` ↔ `AUD-RECEPTION-01` & `AUD-TEACHER-01`
- **Overlapping File (1)**:
  - `lango-app/src/app/api/students/route.ts`
- **Semantic Overlap**:
  - `AUD-FINANCE-01` provides cashier-specific fields (`balance`, `invoicesDueCount`, `lastPaymentDate`) to authorized billing staff.
  - `AUD-TEACHER-01` strips these exact fields for teachers.
  - `AUD-RECEPTION-01` strips these fields for receptionists.
- **Compatibility Status**: **COMPATIBLE**. Role-based field selection in `students/route.ts` must use explicit projection:
  ```ts
  if (role === 'teacher') return projectTeacherFields(student);
  if (role === 'receptionist') return projectReceptionistFields(student);
  if (isFinanceRole(role)) return projectFinanceFields(student);
  ```
- **Resolution Strategy**: Integrate `AUD-RECEPTION-01` and `AUD-TEACHER-01` first. When integrating `AUD-FINANCE-01`, preserve the teacher and receptionist masking branches intact.

---

### Pair 5, 6 & 7: `AUD-LIVE-01` ↔ `AUD-SETTINGS-01` ↔ `AUD-CREDENTIALS-01`
- **Overlapping File (1)**:
  - `lango-app/tsconfig.json`
- **Semantic Overlap**:
  - Minor compiler option adjustments (paths or strictness flags).
- **Resolution Strategy**: Trivial textual union.

---

## 3. Collision Matrix Table

| Branch A | Branch B | Overlapping Files | Severity | Resolution Risk |
|---|---|---|---|---|
| `AUD-FINANCE-01` | `AUD-SETTINGS-01` | `CHANGELOG.md`, `locales/*.json` (4) | Low | Low (additive JSON) |
| `AUD-RECEPTION-01` | `AUD-TEACHER-01` | `students/route.ts`, `students-list-client.tsx` (2) | Medium | Low (classified compatible) |
| `AUD-FINANCE-01` | `AUD-RECEPTION-01` | `students/route.ts` (1) | Medium | Low (role projection union) |
| `AUD-FINANCE-01` | `AUD-TEACHER-01` | `students/route.ts` (1) | Medium | Low (role projection union) |
| `AUD-LIVE-01` | `AUD-SETTINGS-01` | `tsconfig.json` (1) | Trivial | None |
| `AUD-LIVE-01` | `AUD-CREDENTIALS-01`| `tsconfig.json` (1) | Trivial | None |
| `AUD-SETTINGS-01`| `AUD-CREDENTIALS-01`| `tsconfig.json` (1) | Trivial | None |

All other 16 branches have 0 application file collisions against one another.
