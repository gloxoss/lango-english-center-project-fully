# 🧠 LANGO ENGLISH CENTER — FULL AGENT HANDOFF DOCUMENT

> **Purpose:** Give this entire file to any AI coding agent so they can continue working on the Lango project with zero context loss. This is the single source of truth.

> **Last Updated:** 2026-06-15T12:00:00+02:00 by Agent "Antigravity" (Conversation `0f024e2c-676d-465a-b9ac-936146710f01`)

---

## 1. PROJECT IDENTITY

| Field | Value |
|-------|-------|
| **Project Name** | Lango English Center SaaS Platform |
| **Owner** | Oussama Zaki (Zakio) — Founder @ EPIOSO / Gloxoss |
| **Type** | Multi-tenant School Management System (SMS) + LMS + CRM + ERP |
| **Target** | Private English language centers in Morocco (initial), resellable SaaS (future) |
| **Workspace Root** | `D:\Users\zakio\Desktop\Lango english center project fully\` |
| **App Directory** | `D:\Users\zakio\Desktop\Lango english center project fully\lango-app\` |
| **Pre-Dev Docs** | `D:\Users\zakio\Desktop\Lango english center project fully\pre-dev\` |
| **Progress Tracker** | `pre-dev/PROGRESS.md` |
| **SMS Build Plan** | `lango-app/sms-build-plan.md` |

---

## 2. ARCHITECTURE & TECH STACK

### Core Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 16.2.6 (App Router, Turbopack) | React 19, Server Components by default |
| **Language** | TypeScript 5.9 | Strict mode |
| **ORM** | Drizzle ORM 0.45 | `drizzle-kit` for migrations |
| **Database** | PostgreSQL (PGLite for local dev) | `@electric-sql/pglite` + `pglite-socket` |
| **Auth** | Better Auth 1.6 | Replaces Clerk from boilerplate |
| **Styling** | Tailwind CSS 4.3 + Shadcn/UI | `tw-animate-css` for animations |
| **i18n** | `next-intl` 4.12 | EN, FR, AR (RTL support) |
| **Validation** | Zod 4.4 | Used in Env, forms, server actions |
| **Env Validation** | `@t3-oss/env-nextjs` | See `src/libs/Env.ts` |
| **Testing** | Vitest 4.1 + Playwright | Unit + E2E |
| **Icons** | `lucide-react`, `react-icons`, `@tabler/icons-react` | |

### Architecture Pattern
- **Frankenstein Pivot**: Scaffolded from `ixartz/SaaS-Boilerplate`, then grafted Frappe Education schemas + DevKrishnasai LMS components.
- **Dynamic-First**: All data from Server Components → Drizzle queries → Dumb UI props. Zero hardcoded data in JSX.
- **Multi-Tenant**: Every DB table has `tenantId`. Every query MUST filter by it.
- **Server Components by Default**: Client components ONLY for interactive islands (forms, toggles, modals).

### Key Files Map
```
lango-app/
├── src/
│   ├── app/[locale]/(protected)/
│   │   └── lms/courses/
│   │       ├── page.tsx              ← Courses index (redirects to first course)
│   │       └── [courseId]/page.tsx    ← Course viewer (Server Component)
│   ├── components/lms/
│   │   ├── LeftPart.tsx              ← Sidebar with chapter list + progress bar
│   │   ├── RightPart.tsx             ← Main content area (video + chapter preview)
│   │   ├── MobileLeftPart.tsx        ← Sheet-based mobile sidebar
│   │   ├── ChapterButton.tsx         ← Individual chapter link in sidebar
│   │   ├── PreviewForChapter.tsx     ← Chapter content renderer
│   │   ├── VideoPlayer.tsx           ← Native HTML5 video player
│   │   ├── Preview.tsx               ← HTML content renderer (dangerouslySetInnerHTML)
│   │   ├── actions.ts                ← Server Actions (getCourse, getFullChapter, etc.)
│   │   └── actions.test.ts           ← TDD tests (3/3 passing via Vitest)
│   ├── models/
│   │   └── Schema.ts                 ← ALL Drizzle table definitions + relations
│   ├── libs/
│   │   ├── DB.ts                     ← Cached Drizzle connection (global singleton)
│   │   ├── Env.ts                    ← T3 Env validation (DATABASE_URL, BETTER_AUTH_SECRET)
│   │   └── auth-client.ts            ← Better Auth client
│   └── utils/
│       ├── DBConnection.ts           ← Pool creation (node-postgres → Drizzle)
│       └── Helpers.ts                ← cn() utility
├── .env                              ← DATABASE_URL, BETTER_AUTH_SECRET
├── .env.local                        ← Overrides (if exists)
├── vitest.config.ts                  ← Unit + UI test projects
├── sms-build-plan.md                 ← Step 8 full plan
└── package.json
```

---

## 3. DATABASE SCHEMA (Current State)

All tables are defined in `src/models/Schema.ts`:

### Auth & Multi-Tenancy
| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant isolation (id, name, slug, logoUrl, isActive) |
| `user` | Users with roles (7 roles: super_admin, school_admin, teacher, student, parent, receptionist, guard) |
| `session` | Better Auth sessions |
| `account` | OAuth accounts |
| `verification` | Email/token verification |

### Frappe Education Domain (SMS/ERP)
| Table | Purpose |
|-------|---------|
| `academic_years` | School year periods (e.g., "2026-2027") |
| `programs` | Educational programs (e.g., "General English Program") |
| `courses` | Courses within programs + LMS fields (price, isPublished, isFree) |
| `student_groups` | Class batches (linked to course + academic year) |
| `enrollments` | Student enrollment tracking (enrolled/dropped/graduated) |

### LMS Domain
| Table | Purpose |
|-------|---------|
| `chapters` | Course chapters (title, content, position, videoUrl, isFree) |
| `course_attachments` | Files attached to courses |
| `user_progress` | Per-user chapter completion tracking |

### Drizzle Relations (defined at bottom of Schema.ts)
- `coursesRelations`: courses → many chapters, many attachments
- `chaptersRelations`: chapters → one course
- `courseAttachmentsRelations`: attachments → one course

### Seeded Test Data
- **Tenant**: "Lango English Center" (slug: `lango-english-center`)
- **User**: `admin@lango.ma` (school_admin), `test-user-123` (student, for TDD)
- **Academic Year**: 2026-2027
- **Program**: "General English Program"
- **Course**: "TDD Next.js Masterclass" (code: NEXT-101, published, $99.99)
- **Chapter**: "Introduction to Vitest" (position 1, free, with video URL)
- **User Progress**: test-user-123 completed the chapter

---

## 4. ENVIRONMENT SETUP

### Required Environment Variables (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
BETTER_AUTH_SECRET=my-secret-key-1234567890
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_LOGGING_LEVEL=debug
```

