# SchoolOS (Lango Platform) V1 — Product Context & Architecture Map

## 1. Product Summary
**SchoolOS** is a comprehensive, multi-tenant school-management platform engineered for Moroccan private K-12 schools (primaire, collège, lycée), language training institutes, and private higher-education institutions. It replaces dated legacy desktop software with a modern, fast, trilingual (French, Arabic RTL, English) web experience that handles academics, mobile attendance, Moroccan `/20` grading, financial invoicing, automated SMS communication, and local CNDP compliance.

## 2. Target Audience & Operator Goals
- **School Director / Admin**: Complete school governance, real-time metrics, teacher workload monitoring, CNDP compliance status.
- **Teacher**: Mobile-first attendance marking (in 30 seconds on a smartphone) and grade entry for assigned subject classes.
- **Accountant / Bursar**: Defining fee structures, tracking payments, issuing invoices, recording partial/full payments in MAD.
- **Super Admin**: Multi-tenant platform onboarding, subscription tier management, and system logs.

## 3. Core Objects & Data Models
- **Tenant School**: Name, CNDP status, academic calendar, locale defaults.
- **Student**: Photo, CIN/MASSAR ID, Full Name, DOB, Guardians, Enrollment Status, 360 History.
- **Academic Program & Course**: Program level, Subject catalog, Moroccan Coefficient (/20 scale).
- **Class Group / Cohort**: Assigned students, primary teacher, room schedule.
- **Timetable Slot**: Day of week, start/end time, course group, room, assigned instructor.
- **Attendance Record**: Student ID, Date, Session ID, Status (Present, Absent, Late, Excused), Reason.
- **Assessment Result**: Student ID, Course ID, Score out of 20, Coefficient, Trimester Moyenne, Mention.
- **Invoice & Payment**: Invoice ID, Student ID, Fee breakdown, Amount Due (MAD), Amount Paid, Status (Paid, Partial, Overdue).
- **Message Template & Dispatch Log**: Trigger reason, Template body, Recipient guardian phone, Channel (SMS), Delivery Status.

## 4. Key Workflows & User Journeys
1. **Onboarding**: Admin creates tenant account -> imports student roster via Excel wizard -> assigns classes and teachers -> ready on Day 1.
2. **Daily Teaching**: Teacher opens web app on smartphone -> selects current session -> taps attendance grid (30s completion) -> records assessment scores.
3. **Daily Administration**: Director logs into Executive Command Center -> reviews flagged overdue fees & unexcused absences -> clicks 1-Click Send Reminders -> SMS dispatched to families.
4. **Term-End Evaluation**: Teacher enters exam grades -> engine computes Moyenne out of 20, Class Rank, and Mention -> Admin generates PDF Report Cards.
