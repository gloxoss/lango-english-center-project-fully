# STU-PORTAL-02: Real Demo Data Creation (Section S7-01)

**Date:** 2026-09-25  
**Actor:** `antigravity-stu-1`  
**Target Student:** `STU-0001` (Sabrine Jbilou) · `etudiant.0001@atlas.ma`  
**Tenant:** Groupe Scolaire Atlas (`9c496194-2fcc-41f3-ad8a-fd728850f168`)  
**Class Section:** 3ème A (`8fc33469-201e-4c11-a70f-c8229ebdd606`)  
**Origin / Base URL:** `http://localhost:3111` (Trusted origin)

---

## 1. Summary of Items Created

| Item | Entity Type | ID | Endpoint | Status |
|---|---|---|---|---|
| **Homework 1** | `assessment_definitions` + `homework_details` | `f585f1ad-6c47-406a-8a64-1cd094696d0c` | `POST /api/academics/homework` | 201 Created |
| **Homework 2** | `assessment_definitions` + `homework_details` | `e66ae6a6-bd74-446f-9aea-7760606f09b7` | `POST /api/academics/homework` | 201 Created |
| **Exam Term** | `exam_terms` | `cfaef58d-7128-4447-9dd1-be101c7c94eb` | `POST /api/academics/exam-terms` | 201 Created |
| **Exam Schedule** | `exam_schedules` | `5b01620b-a064-4297-8b85-b70f102fa1da` | `POST /api/academics/exam-schedules` | 201 Created |
| **Exam Seat** | `exam_seats` (Pre-existing) | `1a687ccd-1de8-4c9f-be6a-90917073764c` | Linked via `Semestre 1` + `Salle 1` | Verified (Seat 1, Desk D1, CND-0001) |
| **Report Card** | `issued_documents` | `941583af-675e-4634-9b7d-1142fddc5f43` | `POST /api/students/report-card/issue` | 201 Created |
| **Grades (Français)** | `assessment_outcomes` (Pre-existing) | `0271eff6-fa04-4076-8213-e1b268480064` | Seeded (`moderation_state = 'published'`) | 16/20 (Très Bien, Graded) |
| **Grades (New Subjects)** | `assessment_outcomes` | `7e3157be-c1d4-4a43-8ef6-85d8c976a690` | `POST /api/academics/grade-entry` | 200 OK (`moderation_state = 'draft'`) — **Product Bug Reported** |

---

## 2. Step-by-Step Execution Log

### Step 1: Authentication as School Administrator
- **Actor:** `y.elamrani@atlas.ma` (Yassine El Amrani, `school_admin`)
- **API Call:** `POST /api/auth/sign-in/email`
- **Request:**
  ```json
  {
    "email": "y.elamrani@atlas.ma",
    "password": "Admin123!"
  }
  ```
- **Response:** HTTP 200 OK  
  Received session token cookie `better-auth.session_token`.

---

### Step 2: Create Homework 1 (Mathématiques)
- **Actor:** `y.elamrani@atlas.ma`
- **API Call:** `POST /api/academics/homework`
- **Request Body:**
  ```json
  {
    "classSubjectId": "affa875d-d3d7-4491-bec5-b8becfa7cb3c",
    "sectionIds": ["8fc33469-201e-4c11-a70f-c8229ebdd606"],
    "studentIds": ["STU-0001"],
    "title": "Devoir maison : Théorème de Thalès et trigonométrie",
    "description": "Exercices 42 à 48 page 89 du manuel de mathématiques.",
    "instructions": "Rédiger sur copie double. Toutes les étapes de calcul doivent être justifiées.",
    "maximumScore": 20,
    "coefficient": 1,
    "allowAttachments": true,
    "maxAttachments": 3,
    "lateSubmissionPolicy": "accept_flag",
    "closeAt": "2026-10-02T17:58:02.067Z"
  }
  ```
- **Response:** HTTP 201 Created
- **Created ID:** `f585f1ad-6c47-406a-8a64-1cd094696d0c`
- **Verification:** Reflected immediately in `GET /api/student/me/homework` and increases `openHomework` to 1 on Mathématiques in `GET /api/student/me/subjects`.

