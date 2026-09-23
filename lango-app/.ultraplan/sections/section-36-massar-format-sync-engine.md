# Section 36: Massar National Format Sync Engine

## 1. Overview & Business Value
Provides full compatibility with the Moroccan Ministry of National Education (MEN) Massar platform, allowing school administrators to export student rosters and marksheets in the exact official Massar Excel/CSV specification, as well as importing Massar marksheets directly into SchoolOS gradebooks.

## 2. Target Files & Architecture
- **Massar Service**: `src/features/academics/services/massar-sync-service.ts` [NEW]
  - `generateMassarStudentRoster(tenantId, classSectionId)`: Generates Excel file conforming to MEN Massar column structure (Code Massar, Nom, Prénom en arabe, Prénom en français, Date de naissance, Genre, Filière, Numéro d'ordre).
  - `generateMassarMarksheet(tenantId, examTermId, classSectionId, subjectId)`: Generates Moroccan official marksheet with /20 grading scale, subject coefficient, and exam period header.
  - `parseAndImportMassarMarks(tenantId, fileBuffer, examTermId, subjectId)`: Reads uploaded Massar notes file, matches students by `Code Massar` (stored in `user.nationalId`), validates Moroccan grades (0.00 to 20.00), and creates/updates `assessmentResults`.
- **API Endpoints**:
  - `GET /api/academics/massar/export/roster` [NEW]
  - `GET /api/academics/massar/export/marksheet` [NEW]
  - `POST /api/academics/massar/import/marks` [NEW]
- **UI Integrations**:
  - `src/features/academics/ui/marksheet-grid-view.tsx`: Add prominent "Export Massar (.xlsx)" and "Importer Notes Massar" action buttons with validation modal.
  - `src/features/students/ui/students-list-client.tsx`: Add "Export Massar" dropdown option in the export menu.

## 3. Acceptance Criteria
1. Generated Excel files match the official Moroccan MEN Massar schema headers.
2. Grades strictly bounded to Moroccan standard: $0.00 \leq \text{note} \leq 20.00$.
3. Matching by Massar code handles Moroccan formats (e.g. `R134567890`, `M120098765`).
4. Strict multi-tenant isolation on all import and export queries.
