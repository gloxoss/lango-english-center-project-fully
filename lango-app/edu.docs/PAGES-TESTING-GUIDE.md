# Academic Management Enhancement — Pages & Testing Guide

This document lists all **5 brand-new pages** built for the **Academic Management Enhancement (ADR-001)** implementation in SchoolOS. Each section includes the live URL, source code location, key features, and step-by-step instructions on how to test the implementation in your browser.

---

## 1. 🔄 Session Copy Workflow

- **Local App URL**: [http://localhost:3000/fr/dashboard/academics/session-copy](http://localhost:3000/fr/dashboard/academics/session-copy)
- **App Route File**: [`src/app/[locale]/(dashboard)/dashboard/academics/session-copy/page.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/app/%5Blocale%5D/%28dashboard%29/dashboard/academics/session-copy/page.tsx)
- **UI View Component**: [`src/features/academics/ui/session-copy-view.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/features/academics/ui/session-copy-view.tsx)
- **API Endpoint**: `POST /api/academics/class-offerings/copy`

### Key Features
- Clones entire class offerings, subject assignments, and teacher roles from a source session (`2025-2026`) to a destination session (`2026-2027`).
- **Dry-Run Mode (`Aperçu de la copie`)**: Displays preview metrics (offerings to create, subjects, teachers) without writing to DB.
- **Conflict Bypass & Idempotency**: Automatically skips existing target offerings (`onConflictDoNothing()`) to prevent `409 Conflict` errors.
- **Inline Session Creation**: Includes a `+ Créer Session 2026-2027` CTA if no target session exists yet.

### Step-by-Step Testing
1. Open [`http://localhost:3000/fr/dashboard/academics/session-copy`](http://localhost:3000/fr/dashboard/academics/session-copy).
2. Ensure **Session Source** is set to `2025-2026` and **Session Cible** is set to `2026-2027`.
3. Click **`Aperçu de la copie`** → Verify the preview card displays expected counts.
4. Click **`Confirmer la copie`** → Verify the green success notification appears (`La configuration académique a été copiée avec succès`).

---

## 2. 👩‍🏫 Teacher Assignment Workspace & Coverage Metrics

- **Local App URL**: [http://localhost:3000/fr/dashboard/academics/assignments](http://localhost:3000/fr/dashboard/academics/assignments)
- **App Route File**: [`src/app/[locale]/(dashboard)/dashboard/academics/assignments/page.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/app/%5Blocale%5D/%28dashboard%29/dashboard/academics/assignments/page.tsx)
- **UI View Component**: [`src/features/academics/ui/assignment-workspace-view.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/features/academics/ui/assignment-workspace-view.tsx)
- **API Endpoint**: `GET /api/academics/coverage`, `POST /api/academics/class-teachers`

### Key Features
- Live coverage gauges showing unassigned primary teachers and subject coverage percentage.
- High-density matrix mapping class sections to assigned primary and subject teachers.
- Teacher reassignment modal with role selection and historical tracking.

### Step-by-Step Testing
1. Open [`http://localhost:3000/fr/dashboard/academics/assignments`](http://localhost:3000/fr/dashboard/academics/assignments).
2. Check top metric cards (Unassigned Primary Teachers, Subject Coverage %).
3. Use the search input or section filter to isolate a specific class.
4. Click **`Reassigner Enseignant`** → Select an active teacher and submit → Verify matrix updates immediately.

---

## 3. 🎓 Student Promotion & Rollback Wizard

- **Local App URL**: [http://localhost:3000/fr/dashboard/academics/promotions](http://localhost:3000/fr/dashboard/academics/promotions)
- **App Route File**: [`src/app/[locale]/(dashboard)/dashboard/academics/promotions/page.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/app/%5Blocale%5D/%28dashboard%29/dashboard/academics/promotions/page.tsx)
- **UI View Component**: [`src/features/academics/ui/promotion-wizard-view.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/features/academics/ui/promotion-wizard-view.tsx)
- **API Endpoints**: `GET /api/students/promotions/preview`, `POST /api/students/promotions`, `POST /api/academics/promotions/revert`

### Key Features
- **3-Step Guided Wizard**:
  - Step 1: Select Source Class & Target Class.
  - Step 2: Live grade recommendations (`Promoted`, `Repeated`, `Conditional`).
  - Step 3: Capacity headroom check & batch execution.
- **Unlimited Capacity Support**: Correctly handles `capacity = null` without false warnings.
- **Rollback Tab (`Historique & Annulation`)**: Time-scoped dependency scan (`gte(batchCreatedAt)`), safely restoring predecessor student placements and `user.classSectionId`.

### Step-by-Step Testing
1. Open [`http://localhost:3000/fr/dashboard/academics/promotions`](http://localhost:3000/fr/dashboard/academics/promotions).
2. **Wizard Tab**:
   - Select Source Class (`1ère Année Bac`) and Target Class (`2ème Année Bac`).
   - Click **`Suivant`** → Review student decision list powered by `/api/students/promotions/preview`.
   - Click **`Valider le lot de promotion`** → Confirm promotion execution.
3. **Rollback Tab**:
   - Switch to the **`Historique & Annulation`** tab.
   - Locate the promotion batch you created → Click **`Annuler cette promotion`**.
   - Confirm revert → Verify students are restored to their previous class section.

---

## 4. 🏢 Room Directory & Capacity Management

- **Local App URL**: [http://localhost:3000/fr/dashboard/academics/rooms](http://localhost:3000/fr/dashboard/academics/rooms)
- **App Route File**: [`src/app/[locale]/(dashboard)/dashboard/academics/rooms/page.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/app/%5Blocale%5D/%28dashboard%29/dashboard/academics/rooms/page.tsx)
- **UI View Component**: [`src/features/academics/ui/rooms-view.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/features/academics/ui/rooms-view.tsx)
- **API Endpoint**: `GET /api/academics/rooms`, `POST /api/academics/rooms`

### Key Features
- Directory for physical rooms, science labs, computer labs, and auditoriums.
- Tracks room capacity, building assignment, floor level, and equipment tags.
- Room creation modal with validation.

### Step-by-Step Testing
1. Open [`http://localhost:3000/fr/dashboard/academics/rooms`](http://localhost:3000/fr/dashboard/academics/rooms).
2. Filter rooms by room type or building.
3. Click **`+ Ajouter une salle`** → Enter Room Code (e.g. `B-105`), Name, Capacity (e.g. `35`), and Building → Click **`Enregistrer`** → Confirm new room appears in grid.

---

## 5. 📊 Academic Readiness & CSV Export Dashboard

- **Local App URL**: [http://localhost:3000/fr/dashboard/academics/readiness](http://localhost:3000/fr/dashboard/academics/readiness)
- **App Route File**: [`src/app/[locale]/(dashboard)/dashboard/academics/readiness/page.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/app/%5Blocale%5D/%28dashboard%29/dashboard/academics/readiness/page.tsx)
- **UI View Component**: [`src/features/academics/ui/academic-readiness-view.tsx`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/src/features/academics/ui/academic-readiness-view.tsx)
- **API Endpoints**: `GET /api/academics/readiness`, `GET /api/academics/readiness/export`

### Key Features
- Real-time diagnostic score auditing 6 key system readiness checks:
  1. Class Offerings
  2. Class Teachers
  3. Curriculum Subjects
  4. Timetable Slots
  5. Room Capacity
  6. Student Placements
- One-click **CSV Report Export** generating downloadable diagnostic reports for school leadership.

### Step-by-Step Testing
1. Open [`http://localhost:3000/fr/dashboard/academics/readiness`](http://localhost:3000/fr/dashboard/academics/readiness).
2. Review the overall readiness score percentage and progress gauge.
3. Inspect diagnostic status cards (Green = Ready, Amber = Attention Needed).
4. Click **`Exporter Rapport CSV`** → Confirm `.csv` download triggers automatically.

---

## 📝 Educational Deep-Dive Document

For a full technical breakdown of the architecture, database schema relations, idempotency, and conflict-free copy algorithms, view the educational HTML tutorial document:
- 📁 **HTML Tutorial Path**: [`edu.docs/session-copy-workflow.html`](file:///c:/Users/oussama/oussama/OneDrive%20-%20%E9%9B%AA%E7%8E%B2%E5%9B%A2%E9%98%9F/Documents/schoolos/schoolos-english-center-project-fully/schoolos-app/edu.docs/session-copy-workflow.html)
