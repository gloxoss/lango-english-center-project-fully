# SchoolOS V1 — Page-by-Page AI UI Prompts Catalog

Production-grade UI prompts for generating AI mockups and component designs for all 25+ pages in SchoolOS V1.

---

## 1. Executive Command Center Dashboard
- **Route**: `/[locale]/dashboard`
- **Objective**: Provide school directors and admins with immediate operational situational awareness.
- **Layout**: Top metric cards row -> 2-column split (Left: Daily Attendance Chart + Urgent Action Cards; Right: Today's Class Schedule Timeline + Recent Financial Invoices).
- **Prompt**:
```
A modern executive command center dashboard for a Moroccan private school management platform named SchoolOS. Crisp emerald and off-white theme. Top bar with school selector "Lycée Al-Amal", language switcher (FR/AR/EN), and user profile. Top row features 4 metric cards: Total Students (485), Today's Attendance Rate (96.4%), Overdue Invoices (18,400 MAD), Flagged Unexcused Absences (12). Main body shows a daily attendance bar chart, a list of urgent action items with red/amber badges, today's schedule timeline, and quick-action buttons "1-Click Send Reminders" and "Import Students".
```

---

## 2. Student 360 Degree Profile (8 Tabs)
- **Route**: `/[locale]/dashboard/students/[id]`
- **Objective**: Comprehensive single-page view of a student's full academic, financial, attendance, and behavioral record.
- **Layout**: Left column student bio card (Photo, Name, Grade, Guardian contact) -> Right column tabbed container (Info, Academics, Enrollments, Attendance History, Moyenne & Grades /20, Invoices & Payments, Leaves, Discipline, Documents).
- **Prompt**:
```
A student 360-degree profile view in SchoolOS. Left side has a clean card with student photo, Name "Youssef El Amrani", ID "STU-2026-042", Grade "2ème Année Lycée", Parent Contact "+212 661 123456", and Status badge "Active (Green)". Right side features an 8-tab navigation bar: Info, Academics, Attendance (88%), Grades (/20), Invoices (Paid), Leaves, Discipline, Documents. The active tab shows a breakdown of Moroccan /20 subject scores with coefficients and trimester Moyenne (15.8/20 - Mention Bien).
```

---

## 3. Mobile Touch Attendance Grid
- **Route**: `/[locale]/dashboard/attendance`
- **Objective**: Rapid, 30-second mobile attendance marking for teachers on smartphones.
- **Layout**: Sticky header with Class Group dropdown ("Group 2B - Math") and Date selector -> Touch grid list of student cards with 4 large tap buttons per student (Present: Green, Absent: Red, Late: Yellow, Excused: Slate).
- **Prompt**:
```
A mobile-first touch attendance marking screen for a teacher on a smartphone. Header shows "2ème Année Lycée - Groupe B", Session "Mathematics 10:00 - 11:30". Student list rows have student name, photo thumbnail, and 4 large pill tap targets: [P (Green)], [A (Red)], [L (Amber)], [E (Slate)]. Bottom sticky bar displays progress "22/25 Marked" and a large primary green button "Submit Attendance Grid".
```

---

## 4. Excel Student Bulk Import Wizard
- **Route**: `/[locale]/dashboard/students/import`
- **Objective**: Onboard new schools in minutes by mapping messy Excel spreadsheets to student database schemas.
- **Layout**: 4-step wizard stepper bar (1. Upload -> 2. Map Columns -> 3. Validate Data -> 4. Complete) -> Active drag-and-drop zone and automated column mapping table.
- **Prompt**:
```
A 4-step Excel import wizard for SchoolOS. Top stepper bar shows Step 2 "Map Columns" active. Left side shows file summary "eleves_2026.xlsx (420 rows)". Main area displays a column mapping table comparing Excel headers (Nom, Prénom, Tél Parent, Classe) to database fields with green checkmarks for auto-mapped columns and dropdown selectors for manual mapping. Primary button "Validate & Review 420 Rows".
```

---

## 5. Moroccan Assessment & Moyenne Grade Spreadsheet
- **Route**: `/[locale]/dashboard/academics/assessments/[id]`
- **Objective**: High-density grade entry spreadsheet for teachers to input scores out of 20 with live Moyenne calculation.
- **Layout**: Header with Course Name, Trimester selector, Exam Weighting -> Spreadsheet grid with student rows, columns per assessment (Devoir 1, Devoir 2, Examen Final), Subject Coefficient column, and computed Moyenne column.
- **Prompt**:
```
A high-density grade entry spreadsheet for Moroccan curriculum scores out of 20. Columns: Student Name, Controle 1 (/20), Controle 2 (/20), Examen (/20), Coefficient (x3), Calculated Moyenne (/20), Class Rank, Mention badge. Sticky total header displays class average (14.2/20). Green primary button "Publish Trimester Grades".
```

---

## 6. Financial Invoicing & Payment Recorder
- **Route**: `/[locale]/dashboard/finance/invoices`
- **Objective**: Track fee collections, issue invoices, and record partial/full cash, check, or transfer payments.
- **Layout**: Top summary stats (Total Invoiced, Collected MAD, Overdue MAD) -> Invoices table with status badges -> Side drawer modal for recording new payment.
- **Prompt**:
```
A financial invoicing and payment tracker dashboard for a school accountant. Top cards show Total Invoiced (450,000 MAD), Collected (380,000 MAD), Overdue (70,000 MAD). Data table lists Invoices with Columns: Invoice #, Student, Class, Due Date, Total Amount, Paid Amount, Status (Paid: Green, Partial: Amber, Overdue: Red). An open payment modal displays payment method selectors (Cash, Check, Wire Transfer), amount input, and receipt print toggle.
```

---

## 7. Actionable SMS Reminders Surface
- **Route**: `/[locale]/dashboard/communication/reminders`
- **Objective**: Flag students with unexcused absences or overdue fees and trigger automated SMS alerts in 1 click.
- **Layout**: Top filter tabs (All Flagged, Overdue Fees, Unexcused Absences) -> Flagged student cards with pre-rendered message preview -> Prominent "1-Click Send All SMS Reminders" button.
- **Prompt**:
```
A communication dispatch surface for sending automated SMS reminders to parents. Filter tabs show "Overdue Fees (14)" selected. List of student cards shows Student Name, Parent Phone "+212 6...", Amount Overdue "1,500 MAD", and a rendered SMS message preview box: "Bonjour Mme El Amrani, nous vous rappelons que les frais de scolarité de Youssef pour le mois de Mars sont en retard...". Large primary green button "Send 14 SMS Reminders Now".
```

---

## 8. CNDP Moroccan Data Protection Compliance Tracker
- **Route**: `/[locale]/dashboard/settings/cndp`
- **Objective**: Ensure school compliance with Moroccan CNDP data privacy requirements (Form F211 declaration).
- **Layout**: Compliance badge header ("CNDP Status: Declared & Compliant") -> Form F211 details -> Data residency badge ("Morocco Hosted") -> Download official declaration PDF button.
- **Prompt**:
```
A CNDP Moroccan Data Privacy compliance dashboard for school governance. Header displays a green badge "CNDP Compliance Active — Declaration Form F211 Filed". Cards show Data Residency "Moroccan Local Data Center", Guardian Consent Status "98% Signed", and Data Protection Officer Contact. Action button "Generate Official CNDP Form F211 PDF".
```
