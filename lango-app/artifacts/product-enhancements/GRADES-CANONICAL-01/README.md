# GRADES-CANONICAL-01: Canonical Grades & Publishing Workflow Verification

## 1. Executive Summary
- **Plan**: `GRADES-CANONICAL-01` (`.ultraplan/grades-canonical/PLAN.md`)
- **Agent**: `antigravity-grc-1`
- **Objective**: Establish `assessment_outcomes` + `assessment_definitions` as the single canonical grade store across SchoolOS (`GD1`), implement a formal publishing workflow (`GD3`), migrate all operational readers away from `assessment_results` (`GD2`, `GD4`), update the full seed script (`seed-full.ts`), and demonstrate end-to-end functionality with verifiable proof and screenshots.

---

## 2. Architectural Decisions & Invariants

| ID | Decision | Implementation |
|---|---|---|
| **GD1** | **Canonical Grade Store** | All teacher grading writes to `assessment_outcomes` and `assessment_definitions`. `assessment_results` is preserved as a read-only legacy table without operational writes or reads. |
| **GD2** | **Audience Scoping & Visibility** | Families (student and parent portals) see **strictly** `moderation_state = 'published'`. Staff screens (bulletins, class results, promotions, analytics) read outcomes in states `graded/exempted/absent` regardless of moderation state (except draft-withdrawn). |
| **GD3** | **Publishing Lifecycles** | 1. Exam term closing (`/api/academics/exam-terms/[id]/stage` -> `closed`) atomically publishes all term outcomes in the same transaction.<br>2. Assessments outside exam terms have a dedicated publish/unpublish endpoint (`/api/academics/assessment-definitions/[id]/publish`) scoped by tenant and teacher section assignment. |
| **GD4** | **Moroccan /20 Weighted Mean Engine** | Report card averages and bulletin calculations use subject coefficients from `class_subjects.coefficient`, normalising raw scores to the national /20 scale and properly handling exemptions and absences. |

---

## 3. Work Completed by Section

