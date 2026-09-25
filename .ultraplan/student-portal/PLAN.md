# Student Portal: grades, report cards, exams, homework (plan STU-PORTAL-02)

Owner request (2026-09-25): "the student page is not informative: the bulletins, the modules, the exams, the notes, where are they?"
Plan author: claude-finance. Executor: one agent (see AGENT-PROMPT.md). Separate from the post-audit plan in `.ultraplan/PLAN.md`.

## Where it stands (measured 2026-09-25 on the main tree)

| What a student needs | Today | Already built elsewhere, reuse it |
|---|---|---|
| Grades (notes) | nothing | `api/guardian/me/children/[relationshipId]/results`: published-only query with a safe field list |
| Report cards (bulletins) | nothing | `issued_documents` (type `report_card`, `subject_id` = student, `status`, `render_data_snapshot`), issued by `api/students/report-card/issue`; `features/academics/services/report-card-service.ts` computes /20 averages with coefficients, rank and the Admis/Ajourné decision |
| Exams | nothing | `exam_schedules` (status draft/published, start_time, exam_hall_id, assessment_definition_id), `exam_seats` (student_id, hall); the student-scoped online exam list in `api/academics/online-exams` (role student) + `[examId]/take` |
| Homework | nothing | `HomeworkService.getHomeworkForStudent(tenantId, studentId)` (published, audience-matched) |
| Subjects (modules) | name + teacher only | `class_subjects.coefficient` |
| Today / timetable / attendance | exists | `api/student/me/{home,timetable,subjects,attendance}`, UI `features/student/ui/StudentPortalView.tsx` (4 tabs) |

Dev data for `etudiant.0001@atlas.ma`: 1 published grade, 0 issued report cards, 1 exam seat, 2 published exam schedules and 4 online exams in the tenant. Screens will look empty until S7 creates real data.

## Product rules (defaults; the owner can overturn any)

- **DS1 Grades:** a grade appears as soon as it is published (`moderation_state = 'published'`, status graded/exempted/absent). This is the same rule the parent portal uses, so parent and student always see the same grades.
- **DS2 Report cards:** only officially **issued** bulletins are listed and downloadable (`status = 'active'`, not revoked). Averages shown elsewhere are labelled **"Moyenne provisoire"**, never "bulletin".
- **DS3 Rank:** class rank appears only on the issued bulletin, never as a live number.
- **DS4 Out of scope:** bulletins in the parent portal, editing anything, notifications, new PDF designs. Log them as follow-ups.

## Invariants (non-negotiable)

1. The student id always comes from the session (`requireStudentContext` / `features/student/api/guard.ts`), never from the URL or body. A foreign id in a path gets a uniform 404.
2. Every query filters by `tenantId` and by the session student.
3. Unpublished grades, draft exam schedules and revoked/replaced bulletins never reach the student.
4. Safe fields only (allowlist). No marker ids, revisions, internal notes or other students' data. The rank is read only from the student's own snapshot.
5. New text goes through next-intl keys in fr/en/ar (`locales/*.json` are CRLF: match `\r?\n`, never create nested or duplicate namespaces). French is the reference; English and Arabic must exist but can be plain.

## Sections

Batch 1 runs S1–S5 (API, can run in parallel). Batch 2 is S6 (UI). Batch 3 is S7 (data + runtime check). S8 (tests) runs alongside each section: every API section ships with its tests.

---

### S1: Grades API (green)

<task id="S1-01">
  <name>Share the published-results query</name>
  <files>lango-app/src/features/assessment/services/published-results.ts (new), lango-app/src/app/api/guardian/me/children/[relationshipId]/results/route.ts</files>
  <action>Move the SELECT from the guardian results route, unchanged, into `getPublishedResultsForStudent(tenantId, studentId)`. The guardian route calls it. Do not change its filters or fields.</action>
  <verify>The existing guardian results tests still pass; `git diff` shows the query moved, not changed.</verify>
</task>

<task id="S1-02">
  <name>GET /api/student/me/results</name>
  <files>lango-app/src/app/api/student/me/results/route.ts (new)</files>
  <action>Student guard, then `getPublishedResultsForStudent(ctx.tenantId, ctx.userId)`. Return the list plus a per-subject summary: count, provisional average on /20 (normalized score), and the subject coefficient from class_subjects. Label it provisional in the field name (`provisionalAverage20`).</action>
  <verify>Tests (S8): own published grade shown; an unpublished grade of the same student hidden; another student's grade never returned; parent/teacher role gets 403; another tenant sees nothing.</verify>
</task>

### S2: Report cards API (yellow: PDF rendering reuse)

<task id="S2-01">
  <name>GET /api/student/me/report-cards</name>
  <files>lango-app/src/app/api/student/me/report-cards/route.ts (new)</files>
  <action>List `issued_documents` where tenant = session tenant, `type = 'report_card'`, `subject_id` = session student, `status = 'active'`, `revoked_at IS NULL`. Project from `render_data_snapshot` only: term label, school year, general average /20, mention, decision, rank / class size, issued date, id. Newest first.</action>
  <verify>Tests: issued bulletin listed; revoked one hidden; another student's bulletin hidden; fields limited to the list above.</verify>
</task>

<task id="S2-02">
  <name>GET /api/student/me/report-cards/[id]/pdf</name>
  <files>lango-app/src/app/api/student/me/report-cards/[id]/pdf/route.ts (new)</files>
  <action>Load the document with the same filters as S2-01 plus `id` (404 if not found or not owned). Render the PDF from the stored snapshot using the EXISTING renderer in `features/academics/services/report-card-document-service.ts` / the document system. Do not recompute grades: the student downloads exactly what was issued. If no existing function renders from a stored snapshot, STOP and report which function is missing. Do not write a new renderer.</action>
  <verify>Test: own bulletin returns application/pdf; another student's id returns 404; a revoked one returns 404.</verify>
