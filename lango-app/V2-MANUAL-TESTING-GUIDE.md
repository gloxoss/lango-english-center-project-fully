# SchoolOS v2 — Manual Testing Guide for Reviewers

This document provides step-by-step instructions for non-technical reviewers to verify all v2 features in a browser using seeded test accounts.

---

## Seeded Test Accounts
All seeded test accounts use the password: `Admin123!`

- **Atlas School Admin**: `y.elamrani@atlas.ma` / `Admin123!` (Role: `school_admin`, Tenant: Groupe Scolaire Atlas)
- **SchoolOS Center Admin**: `admin@schoolos.ma` / `Admin123!` (Role: `school_admin`, Tenant: SchoolOS English Center)
- **Platform Super Admin**: `superadmin@schoolos.ma` / `Admin123!` (Role: `super_admin`, Tenant: None)

---

## Phase 1 — Audit Fixes & Tenant-Isolation Verification

### 1. Header Notification Badge Verification
1. Log in at `http://localhost:3000/fr/login` as `y.elamrani@atlas.ma` / `Admin123!`.
2. Look at the top navigation header on the dashboard (`/fr/dashboard`).
3. Observe the bell notification icon in the top right.
   - **Expected behavior**: The badge next to the bell displays the exact number of unjustified absences recorded for today (e.g., `0 Alerte` or `1 Alerte`), dynamically fetched from the database on page load rather than hardcoded text.
4. Click on the bell icon to expand the notifications menu.
   - **Expected behavior**: Displays the summary line with `Aujourd'hui` and a direct link to the real attendance module (`/fr/dashboard/attendance`).

---

### 2. Multi-Tenant Isolation Spot Check
1. In Browser Window A, log in as `y.elamrani@atlas.ma` (Atlas School Admin).
2. Go to **Élèves > Repertoire** (`/fr/dashboard/students`).
3. Note the matricules and names of students belonging to Atlas.
4. In Browser Window B (or Incognito), log in as `admin@schoolos.ma` (SchoolOS Center Admin).
5. Go to **Élèves > Repertoire** (`/fr/dashboard/students`).
6. **Expected result**: None of the students from Groupe Scolaire Atlas are visible in SchoolOS's directory. Each tenant sees exclusively its own data.

---

### 3. Teacher Scope & Role Security
1. Log in as a teacher account (or a restricted role).
2. Navigate to **Saisie des présences** (`/fr/dashboard/attendance`).
3. **Expected result**: The class and section dropdown pickers list only the class-sections that this teacher is assigned to teach via the academic structure, avoiding exposure of unassigned sections across the school.

---

## Attendance Module — Flags, Excuses & Audit Dashboard (`ATTENDANCE-IMPLEMENTATION-PLAN.md`, 2026-07-31)

### 4. Real-time absence flag detection
1. Log in as `admin@schoolos.ma` / `Admin123!`.
2. Go to **Présence > Présence Mobile** (`/fr/dashboard/attendance`), pick any class, mark one student **Absent**, save.
3. Go to **Présence > Audit & Alertes** (`/fr/dashboard/attendance/audit`).
4. **Expected result**: "Absences non justifiées" count under "Alertes par type" is at least 1, reflecting the student just marked absent — not a fabricated number.
5. Mark the same student absent again the next 2 real school days (weekdays only) in a row.
6. **Expected result**: A "Absences consécutives" alert also appears.

### 5. Excuse approval closes the loop
1. As a student/teacher/parent role (or via the API), submit an excuse for the absence marked above (reason text required, date must match).
2. Log in as `admin@schoolos.ma`, go to **Présence > Justificatifs** (`/fr/dashboard/attendance/excuses`).
3. Find the pending excuse for that student, click **Approuver**.
4. **Expected result**: The excuse moves to the "Approuvée" tab; going back to the student's profile page (`/fr/dashboard/students/<id>`), the "Taux de présence" KPI has recalculated upward; the matching "Absences non justifiées" alert on the audit page has cleared.

### 6. Missing-register queue (director audit dashboard)
1. Prerequisite: at least one real weekly schedule slot exists for today via **Matières & Classes > Emploi du temps** (built in an earlier session pass).
2. Log in as `admin@schoolos.ma`, go to **Présence > Audit & Alertes**.
3. If no attendance has been submitted yet today for that class-section's students, it appears under "Registres manquants aujourd'hui" with the class, subject, teacher, and time shown.
4. Click **Envoyer un rappel** — button changes to "Rappel envoyé"; check **SMS Communication > Envoyer des rappels** send-log to confirm a real (simulated) SMS row logged to the teacher.
5. Submit attendance for that class-section/date, refresh the audit page.
6. **Expected result**: The row disappears from the missing-register queue.

### 7. Student attendance heatmap
1. Log in as `admin@schoolos.ma`, open any student's profile (`/fr/dashboard/students/<id>`).
2. Scroll to **Historique de présence**.
3. **Expected result**: A calendar grid for the current month, colored per real attendance status (blue = présent, amber = retard, red = absent, purple = excusé, grey = weekend or no record). Use the arrows to navigate to a month with no data — grid should show an honest empty/grey state, not fabricated colors.

### 8. Tenant isolation on new attendance data
1. Repeat steps 4-5 while logged in as `y.elamrani@atlas.ma` (Atlas tenant).
2. **Expected result**: Atlas's flags, excuses, and audit KPIs are entirely independent of SchoolOS's — no cross-tenant leakage on `/dashboard/attendance/excuses`, `/dashboard/attendance/audit`, or `GET /api/attendance/flags`.