### Starting the Dev Environment
```bash
# 1. Start the PGLite database server (MUST run first)
npx pglite-server -m 100 --db=local.db

# 2. Run database migrations
npm run db:migrate

# 3. Start Next.js dev server
npm run dev

# App runs at http://localhost:3000
# LMS route: http://localhost:3000/en/lms/courses
```

> **CRITICAL**: The DB server (`pglite-server`) MUST be running on port 5432 BEFORE starting Next.js. Without it, all DB queries will throw `ECONNREFUSED 127.0.0.1:5432`.

### Running Tests
```bash
npm run test                                    # All tests
npm run test -- src/components/lms/actions.test.ts  # LMS TDD suite only
```

---

## 5. PROGRESS — WHAT IS DONE (Steps 1-6)

### Step 1: Purge & Clone ✅
- Scaffolded from `ixartz/SaaS-Boilerplate` into `lango-app/`
- Removed Clerk auth stubs, replaced with Better Auth

### Step 2: Infrastructure Wiring ✅
- Drizzle connected to local PostgreSQL via Docker (`lango_postgres`)
- Later migrated to PGLite for zero-Docker local dev

### Step 3: Multi-Tenancy & Auth ✅
- Better Auth configured with 7 Lango roles
- `admin@lango.ma` seeded, AdminShell working

### Step 4: i18n & RTL ✅
- Arabic (`ar`) locale added to `AppConfig.ts`
- `ar.json` translation file created
- Dynamic `dir="rtl"` on `<html>` tag
- `OmitRTL` utility component created
- Middleware updated: `/api/` excluded from i18n routing

### Step 5: Frappe Database Port ✅
- Ported Frappe Education schemas: `academic_years`, `programs`, `courses`, `student_groups`, `enrollments`
- Drizzle migrations applied (10 tables verified)
- `seed-frappe.ts` executed with test data

### Step 6: LMS UI Transplant ✅
- Cloned `DevKrishnasai/lms` and extracted React components
- Refactored ALL components to remove Clerk auth + Prisma dependencies
- Replaced `video-react` with native HTML5 `<video>` (React 19 compat)
- Replaced `react-quill` with `dangerouslySetInnerHTML` (React 19 compat)
- Added Drizzle relations for `courses ↔ chapters ↔ attachments`
- Created server actions: `getCourse`, `getFullChapter`, `getProgressWithIds`, `getChapterProgress`
- TDD suite: **3/3 tests passing** via Vitest