</task>

### S3: Exams API (yellow: joins across assessment tables)

<task id="S3-01">
  <name>GET /api/student/me/exams</name>
  <files>lango-app/src/app/api/student/me/exams/route.ts (new)</files>
  <action>Published `exam_schedules` of the session tenant whose assessment definition targets the student's class (assessment_definitions -> class_subjects -> class of the student's class section). For each: subject, title, start/end time, hall name, and the student's own seat from `exam_seats` (same term + student) if any. Split into `upcoming` and `past` with Africa/Casablanca as "now". Add `onlineExams`: reuse the query behind the student branch of `api/academics/online-exams` (move it to a shared function if needed, unchanged), with the take-page link.</action>
  <verify>Tests: draft schedule hidden; another class's exam hidden; seat shown only for this student; past vs upcoming split correct around a fixed "now".</verify>
</task>

### S4: Homework API (green)

<task id="S4-01">
  <name>GET /api/student/me/homework</name>
  <files>lango-app/src/app/api/student/me/homework/route.ts (new)</files>
  <action>Student guard, then `HomeworkService.getHomeworkForStudent(ctx.tenantId, ctx.userId)`. No new logic.</action>
  <verify>Test: published homework for own section returned; another section's homework not returned.</verify>
</task>

### S5: Subjects enrichment (green)

<task id="S5-01">
  <name>Add coefficient, provisional average, open homework to /api/student/me/subjects</name>
  <files>lango-app/src/app/api/student/me/subjects/route.ts</files>
  <action>Keep the existing fields. Add per subject: `coefficient`, `provisionalAverage20` (from S1's shared query, null if no published grade), `openHomework` (count due today or later, from S4). No extra round trips per subject: compute in one pass.</action>
  <verify>Existing subjects test (if any) passes; a new test checks the added fields for one subject with and without grades.</verify>
</task>

### S6: Student portal UI (yellow: many states)

<task id="S6-01">
  <name>New tabs in StudentPortalView</name>
  <files>lango-app/src/features/student/ui/StudentPortalView.tsx (split into small tab components under features/student/ui/ only if the file passes ~600 lines), lango-app/locales/fr.json, en.json, ar.json</files>
  <action>
    Tabs, in order: Aujourd'hui · Emploi du temps · Matières · Notes · Examens · Devoirs · Bulletins · Présences.
    - Aujourd'hui gains 3 compact cards: next exam (date, subject, hall, seat), latest published grade, homework due next. Each links to its tab.
    - Matières: subject, teacher, coefficient, "Moyenne provisoire x/20" or "Pas encore de note", open homework count.
    - Notes: grouped by subject, newest first: title, type, score / max, date. Exempted/absent shown as words, not 0.
    - Examens: upcoming first (date, time, subject, hall, seat), then past; online exams with a "Commencer" button only when open.
    - Devoirs: due soon first, overdue marked, submitted marked.
    - Bulletins: one card per issued bulletin (term, general average /20, mention, decision, rank x/y, issued date) with "Télécharger le PDF".
    - Every tab: loading skeleton; an error state that says it failed (never an empty list on error); a useful empty state ("Aucun bulletin publié pour le moment").
    Match the existing SchoolOS styles in this file (colors, cards, tab bar). Mobile first at 390px; RTL with logical spacing (ms/me, ps/pe). Touch targets at least 44px.
  </action>
  <verify>check:types 0 errors; check:i18n:keys 0 missing; check:ui ratchet holds; screenshots in S7.</verify>
</task>

### S7: Real demo data + runtime check (yellow: touches the dev DB through the app)

<task id="S7-01">
  <name>Make the Atlas student's record realistic using the app itself</name>
  <files>none (data), artifacts in lango-app/artifacts/product-enhancements/STU-PORTAL-02/</files>
  <action>
    Use the school-admin and teacher screens or APIs on the dev server (never raw SQL) to create data for student 0001's class section:
    - grades in 4+ subjects, published;
    - one exam schedule published, with a seat;
    - 2 homeworks;
    - one report card issued for the published term.
    Record every step (who, which screen/API, result) in `evidence/data-steps.md`. If a step is impossible through the app, write down why: that is a product bug, report it.
  </action>
  <verify>data-steps.md lists each item created and its id.</verify>
</task>

<task id="S7-02">
  <name>Runtime sweep as the student</name>
  <files>lango-app/artifacts/product-enhancements/STU-PORTAL-02/screenshots/</files>
  <action>Log in as etudiant.0001@atlas.ma on the dev server (port 3111: auth only trusts that origin). Capture every tab at 1280px and 390px, plus Arabic RTL. Check that the Aujourd'hui cards match the tabs (same next exam, same latest grade). Download the PDF and confirm it matches the Bulletins card (average, mention, rank).</action>
  <verify>Screenshots present; a short contradictions table (card vs tab vs PDF), all consistent.</verify>
</task>

### S8: Tests (runs with every API section)

All on `schoolos_audit` only (`DATABASE_URL=postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit`; vitest refuses any other DB). Tests go in `lango-app/src/app/api/__tests__/student-portal-<area>.test.ts`, following the style of `guardians-domain.test.ts` in that folder. Every route must test: own data shown, another student hidden, unpublished/draft/revoked hidden, wrong role 403, other tenant empty.

## Done when

- The 5 new routes plus the enriched subjects route exist, each with passing tests.
- The portal shows 8 tabs with real data for student 0001, with screenshots at desktop, mobile and RTL.
- `npm run check:types`, `check:isolation`, `check:i18n:keys`, `check:ui` all pass.
- Hub: one `done` per section with real command output. Verification by a different agent.
