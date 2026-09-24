# AUD-LIVE-01 — Live Classrooms & Virtual Sessions — Executor Report

## 1. Handoff Metadata

- **Executor**: Agent D (antigravity-d)
- **Role**: Executor + Reporter only
- **Date**: 2026-09-24
- **Target branch**: `origin/student-directory-hardening`
- **Implementation branch**: `audit/agent-d/AUD-LIVE-01-live-classrooms`
- **Hub item**: `task:AUD-LIVE-01`
- **Done folder**: `lango-app/artifacts/page-audit/done/AUD-LIVE-01__live-classrooms/`
- **Active Ports Used**: 3114 (`task:port-3114`)

---

## 2. Scope

### Pages Audited (7 Pages)
| # | Route/Page | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/[locale]/dashboard/academics/live-class` | Admin, Teacher | Virtual sessions list: filters (upcoming, live, ended, all), search, provider indicator, new session CTA | PASS |
| 2 | `/[locale]/dashboard/academics/live-class/new` | Admin, Teacher | Session scheduling wizard: class section, subject, date & time, provider profile, policy configuration | PASS |
| 3 | `/[locale]/dashboard/academics/live-class/[id]` | Admin, Teacher | Live Studio / Detail: session status badge, start/end controls, attendee roster, materials, recordings, attendance post | PASS |
| 4 | `/[locale]/dashboard/academics/live-class-reports` | Admin, Teacher | Analytics & Reports: presence rate, hours taught, sessions count, detailed per-session records, CSV export | PASS |
| 5 | `/[locale]/dashboard/student/live-classes` | Student | Student Virtual Classroom: upcoming, live sessions, past sessions, secure launch join grant | PASS |
| 6 | `/[locale]/dashboard/parent/live-classes` | Parent | Parent Virtual Classroom: children selector, scheduled & completed classes, attendance status | PASS |
| 7 | `/[locale]/dashboard/settings/live-classrooms` | Admin | Virtual Classroom Settings: provider profile management (BigBlueButton & Dev), endpoint, signing key, defaults | PASS |

### API Endpoints Audited (24 Routes)
| Method | Endpoint | Purpose | Result |
|---|---|---|---|
| `GET` | `/api/addons/live-classrooms/sessions` | List sessions with pagination and filters | PASS |
| `POST` | `/api/addons/live-classrooms/sessions` | Schedule new virtual class session | PASS |
| `GET` | `/api/addons/live-classrooms/sessions/[id]` | Fetch session detail and metadata | PASS |
| `PATCH` | `/api/addons/live-classrooms/sessions/[id]` | Update session time, topic, or policy | PASS |
| `DELETE` | `/api/addons/live-classrooms/sessions/[id]` | Cancel / remove virtual session | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/start` | Start session with provider room initialization | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/end` | End session and close provider room | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/join` | Issue single-use HMAC-signed join grant | PASS |
| `POST` | `/api/addons/live-classrooms/join/redeem` | Redeem single-use join grant (anti-replay protected) | PASS |
| `GET` | `/api/addons/live-classrooms/sessions/[id]/attendance` | Retrieve participant attendance records | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/attendance/reconcile` | Reconcile presence status from telemetry events | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/attendance/post` | Post attendance to core register (`period=0`) | PASS |
| `GET` | `/api/addons/live-classrooms/sessions/[id]/recordings` | List recordings for session | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/recordings` | Register or update recording metadata | PASS |
| `DELETE` | `/api/addons/live-classrooms/sessions/[id]/recordings/[recordingId]` | Detach/delete recording metadata | PASS |
| `GET` | `/api/addons/live-classrooms/sessions/[id]/materials` | List attached digital course materials | PASS |
| `POST` | `/api/addons/live-classrooms/sessions/[id]/materials` | Attach published digital asset to session | PASS |
| `DELETE` | `/api/addons/live-classrooms/sessions/[id]/materials/[materialId]` | Detach course material from session | PASS |
| `GET` | `/api/addons/live-classrooms/providers` | List configured classroom providers | PASS |
| `POST` | `/api/addons/live-classrooms/providers` | Create classroom provider profile | PASS |
| `PATCH` | `/api/addons/live-classrooms/providers/[id]` | Update classroom provider profile credentials | PASS |
| `GET` | `/api/addons/live-classrooms/reports/overview` | Overall live classroom metrics & KPIs | PASS |
| `GET` | `/api/addons/live-classrooms/reports/sessions` | Detailed sessions analytics & CSV export data | PASS |
| `POST` | `/api/addons/live-classrooms/webhooks/[provider]` | Ingest provider webhook events (HMAC verified) | PASS |

### Explicitly Out of Scope
- Standalone LMS courses/lessons/quizzes tables (documented as deprecated/dead legacy schema in `AUD-LMS-01` discovery).
- Attachments Book / Academic Resources add-on (`digital_assets` authoring, handled independently).
- Core Academics Timetable Solver (`src/features/academics/ui/schedule-view.tsx`).
- Core Assessment Marksheet Grid (`src/features/assessment/`).

---

## 3. Workflow Understanding & Architecture

