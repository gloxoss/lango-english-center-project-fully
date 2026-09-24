# AUD-LIVE-01: Live Classrooms & Virtual Sessions — Route & API Inventory

## 1. Registered Dashboard Pages (7 Pages)

| # | Route | Purpose | File Location | Key Capabilities / Access |
|---|-------|---------|---------------|--------------------------|
| 1 | `/dashboard/academics/live-class` | Sessions List, upcoming/live/ended filters, search, provider badge | `src/app/[locale]/(dashboard)/dashboard/academics/live-class/page.tsx` | `live.read`, `live.manage` |
| 2 | `/dashboard/academics/live-class/new` | Session Wizard: class/section/subject selector, provider choice, policies | `src/app/[locale]/(dashboard)/dashboard/academics/live-class/new/page.tsx` | `live.manage` |
| 3 | `/dashboard/academics/live-class/[id]` | Studio / Session Detail: live controls, attendees, recordings, materials, attendance | `src/app/[locale]/(dashboard)/dashboard/academics/live-class/[id]/page.tsx` | `live.read`, `live.host`, `live.manage` |
| 4 | `/dashboard/academics/live-class-reports` | Analytics & Reports: presence rate, hours taught, sessions count, CSV export | `src/app/[locale]/(dashboard)/dashboard/academics/live-class-reports/page.tsx` | `live.reports.read`, `live.export` |
| 5 | `/dashboard/student/live-classes` | Student Portal: upcoming, active virtual sessions, single-use launch token | `src/app/[locale]/(dashboard)/dashboard/student/live-classes/page.tsx` | `live.join`, student role |
| 6 | `/dashboard/parent/live-classes` | Parent Portal: enrolled children session schedule, attendance outcomes | `src/app/[locale]/(dashboard)/dashboard/parent/live-classes/page.tsx` | `live.read`, parent role |
| 7 | `/dashboard/settings/live-classrooms` | Settings: BigBlueButton and Dev provider profiles, credentials, defaults | `src/app/[locale]/(dashboard)/dashboard/settings/live-classrooms/page.tsx` | `live.manage`, admin role |

---

## 2. API Routes Registry (24 Endpoints)

| # | Method | Endpoint | Handler File | Capabilities / Scope | Audit Status |
|---|--------|----------|--------------|----------------------|--------------|
| 1 | `GET` | `/api/addons/live-classrooms/sessions` | `src/app/api/addons/live-classrooms/sessions/route.ts` | `live.read` | PASS |
| 2 | `POST` | `/api/addons/live-classrooms/sessions` | `src/app/api/addons/live-classrooms/sessions/route.ts` | `live.manage` | PASS |
| 3 | `GET` | `/api/addons/live-classrooms/sessions/[id]` | `src/app/api/addons/live-classrooms/sessions/[id]/route.ts` | `live.read` | PASS |
| 4 | `PATCH` | `/api/addons/live-classrooms/sessions/[id]` | `src/app/api/addons/live-classrooms/sessions/[id]/route.ts` | `live.manage` | PASS |
| 5 | `DELETE` | `/api/addons/live-classrooms/sessions/[id]` | `src/app/api/addons/live-classrooms/sessions/[id]/route.ts` | `live.manage` | PASS |
| 6 | `POST` | `/api/addons/live-classrooms/sessions/[id]/start` | `src/app/api/addons/live-classrooms/sessions/[id]/start/route.ts` | `live.host` | PASS |
| 7 | `POST` | `/api/addons/live-classrooms/sessions/[id]/end` | `src/app/api/addons/live-classrooms/sessions/[id]/end/route.ts` | `live.host` | PASS |
| 8 | `POST` | `/api/addons/live-classrooms/sessions/[id]/join` | `src/app/api/addons/live-classrooms/sessions/[id]/join/route.ts` | `live.join` | PASS |
| 9 | `POST` | `/api/addons/live-classrooms/join/redeem` | `src/app/api/addons/live-classrooms/join/redeem/route.ts` | Anti-replay token | PASS |
| 10 | `GET` | `/api/addons/live-classrooms/sessions/[id]/attendance` | `src/app/api/addons/live-classrooms/sessions/[id]/attendance/route.ts` | `live.attendance.manage` | PASS |
| 11 | `POST` | `/api/addons/live-classrooms/sessions/[id]/attendance/reconcile` | `src/app/api/addons/live-classrooms/sessions/[id]/attendance/reconcile/route.ts` | `live.attendance.manage` | PASS |
| 12 | `POST` | `/api/addons/live-classrooms/sessions/[id]/attendance/post` | `src/app/api/addons/live-classrooms/sessions/[id]/attendance/post/route.ts` | `live.attendance.manage` | PASS |
| 13 | `GET` | `/api/addons/live-classrooms/sessions/[id]/recordings` | `src/app/api/addons/live-classrooms/sessions/[id]/recordings/route.ts` | `live.recordings.read` | PASS |
| 14 | `POST` | `/api/addons/live-classrooms/sessions/[id]/recordings` | `src/app/api/addons/live-classrooms/sessions/[id]/recordings/route.ts` | `live.recordings.manage` | PASS |
| 15 | `DELETE` | `/api/addons/live-classrooms/sessions/[id]/recordings/[recordingId]` | `src/app/api/addons/live-classrooms/sessions/[id]/recordings/[recordingId]/route.ts` | `live.recordings.manage` | PASS |
| 16 | `GET` | `/api/addons/live-classrooms/sessions/[id]/materials` | `src/app/api/addons/live-classrooms/sessions/[id]/materials/route.ts` | `live.read` | PASS |
| 17 | `POST` | `/api/addons/live-classrooms/sessions/[id]/materials` | `src/app/api/addons/live-classrooms/sessions/[id]/materials/route.ts` | `live.manage` | PASS |
| 18 | `DELETE` | `/api/addons/live-classrooms/sessions/[id]/materials/[materialId]` | `src/app/api/addons/live-classrooms/sessions/[id]/materials/[materialId]/route.ts` | `live.manage` | PASS |
| 19 | `GET` | `/api/addons/live-classrooms/providers` | `src/app/api/addons/live-classrooms/providers/route.ts` | `live.manage` | PASS |
| 20 | `POST` | `/api/addons/live-classrooms/providers` | `src/app/api/addons/live-classrooms/providers/route.ts` | `live.manage` | PASS |
| 21 | `PATCH` | `/api/addons/live-classrooms/providers/[id]` | `src/app/api/addons/live-classrooms/providers/[id]/route.ts` | `live.manage` | PASS |
| 22 | `GET` | `/api/addons/live-classrooms/reports/overview` | `src/app/api/addons/live-classrooms/reports/overview/route.ts` | `live.reports.read` | PASS |
| 23 | `GET` | `/api/addons/live-classrooms/reports/sessions` | `src/app/api/addons/live-classrooms/reports/sessions/route.ts` | `live.reports.read`, `live.export` | PASS |
| 24 | `POST` | `/api/addons/live-classrooms/webhooks/[provider]` | `src/app/api/addons/live-classrooms/webhooks/[provider]/route.ts` | HMAC Webhook Verifier | PASS |