---

## 6. CURRENT BLOCKERS & KNOWN ISSUES

### 🔴 Blocker: LMS Page Not Rendering in Browser
**Symptom**: Navigating to `/en/lms/courses` throws `ECONNREFUSED 127.0.0.1:5432`
**Root Cause**: The PGLite database server was not running when Next.js started. The `npm run db-server:file` script's `--run` flag is broken on Node 24 (`ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`).
**Fix Required**:
1. Start PGLite manually: `npx pglite-server -m 100 --db=local.db`
2. Run migrations separately: `npm run db:migrate`
3. Then start Next.js: `npm run dev`
4. Alternatively, fix the `db-server:file` script in `package.json`

### 🟡 Issue: Mock Auth in LMS Actions
- `actions.ts` → `getUserId()` returns hardcoded `"test-user-123"`
- Must be replaced with real Better Auth `getSession()` before production
- The `[courseId]/page.tsx` also uses `"demo-user-id"` — must be unified

### 🟡 Issue: Shadcn UI Components May Be Missing
- `@/components/ui/progress` — needed by LeftPart.tsx
- `@/components/ui/sheet` — needed by MobileLeftPart.tsx
- `@/components/ui/button` — needed by RightPart.tsx
- Run `npx shadcn@latest add sheet progress skeleton button` if they don't exist

### 🟡 Issue: .env encoding
- The `BETTER_AUTH_SECRET` was previously appended with UTF-16 null bytes via `echo >>`. This was fixed by stripping null chars, but verify `.env` is clean UTF-8.

---

## 7. WHAT IS NEXT — THE PLAN

### Step 7: Apple-Level Polish (CURRENT STEP)
- [ ] **7.1** Install `marvkr/better-design` Shadcn tokens
- [ ] **7.2** Inject Aceternity UI micro-animations on login + dashboard
- [ ] **7.3** Final UX audit against "Nivel Apple" standard

### Step 8: SMS Application Layer (see `sms-build-plan.md` for full detail)

#### 8A: ERP Core — Student & Academic CRUDs
- Extend schema (student profile fields, attendance table, indexes)
- Server Actions: `students.ts`, `programs.ts`, `courses.ts`, `student-groups.ts`, `enrollments.ts`
- Data Tables UI: Student Directory, Student 360 Profile, Programs/Courses/Groups pages
- **Gate**: Student Directory lists real DB data with working CRUD → wait for "gloxoss-go"

#### 8B: Attendance Module
- Server Actions: `markAttendance`, `getAttendance`, `getStudentAttendanceHistory`
- UI: Fast-toggle grid, attendance summary stats, calendar heatmap
- **Gate**: Teacher can mark attendance for entire class in one screen

#### 8C: Finance & Billing
- Schema: `fee_structures`, `invoices`, `payments`, `expenses`
- Server Actions: CRUD for each + bulk invoice generation
- UI: Fee templates, invoice table with status badges, payment recording, expense tracker
- **Gate**: Admin can generate invoices and record payments

#### 8D: Timetable & Class Scheduling
- Schema: `timetable_slots`
- UI: Weekly calendar grid, conflict detection
- **Gate**: Timetable renders weekly grid with real slot data

### Future Phases (Post Step 8)
- Phase 4: CRM & Leads (Kanban, Lead Profiles)
- Phase 5: WhatsApp Automation (Shared Inbox, Chatbot Builder)
- Phase 6: AI Enhancements (Placement Tests, Analytics)
- Phase 7: Multi-Portal (Student, Parent, Teacher, Guard portals)
- Phase 8: Production Deploy (Docker build, VPS, CI/CD)

---

## 8. SKILLS TO USE