### Session Lifecycle State Machine
```
[scheduled] ---- start ----> [live] ---- end ----> [ended]
     |                         |
     +------ cancel ---------->+ (or failed / cancelled)
```

1. **Provider Profile & Tenant Setup**:
   - Live Classrooms is an add-on requiring `live-classrooms` in `tenant_addon_entitlements`.
   - Providers are managed per tenant via `live_class_provider_profiles` (supporting BigBlueButton and Deterministic Dev provider).
2. **Scheduling & Audience Binding**:
   - Admin or Teacher creates a session with `class_section_id`, `class_subject_id`, `title`, start/end timestamps, and policy (`recordSession`, `muteOnEntry`, `allowWebcam`, `guestAllowed`).
   - The system automatically populates `live_class_invitations` for all enrolled students in the target class section.
3. **Session Start & Provider Bridge**:
   - `POST /api/addons/live-classrooms/sessions/[id]/start` triggers provider room creation (e.g. BBB `create` API or Dev provider).
   - Session transitions from `scheduled` to `live`.
   - Double start attempts are idempotent and return the current live session.
4. **Secure Single-Use Join Grants (Anti-Replay Defense)**:
   - When a student or teacher clicks "Rejoindre", `POST /join` issues an HMAC-SHA256 signed join token with a short expiration (120 seconds).
   - The token contains: `tenantId`, `sessionId`, `userId`, `role`, `expiresAt`, `nonce`.
   - When redeemed via `POST /join/redeem`, the token is verified and marked as redeemed in memory/cache. Replaying the token immediately returns `401 JOIN_GRANT_REPLAYED`.
   - Forged tokens with invalid signatures are rejected with `401 INVALID_SIGNATURE`.
5. **Participant Telemetry & Events**:
   - Webhooks or provider events record immutable participant events in `live_class_participant_events` (`joined`, `left`, `reconnect`, `muted`, etc.).
6. **Attendance Reconciliation & Core Register Posting**:
   - `POST /attendance/reconcile` computes effective duration and attendance status (`present`, `late`, `absent`) against the session policy threshold (default: 50% duration = present).
   - `POST /attendance/post` inserts attendance records into the core `attendance` table using the special virtual live period `period = 0` and locks the register to ensure exactly-once consistency.
   - Subsequent calls are blocked with `409 NOTHING_TO_POST` or `409 REGISTER_LOCKED`.
7. **Recordings & Course Materials**:
   - Provider recordings are tracked in `live_class_recordings`.
   - Course materials link to published assets in `digital_assets` via `digital_asset_usage_links`.
8. **Analytics & CSV Export**:
   - Aggregated metrics include total sessions, total hours taught, and average presence rate.
   - Session reporting supports full CSV export with proper RFC 4180 escaping.

---

## 4. Findings & Dispositions

| ID | Severity | Area | Problem | Disposition |
|---|---|---|---|---|
| F-01 | Info | `AUD-LMS-01` Scope Resolution | Legacy LMS tables (`courses`, `lessons`, `quizzes`) are dead/unreferenced database artifacts. Real online learning surface is Live Classrooms (6 pages, 24 APIs) and Attachments Book (2 pages, 8 APIs). | Verified & Documented. Campaign correctly scoped to `AUD-LIVE-01`. |
| F-02 | Low | Webpack vs Turbopack on NTFS Junctions | Next.js 16 Turbopack rejected Windows worktree junctions to shared `node_modules`. | Resolved using `--webpack` flag for audit dev servers. |
| F-03 | Info | Better-Auth Origin Verification | `POST /api/auth/sign-in/email` checks request origin against `BETTER_AUTH_URL`. Local dev servers on alternate ports must pass origin header matching configured base URL. | Handled in audit runners with proper Origin headers. |

---

## 5. Security & Isolation Audit

- **Tenant Isolation**:
  - Every API route enforces `eq(table.tenantId, ctx.tenantId)`.
  - Static tenant isolation scan (`npm run check:isolation`) passed with 0 errors across all 24 Live Classrooms endpoints.
  - Cross-tenant test in runtime E2E test confirmed cross-tenant session lookup returns `404 Not Found`.
- **Role & Capability Gates**:
  - `live.read`: view sessions, recordings, materials.
  - `live.manage`: schedule, update, cancel sessions, configure providers.
  - `live.host`: start, end sessions, manage studio controls.
  - `live.join`: generate join tokens for invited students/participants.
  - `live.attendance.manage`: reconcile telemetry and post attendance to core registers.
  - `live.recordings.manage`: delete and publish recordings.
  - `live.reports.read` & `live.export`: view analytics and export CSV reports.
- **Anti-Replay & Token Tampering**:
  - Validated by runtime test steps 10 and 11:
    - Single-use join tokens rejected on replay (`401 JOIN_GRANT_REPLAYED`).
    - Forged signatures rejected (`401 INVALID_SIGNATURE`).
- **State Machine Invariants**:
  - Joining an ended session returns `409 SESSION_ENDED`.
  - Re-posting attendance returns `409 NOTHING_TO_POST`.
  - Virtual session attendance maps strictly to `period = 0` in core attendance registers.