### GRC-01: Publishing Workflow
- Implemented `publishOutcomes` and `unpublishOutcomes` in [`src/features/assessment/services/outcome-service.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/assessment/services/outcome-service.ts).
- Added comprehensive unit tests in [`src/features/assessment/__tests__/outcome-publishing.test.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/assessment/__tests__/outcome-publishing.test.ts) (5/5 passing).
- Wired term closure to atomic outcome publishing in [`src/app/api/academics/exam-terms/[id]/stage/route.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/app/api/academics/exam-terms/[id]/stage/route.ts).
- Created publish/unpublish API endpoint in [`src/app/api/academics/assessment-definitions/[id]/publish/route.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/app/api/academics/assessment-definitions/[id]/publish/route.ts) with teacher section-scoping tests in [`src/app/api/__tests__/assessment-definition-publish.test.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/app/api/__tests__/assessment-definition-publish.test.ts) (4/4 passing).

### GRC-02: Report Cards on Canonical Store
- Implemented staff outcomes reader [`src/features/assessment/services/staff-results.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/assessment/services/staff-results.ts) with `getSectionOutcomes` and `getStudentOutcomes` (3/3 unit tests passing in [`src/features/assessment/__tests__/staff-results.test.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/assessment/__tests__/staff-results.test.ts)).
- Refactored [`src/features/academics/services/report-card-service.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/academics/services/report-card-service.ts) to read from `getSectionOutcomes`.
- Updated test suites in [`report-card-scale.test.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/academics/services/__tests__/report-card-scale.test.ts) and [`report-card-term-scope.test.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/features/academics/services/__tests__/report-card-term-scope.test.ts) (7/7 passing).

### GRC-03: Other Readers Migration
- Migrated all remaining operational readers from `assessment_results` to canonical outcomes:
  - `src/app/api/academics/class-results/route.ts`
  - `src/app/api/students/promotions/preview/route.ts`
  - `src/app/api/analytics/route.ts`
  - `src/app/api/students/route.ts`
  - `src/app/api/students/placements/auto/route.ts`
  - `src/app/api/academics/classes/roster/route.ts`
  - `src/app/api/academics/assessment-sessions/route.ts`
  - `src/libs/services/student-lifecycle.ts`
- Verified domain test suites pass:
  - `src/features/academics/services/__tests__/promotion-preview-bulletin.test.ts` (1/1 passing)
  - `src/app/api/__tests__/promotion-service-domain.test.ts` (21/21 passing)

### GRC-04: Full Database Seed Upgrade
- Updated [`src/scripts/seed-full.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/src/scripts/seed-full.ts):
  - Removed all inserts into legacy `assessment_results`.
  - Created 80 canonical `assessment_definitions` across all 4 class levels (`3ème`, `2nde`, `1ère`, `Terminale`) for both Term 1 and Term 2.
  - Linked `assessmentAudiences` to all 12 class sections.
  - Inserted 4,000 `assessment_outcomes` (3,000 published, 1,000 draft).
  - Verified bulletin generation yields 200/200 complete student report cards with accurate /20 weighted averages.

---

## 4. End-to-End Proof Execution (GRC-05)

The automated script [`run-e2e-proof.ts`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/artifacts/product-enhancements/GRADES-CANONICAL-01/run-e2e-proof.ts) was executed against the active dev server on port 3111 with the following verification steps:

### E2E Step Table

| Step | Action | Method / Route | Response / Verification | Screenshot |
|---|---|---|---|---|
| **0** | Identify Test Entities | Drizzle DB Query | Student: Sabrine Jbilou (`STU-0001`), Section: `8fc33469-201e...` (3ème), Subject: Mathématiques | N/A |
| **1** | Teacher enters draft score | Direct Outcome Insert / Grade Entry | `rawScore = '17.50'`, `moderationState = 'draft'` | N/A |
| **2** | Student Portal Check (Draft Invisibility) | `GET /api/student/me/results` | `foundDraftInApi: NO (CORRECT: INVISIBLE)`. Draft grade 17.50 is completely hidden from student. | `01_student_grades_draft_invisible_desktop_fr.png`<br>`02_student_grades_draft_invisible_390px.png`<br>`03_student_grades_draft_invisible_ar_desktop.png` |
| **3** | Parent Portal Check (Draft Invisibility) | Browser navigation to `/fr/dashboard/parent` | Student `STU-0001` draft score is hidden from linked guardian. | `04_parent_draft_invisible_desktop_fr.png` |
| **4** | Teacher/Admin Publishes Assessment | `POST /api/academics/assessment-definitions/[id]/publish` | Status: `200 OK`<br>`{ "success": true, "data": { "count": 1 } }`<br>DB state updated: `moderationState = 'published'`. | N/A |
| **5** | Student Portal Check (Published Visibility) | `GET /api/student/me/results` | `foundPublishedInApi: YES (SUCCESS)`. Grade 17.50/20 is now visible to student. | `05_student_grades_published_visible_desktop_fr.png`<br>`06_student_grades_published_visible_390px.png`<br>`07_student_grades_published_visible_ar_desktop.png` |
| **6** | Parent Portal Check (Published Visibility) | Browser navigation to `/fr/dashboard/parent` | Published grade is now visible in linked children academic summary. | `08_parent_published_visible_desktop_fr.png` |
| **7** | Class Results & Report Card Verification | `GET /api/academics/class-results?classSubjectId=...` | Status: `200 OK`, `success: true`. Staff results view displays student outcomes. | `09_class_results_desktop_fr.png`<br>`10_grade_entry_view_desktop_fr.png` |

---

## 5. Verification Gates & Proof Checklist

| Check | Command | Result |
|---|---|---|
| **TypeScript Types** | `npm run check:types` | **0 errors (passed)** |
| **Tenant Isolation** | `npm run check:isolation` | **Passed (844 files checked)** |
| **i18n Translations** | `npm run check:i18n:keys` | **0 missing keys in 0 files (passed)** |
| **UI Reality Ratchet** | `npm run check:ui` | **Ratchet holding (0 mock screens, 1 dead control baseline)** |
| **Unit / DB-Backed Tests** | `npx vitest run ...` | **41 passed across 7 test files (100% pass)** |
| **Operational Grep** | `git grep -n "assessmentResults" lango-app/src` | **Zero operational reads/writes** (only schema & relations remain) |

---

## 6. Screenshots Gallery

All screenshots are stored in [`artifacts/product-enhancements/GRADES-CANONICAL-01/screenshots/`](file:///c:/Users/OMEN/OneDrive/Documents/projects/lango-english-center-project-fully/lango-app/artifacts/product-enhancements/GRADES-CANONICAL-01/screenshots):
- `01_student_grades_draft_invisible_desktop_fr.png` (French desktop - draft hidden)
- `02_student_grades_draft_invisible_390px.png` (Mobile 390px responsive - draft hidden)
- `03_student_grades_draft_invisible_ar_desktop.png` (Arabic RTL desktop - draft hidden)
- `04_parent_draft_invisible_desktop_fr.png` (Parent portal - draft hidden)
- `05_student_grades_published_visible_desktop_fr.png` (French desktop - published score visible)
- `06_student_grades_published_visible_390px.png` (Mobile 390px responsive - published score visible)
- `07_student_grades_published_visible_ar_desktop.png` (Arabic RTL desktop - published score visible)
- `08_parent_published_visible_desktop_fr.png` (Parent portal - published score visible)
- `09_class_results_desktop_fr.png` (Staff class results page)
- `10_grade_entry_view_desktop_fr.png` (Teacher grade entry interface)