---

### Step 3: Create Homework 2 (Physique-Chimie)
- **Actor:** `y.elamrani@atlas.ma`
- **API Call:** `POST /api/academics/homework`
- **Request Body:**
  ```json
  {
    "classSubjectId": "925e7e5d-cfa4-4d00-b533-859181829abd",
    "sectionIds": ["8fc33469-201e-4c11-a70f-c8229ebdd606"],
    "studentIds": ["STU-0001"],
    "title": "Compte-rendu de TP : Conductivité et ions en solution",
    "description": "Rapport complet sur la manipulation du jeudi 24 septembre.",
    "instructions": "Inclure le schéma du montage, le tableau de mesures et l'interprétation des résultats.",
    "maximumScore": 20,
    "coefficient": 1,
    "allowAttachments": true,
    "maxAttachments": 2,
    "lateSubmissionPolicy": "accept_flag",
    "closeAt": "2026-10-05T17:58:02.332Z"
  }
  ```
- **Response:** HTTP 201 Created
- **Created ID:** `e66ae6a6-bd74-446f-9aea-7760606f09b7`
- **Verification:** Reflected in `GET /api/student/me/homework` and sets `openHomework: 1` for Physique-Chimie in `GET /api/student/me/subjects`.

---

### Step 4: Create Exam Schedule for Semestre 1 (Français 3ème) with Seat
- **Actor:** `y.elamrani@atlas.ma`
- **Pre-existing Seat:** Student `STU-0001` holds seat `1a687ccd-1de8-4c9f-be6a-90917073764c` in exam term `e7f5b92e-92c7-4854-ab90-4792557fc63d` (Semestre 1), exam hall `09c8ab9b-e182-4928-bab2-ad8a5ee1655a` (Salle 1), Seat Number 1, Desk D1, Candidate Number `CND-0001`.
- **Target Assessment Definition:** `94de0351-29e2-49fe-91a0-0a873c38d5e4` ("Examen – Français (3ème)").
- **API Call:** `POST /api/academics/exam-schedules`
- **Request Body:**
  ```json
  {
    "examTermId": "e7f5b92e-92c7-4854-ab90-4792557fc63d",
    "assessmentDefinitionId": "94de0351-29e2-49fe-91a0-0a873c38d5e4",
    "examHallId": "09c8ab9b-e182-4928-bab2-ad8a5ee1655a",
    "startTime": "2026-10-10T17:58:02.382Z",
    "endTime": "2026-10-10T19:58:02.382Z"
  }
  ```
- **Response:** HTTP 201 Created
- **Created ID:** `5b01620b-a064-4297-8b85-b70f102fa1da` (Status: `published`)
- **Verification:** Reflected in `GET /api/student/me/exams` under `upcoming`:
  - Title: "Examen – Français (3ème)"
  - Subject: "Français"
  - Hall: "Salle 1"
  - Seat: `{ "seatNumber": 1, "deskLabel": "D1", "candidateNumber": "CND-0001" }`

---

### Step 5: Create Exam Term Window & Issue Official Report Card
- **Actor:** `y.elamrani@atlas.ma`
- **Background Context:** The student holds continuous assessment result `7824d561-ed37-47e7-8d05-814cfcf3d3d1` ("Français – CC4", 80% / 16 on 20) with assessment date `2026-08-26`. The initial Semestre 1 date window ended in January 2026.
- **Sub-step 5a: Create Session Exam Term**
  - **API Call:** `POST /api/academics/exam-terms`
  - **Request Body:**
    ```json
    {
      "name": "Session Principale 2026",
      "code": "SP-2026",
      "startDate": "2026-08-01",
      "endDate": "2026-09-30"
    }
    ```
  - **Response:** HTTP 201 Created
  - **Created ID:** `cfaef58d-7128-4447-9dd1-be101c7c94eb`