---

## 6. Visual Evidence Inventory (13 Screenshots)

All screenshots captured with real authenticated sessions on `http://localhost:3114` using Chromium:

| Screenshot File | Target Route | Role & Context | Viewport | Locale | Visual Verification |
|---|---|---|---|---|---|
| `01-academics-live-class-desktop-fr.png` | `/dashboard/academics/live-class` | Admin (Yassine El Amrani) | 1440x900 | FR | Sessions table, status badges, provider column, filters |
| `02-academics-live-class-new-desktop-fr.png` | `/dashboard/academics/live-class/new` | Admin (Yassine El Amrani) | 1440x900 | FR | Scheduling form, class/subject dropdowns, provider selector |
| `03-academics-live-class-detail-desktop-fr.png` | `/dashboard/academics/live-class/[id]` | Admin (Yassine El Amrani) | 1440x900 | FR | Live Studio, live status, attendance actions, materials tab |
| `04-academics-live-class-reports-desktop-fr.png` | `/dashboard/academics/live-class-reports` | Admin (Yassine El Amrani) | 1440x900 | FR | KPI metrics cards, presence rate, hours taught, session log |
| `05-student-live-classes-desktop-fr.png` | `/dashboard/student/live-classes` | Student (Omar Tazi) | 1440x900 | FR | Student portal, scheduled & live sessions, join CTA |
| `06-parent-live-classes-desktop-fr.png` | `/dashboard/parent/live-classes` | Parent (Tariq Benjelloun) | 1440x900 | FR | Parent portal, student cards, attendance history |
| `07-settings-live-classrooms-desktop-fr.png` | `/dashboard/settings/live-classrooms` | Admin (Yassine El Amrani) | 1440x900 | FR | Provider profiles list, BBB/Dev configuration modal |
| `08-academics-live-class-mobile-390-fr.png` | `/dashboard/academics/live-class` | Admin (Yassine El Amrani) | 390x844 | FR | Mobile layout, collapsible cards, responsive tables |
| `09-academics-live-class-desktop-ar-rtl.png` | `/dashboard/academics/live-class` | Admin (Yassine El Amrani) | 1440x900 | AR RTL | Arabic RTL layout, directional symmetry, localized labels |
| `10-student-live-classes-desktop-ar-rtl.png` | `/dashboard/student/live-classes` | Student (Omar Tazi) | 1440x900 | AR RTL | Student portal Arabic RTL layout, localized session cards |
| `11-student-live-classes-mobile-390-fr.png` | `/dashboard/student/live-classes` | Student (Omar Tazi) | 390x844 | FR | Student portal Mobile 390 viewport, touch-friendly CTA |
| `12-parent-live-classes-desktop-ar-rtl.png` | `/dashboard/parent/live-classes` | Parent (Tariq Benjelloun) | 1440x900 | AR RTL | Parent portal Arabic RTL layout, student tabs |
| `13-academics-live-class-detail-desktop-ar-rtl.png` | `/dashboard/academics/live-class/[id]` | Admin (Yassine El Amrani) | 1440x900 | AR RTL | Studio Arabic RTL layout, participant roster, action buttons |

---

## 7. Automated Verification Summary

| Gate / Suite | Command | Result | Details |
|---|---|---|---|
| **TypeScript Compilation** | `npm run check:types` | **PASS** | 0 errors across entire workspace |
| **Tenant Isolation** | `npm run check:isolation` | **PASS** | 828 files scanned, all 24 Live Classrooms routes strictly scoped |
| **i18n Translation Completeness** | `npm run check:i18n` | **PASS** | 0 missing keys, 0 invalid translations |
| **i18n Missing Key Audit** | `npm run check:i18n:keys` | **PASS** | 0 missing keys in 0 files |
| **UI Reality Ratchet** | `npm run check:ui` | **PASS** | Dead controls 38/39, Mock screens 0/0, Unlinked pages 28/28 |
| **Vitest Test Suite** | `vitest run live-classrooms` | **PASS** | 10 test files passed, 252 tests passed |
| **Runtime E2E Lifecycle** | `tsx scripts/test-live-classrooms-runtime-e2e.ts` | **PASS** | 25/25 lifecycle steps passed with DB assertions |

---

## 8. Conclusion & Closeout Status

The Live Classrooms & Virtual Sessions add-on (`AUD-LIVE-01`) has been exhaustively audited, verified, and backed by end-to-end runtime proof and visual evidence.
All 7 routes and 24 API endpoints operate with strict tenant isolation, role-based capability enforcement, single-use anti-replay token defenses, and exact-once attendance integration into the core register (`period=0`).

**AUD-LIVE-01 COMPLETE**
- **Routes / Screens**: 7/7 audited
- **Visual Evidence**: 13/13 captured (FR desktop, AR RTL desktop, FR mobile 390)
- **Lifecycle & Security Test**: 25/25 steps verified
- **Vitest Suites**: 10 passed, 252 passed
- **Gates**: check:types PASS, check:isolation PASS, check:i18n PASS, check:ui PASS
- **READY FOR AGENT 5**: YES