These are AI skill files located at `C:\Users\oussama\.claude\skills\`. Read the `SKILL.md` in each before applying.

### Core Skills (Use on ALL tasks)
| Skill | Path | When |
|-------|------|------|
| `karpathy-guidelines` | `C:\Users\oussama\.claude\skills\karpathy-guidelines\SKILL.md` | Every coding task — prevents over-engineering |
| `lango-oss-pivot` | `C:\Users\oussama\.claude\skills\lango-oss-pivot\SKILL.md` | Enforces the Frankenstein Pivot pipeline gates |
| `lango-sms-context` | `C:\Users\oussama\.claude\skills\lango-sms-context\SKILL.md` | Full SMS/LMS/CRM context for Lango |
| `epioso-dynamic-first` | `C:\Users\oussama\.claude\skills\epioso-dynamic-first\SKILL.md` | CMS-ready, dynamic-first architecture |

### Architecture & Planning Skills
| Skill | Path | When |
|-------|------|------|
| `plan-writing` | `C:\Users\oussama\.claude\skills\plan-writing\SKILL.md` | Multi-step task planning |
| `concise-planning` | `C:\Users\oussama\.claude\skills\concise-planning\SKILL.md` | Quick atomic checklists |
| `nonstop` | `C:\Users\oussama\.claude\skills\nonstop\SKILL.md` | Autonomous work mode |
| `software-architecture` | `C:\Users\oussama\.claude\skills\software-architecture\SKILL.md` | Quality-focused architecture |

### Frontend & Design Skills
| Skill | Path | When |
|-------|------|------|
| `design-orchestrator` | `C:\Users\oussama\.claude\skills\design-orchestrator\SKILL.md` | UI/UX aesthetics routing |
| `premium` | `C:\Users\oussama\.claude\skills\premium\SKILL.md` | Apple-inspired aesthetics |
| `sleek` | `C:\Users\oussama\.claude\skills\sleek\SKILL.md` | Modern minimalist UI |
| `next-best-practices` | `C:\Users\oussama\.claude\skills\next-best-practices\SKILL.md` | Next.js App Router patterns |
| `react-best-practices` | `C:\Users\oussama\.claude\skills\react-best-practices\SKILL.md` | React performance |
| `react-ui-patterns` | `C:\Users\oussama\.claude\skills\react-ui-patterns\SKILL.md` | Loading states, error handling |
| `nextjs-shadcn` | `C:\Users\oussama\.claude\skills\nextjs-shadcn\SKILL.md` | Shadcn component patterns |

### Backend & Database Skills
| Skill | Path | When |
|-------|------|------|
| `database-design` | `C:\Users\oussama\.claude\skills\database-design\SKILL.md` | Schema design, indexing |
| `supabase-postgres-best-practices` | `C:\Users\oussama\.claude\skills\supabase-postgres-best-practices\SKILL.md` | Postgres optimization |
| `better-auth-best-practices` | `C:\Users\oussama\.claude\skills\better-auth-best-practices\SKILL.md` | Auth configuration |

### Security & Quality Skills
| Skill | Path | When |
|-------|------|------|
| `privacy-by-design` | `C:\Users\oussama\.claude\skills\privacy-by-design\SKILL.md` | Data handling |
| `webapp-testing` | `C:\Users\oussama\.claude\skills\webapp-testing\SKILL.md` | Browser testing with Playwright |

---

## 9. GOVERNING PRINCIPLES

1. **Simplicity First** (Karpathy): Each CRUD = 1 Server Action file + 1 Data Table component + 1 Form component. No speculative abstractions.
2. **Surgical Changes**: Each sprint touches ONLY its own module folder. No "improving" unrelated pages.
3. **Goal-Driven**: Every task has a `Verify:` check. If it doesn't pass, loop until it does.
4. **Dynamic-First**: No hardcoded data in JSX. All data flows from Server Components → Drizzle queries → Dumb UI components via props.
5. **Tenant Isolation**: Every query MUST filter by `tenantId`. No exceptions.
6. **Server Components by Default**: Client components only for interactive islands.
7. **Gloxoss-Go Gate**: Each sprint is gated. Stop at end, present results, wait for "gloxoss-go" before proceeding.

---

## 10. PRE-DEV DOCUMENTATION INDEX

All planning documents are in `pre-dev/`:

| File | Content |
|------|---------|
| `00-project-charter.md` | Project vision, scope, stakeholders |
| `01-market-opportunity.md` | Market analysis for Morocco EdTech |
| `01-competitive-analysis.md` | Competitor landscape |
| `01-user-personas.md` | User archetypes (Admin, Teacher, Student, Parent, Guard) |
| `01-business-case.md` | Financial justification |
| `02-PRD.md` | Product Requirements Document |
| `02-SRS.md` | Software Requirements Specification |
| `02-user-stories.md` | User stories by persona |
| `03-architecture-overview.md` | System architecture |
| `03-tech-stack-decisions.md` | Tech stack ADRs |
| `03-C4-diagrams.md` | C4 architecture diagrams |
| `03-ADRs/` | Architecture Decision Records |
| `04-information-architecture.md` | IA and navigation structure |
| `04-user-journey-maps.md` | User flow diagrams |
| `04-screen-inventory.md` | Complete screen list |
| `05-data-and-api-design.md` | Data model + API design |
| `10-api-design-specification.md` | REST API spec |
| `11-openapi-spec.yaml` | OpenAPI 3.1 specification |
| `12-api-developer-guide.md` | Developer guide |
| `06-security-and-performance.md` | Security requirements |
| `07-project-blueprint.md` | Execution blueprint |
| `BLUEPRINT.md` | Master execution plan |
| `PROGRESS.md` | Live progress tracker |

---

## 11. SHARED TASK LOG — INTER-AGENT COORDINATION

> **HOW TO USE**: When an agent completes a task, add an entry below. When starting work, read the latest entries to know what changed. This prevents two agents from stepping on each other.

### Log Format
```
[TIMESTAMP] [AGENT_NAME] [STATUS] — Description
  Files changed: list
  Verify: how to confirm