- **Sub-step 5b: Issue Official Report Card Document**
  - **API Call:** `POST /api/students/report-card/issue`
  - **Request Body:**
    ```json
    {
      "studentId": "STU-0001",
      "examTermId": "cfaef58d-7128-4447-9dd1-be101c7c94eb"
    }
    ```
  - **Response:** HTTP 201 Created
  - **Created Document ID:** `941583af-675e-4634-9b7d-1142fddc5f43`
  - **Computed Snapshot:**
    - Term Label: "Bulletin scolaire"
    - School Year: "3ème A"
    - General Average: 16/20
    - Mention: "Très Bien"
    - Decision: "Admis"
    - Rank: 4 / 17
    - Issued Date: `2026-09-25 17:58:54.833745`
  - **PDF Verification:** `GET /api/student/me/report-cards/941583af-675e-4634-9b7d-1142fddc5f43/pdf` returns HTTP 200 OK (`application/pdf`, 7,256 bytes).

---

## 3. Product Bug Report: Grade Entry & Moderation Publishing

### Requirement:
*"Grades in 4+ subjects, published"* (Section S7-01).

### Observed Behavior:
1. **Schema Rejection on Definition Creation:**
   - Calling `POST /api/academics/assessment-definitions` with `classSubjectId` returns:
     ```json
     {
       "success": false,
       "error": {
         "code": "VALIDATION_ERROR",
         "message": "body: Unrecognized key: \"classSubjectId\""
       }
     }
     ```
     `createDefinitionSchema` is configured with `.strict()` and excludes `classSubjectId`. If created without `classSubjectId`, the definition has `classSubjectId = null`, preventing any join to `class_subjects` and `subjects`.
2. **Outcomes Locked in Draft State:**
   - Grade entry via `POST /api/academics/grade-entry` or `POST /api/academics/exam-terms/[id]/marksheet` executes `ExamMasterService.saveMarksheetGrid`, which calls `OutcomeService.recordOutcome`.
   - `OutcomeService.recordOutcome` inserts records hardcoded to `moderationState = 'draft'`.
3. **Absence of Outcome Publishing Endpoint:**
   - `PUT /api/academics/exam-terms/[id]/stage` advances terms to `closed` and sets `examTerms.isPublished = true`, but **never cascades** to transition child `assessmentOutcomes.moderationState` from `'draft'` to `'published'`.
   - The table `result_publications` exists in `assessment-schema.ts` but has zero controllers, services, or routes in the application.
   - Searching the entire codebase for `moderationState = 'published'` confirms that only `src/scripts/seed-full.ts` ever created published outcomes.
4. **Impact on Student Portal Invariant 3:**
   - Invariant 3 mandates: *"Unpublished grades (`moderation_state != 'published'`) must never reach the student."*
   - Therefore, newly entered grades remain invisible in `GET /api/student/me/results`.
   - Student `STU-0001` retains 1 authoritative published grade (Français, 16/20).

**Conclusion as instructed by PLAN.md:**  
*"If a step is impossible through the app, write down why: that is a product bug, report it."*  
This product bug is formally documented here.

---

## 4. Verification Check of Student Endpoints

All 8 student portal endpoints tested with session cookie of `etudiant.0001@atlas.ma`:

1. `GET /api/student/me/home`: 200 OK (Contains today classes, announcements, attendance, and placements).
2. `GET /api/student/me/results`: 200 OK (Returns Français 16/20, count 1, provisionalAverage20 16, coef 2).
3. `GET /api/student/me/exams`: 200 OK (Returns 1 upcoming published exam with hall & seat, plus 1 online exam).
4. `GET /api/student/me/homework`: 200 OK (Returns 2 homeworks: Mathématiques & Physique-Chimie).
5. `GET /api/student/me/report-cards`: 200 OK (Returns 1 active issued bulletin: 16/20, Très Bien, Admis, rank 4/17).
6. `GET /api/student/me/report-cards/[id]/pdf`: 200 OK (`application/pdf`, 7,256 bytes).
7. `GET /api/student/me/subjects`: 200 OK (Returns 10 subjects; Mathématiques & Physique-Chimie show `openHomework: 1`, Français shows `provisionalAverage20: 16`).
8. `GET /api/student/me/attendance`: 200 OK (Returns 8 present records, 0 absent, 100% attendance).