```

### Entries

```
[2026-06-14T20:00] [Antigravity] [DONE] — Fixed getFullChapter() crash in actions.ts
  - Removed invalid `with: { attachments: true }` Drizzle query (relation did not exist on chapters)
  - Now fetches attachments separately via courseAttachments table
  Files: src/components/lms/actions.ts
  Verify: npm run test -- src/components/lms/actions.test.ts → 3/3 pass

[2026-06-14T20:05] [Antigravity] [DONE] — Replaced missing Skeleton/Loading with inline Tailwind
  - RightPart.tsx: Removed @/components/Loading, @/components/ui/skeleton imports
  - LeftPart.tsx: Removed @/components/ui/skeleton import
  - Both now use inline animate-pulse divs as skeleton placeholders
  - Replaced react-icons GiSpinningBlades with lucide-react Loader2
  Files: src/components/lms/RightPart.tsx, src/components/lms/LeftPart.tsx
  Verify: Next.js compiles without module-not-found errors

[2026-06-14T20:05] [Antigravity] [DONE] — Created LMS courses index redirect page
  Files: src/app/[locale]/(protected)/lms/courses/page.tsx
  Verify: Navigating to /en/lms/courses redirects to /en/lms/courses/{firstCourseId}

[2026-06-14T20:05] [Antigravity] [DONE] — Installed missing npm packages
  - react-icons, @radix-ui/react-dialog
  Files: package.json, package-lock.json
  Verify: npm ls react-icons @radix-ui/react-dialog

[2026-06-14T20:22] [Antigravity] [DONE] — Fixed .env BETTER_AUTH_SECRET encoding
  - Was appended with UTF-16 null bytes via PowerShell echo
  - Stripped null characters, now clean UTF-8
  Files: .env
  Verify: grep BETTER_AUTH_SECRET .env shows no garbled characters

[2026-06-14T20:30] [Antigravity] [BLOCKED] — LMS page still throws ECONNREFUSED
  - PGLite server must be started manually BEFORE Next.js
  - The db-server:file script is broken on Node 24 (--run flag incompatible)
  - Workaround: npx pglite-server -m 100 --db=local.db  (separate terminal)
  Files: (none changed, infrastructure issue)
  Verify: Start PGLite then npm run dev then visit /en/lms/courses
```

### NEXT TASK FOR INCOMING AGENT:
1. **FIX DB STARTUP**: Start PGLite (`npx pglite-server -m 100 --db=local.db`), run migrations (`npm run db:migrate`), restart Next.js (`npm run dev`)
2. **VERIFY LMS RENDERS**: Navigate to `http://localhost:3000/en/lms/courses`, confirm it redirects and shows course viewer with sidebar
3. **INSTALL SHADCN COMPONENTS**: `npx shadcn@latest add sheet progress skeleton button` (if any are missing)
4. **BEGIN STEP 7**: Apple-Level Polish (install better-design tokens, add micro-animations)
5. **OR BEGIN STEP 8A**: If Zakio says skip polish, start ERP Core CRUDs per `sms-build-plan.md`

---

## 12. QUICK REFERENCE COMMANDS

```bash
# Database
npx pglite-server -m 100 --db=local.db    # Start DB server
npm run db:generate                         # Generate migration SQL
npm run db:migrate                          # Apply migrations
npm run db:studio                           # Open Drizzle Studio GUI

# Development
npm run dev                                 # Start Next.js (port 3000)
npm run build                               # Production build
npm run lint                                # ESLint check
npm run check:types                         # TypeScript check

# Testing
npm run test                                # Run all Vitest tests
npm run test -- src/components/lms/actions.test.ts  # LMS tests only
npm run test:e2e                            # Playwright E2E tests

# Shadcn UI
npx shadcn@latest add [component]           # Add UI components
```

---

*End of Handoff Document. Any agent reading this has everything needed to continue.*
