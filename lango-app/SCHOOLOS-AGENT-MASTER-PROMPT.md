# SchoolOS — Master Agent Context Prompt
# Version: 2026-08-03 | Owner: Oussama Zaki (Zakio)
# Give this ENTIRE file to any new agent before asking it to do any work.

---

## IDENTITY & MISSION

You are working on **SchoolOS** — a multi-tenant school-management SaaS built for Moroccan K-12 schools and language centers. The UI is trilingual: French (primary), Arabic (RTL), English.

Owner: **Oussama Zaki (Zakio)**. He is a software engineer and founder. Move fast, explain architecture clearly, don't hide complexity. Every line must be inspectable and understandable by him. Produce work he can continue manually.

**Working directory (absolute, never cd into it):**
```
c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\schoolos\schoolos-english-center-project-fully\schoolos-app
```

---

## MANDATORY FIRST READS (in order, before any code)

1. `CLAUDE.md` — project rules: multi-tenant isolation mandatory on every query, layered feature architecture, no static placeholders, never `cd`, run builds in background.
2. `AGENT-HANDOFF.md` — canonical current-state document. Read top section fully. Contains doc index listing which of the ~28 root `.md` files are live vs historical.
3. `ARCHITECTURE.md` — security/multi-tenancy model every route must follow. Open gap: account lockout. Two reusable patterns: lock+reopen, severity+assignment.
4. `MIGRATION-NOTES.md` — before touching any migration. Three incident writeups: (a) app and migrate are separate Docker images; (b) snapshot chain desync fix; (c) verify via real HTTP, not just tsc.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Framework | **Next.js 16 App Router** — Server Components by default |
| Database | **PostgreSQL 17** via **Drizzle ORM** |
| Auth | **Better Auth** multi-tenant sessions |
| Styling | **Tailwind CSS v4** CSS-first (`@import "tailwindcss"`) |
| UI Components | **shadcn/ui primitives** (`src/components/ui/`) |
| Icons | **Lucide React** — line icons, consistent stroke |
| Validation | **Zod** `.strict()` schemas on all mutations |
| Internationalization | `next-intl` — locale in URL (`/fr/`, `/ar/`, `/en/`) |
| Containerization | **Docker Compose** — `app` + `migrate` + `db` + `nginx` services |

---

## APP STRUCTURE

```
src/
  app/
    [locale]/
      (dashboard)/dashboard/          <- all dashboard pages
        settings/                     <- /settings, /settings/migration, etc.
        students/
        teachers/
        finance/
        attendance/
        ...
      (auth)/login/
      (auth)/signup/
    api/                              <- all API route handlers
      settings/route.ts               <- GET/POST settings
      settings/branches/route.ts
      students/route.ts
      finance/invoices/route.ts
      ...

  features/                           <- DOMAIN-FIRST architecture
    <domain>/
      ui/           <- React view components ('use client')
      model/        <- TypeScript types and interfaces
      data/         <- fetch functions (client-side hooks)
      server/       <- server actions (if any)
      validation/   <- Zod schemas (shared with API)

  components/
    ui/             <- shadcn primitives (accordion, badge, button, card, dialog, ...)
    shared/         <- app-shell components (sidebar, header, top-bar)
    accountant/     <- role-specific portals
    parent/
    teacher/
    receptionist/

  libs/
    api/
      context.ts    <- requireRequestContext, requireTenant, requireSuperAdmin
      permissions.ts <- requireCapability, PERMISSIONS registry
      audit.ts      <- recordAudit()
      errors.ts     <- apiErrorResponse()
      validation.ts <- parseJson, pagination schemas
      uploads.ts    <- tenant-namespaced file storage
      teacher-scope.ts <- getTeacherClassSectionIds
    auth.ts         <- Better Auth server config
    auth-client.ts  <- Better Auth browser client
    DB.ts           <- Drizzle db instance
    settings/registry.ts <- settings dual-write registry

  models/
    Schema.ts       <- ALL Drizzle schema tables (single file)
```

---

## API ROUTE CONVENTION (mandatory, every route)

```ts
// EVERY route handler must follow this exact pattern:
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, mySchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { myTable } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    await requireCapability(context, 'module.read');   // fine-grained permission
    const tenantId = requireTenant(context);

    // ALWAYS filter by tenantId — never query without it
    const rows = await db.select().from(myTable)
      .where(eq(myTable.tenantId, tenantId));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'module.manage');
    const tenantId = requireTenant(context);
    const body = await parseJson(request, mySchema);  // Zod .strict() validation

    const [saved] = await db.insert(myTable)
      .values({ tenantId, ...body })
      .returning();

    recordAudit(context, 'create', 'entity_type', saved!.id);  // mandatory on mutations

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
```

---

## FEATURE PAGE CONVENTION (UI)

```tsx
// src/features/<domain>/ui/<page>-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
// Only Lucide icons — no emoji
import { SomeIcon } from 'lucide-react';

// NEVER hardcode static arrays for final flows. Use fetch + state.
// Static mock arrays are ONLY acceptable for skeleton-placeholder demo builds explicitly marked as such.

export function MyFeatureView({ locale }: { locale: string }) {
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-endpoint')
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Page Title</h1>
          <p className="text-xs text-slate-500 mt-1">Subtitle description</p>
        </div>
        <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93]">
          <SomeIcon className="w-4 h-4" />
          Primary Action
        </Button>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ... */}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-[var(--shadow-sos-raised)]">
          {/* ... */}
        </Card>
      </div>
    </div>
  );
}
```

---

## DESIGN SYSTEM — SCHOOLOS BRAND

### Canvas & Surfaces
| Token | Value | Usage |
|---|---|---|
| `--color-sos-canvas` | `#EDF3F8` | Page background (Cerulean Mist) |
| `--color-sos-surface` | `#FFFFFF` | Cards, panels |
| `--color-sos-surface-sunken` | `#F6F9FC` | Table headers, search fields |
| `--color-sos-surface-inverse` | `#16212B` | Max 1 inverse card per dashboard |

### Brand Colors
| Token | Value | Usage |
|---|---|---|
| `--color-sos-primary` | `#2487B8` | All primary CTAs, active nav |
| `--color-sos-primary-hover` | `#3D9BC9` | Hover state |
| `--color-sos-primary-active` | `#1B6C93` | Active/pressed |
| `--color-sos-primary-soft` | `#DCEBF4` | Selected rows, active nav pill bg |
| `--color-sos-ink` | `#16212B` | Headings, primary text |
| `--color-sos-body` | `#5A6B7A` | Body text |
| `--color-sos-muted` | `#8FA0AE` | Labels, captions |
| `--color-sos-hairline` | `#E4EBF2` | Dividers, borders |
| `--color-sos-signal` | `#0EA5C4` | **Signal Cyan — ONLY for automated SMS/messaging, NEVER decorative** |

### Semantic Colors
| | Success | Warning | Danger | Info |
|---|---|---|---|---|
| Main | `#17A673` | `#E8A33D` | `#E5544B` | `#5B8DEF` |
| Soft bg | `#DDF5EC` | `#FCF0DC` | `#FCE4E2` | `#E4EDFD` |

### Shadows (two-layer soft elevation)
```css
--shadow-sos-raised:  0 1px 2px rgba(22,33,43,0.04), 0 2px 8px rgba(22,33,43,0.05);
--shadow-sos-hover:   0 4px 16px rgba(22,33,43,0.09);
--shadow-sos-overlay: 0 12px 32px rgba(22,33,43,0.14);
--shadow-sos-focus:   0 0 0 3px rgba(36,135,184,0.28);
```

### Typography
- **Latin (FR/EN)**: Albert Sans → Plus Jakarta Sans → system-ui
- **Arabic (RTL)**: Cairo → IBM Plex Sans Arabic
- **Display**: 24–28px, `font-extrabold`, `tracking-tight`, `letter-spacing: -0.03em`
- **Section headings**: 14–16px, `font-bold`
- **Body/Table**: 12–14px (`text-xs` to `text-sm`)
- **Labels/Captions**: 11–12px

### STRICT PROHIBITIONS
- ❌ NEVER use `#0066FF` — wrong blue. Always use `#2487B8`
- ❌ No gradients, glassmorphism, neon, or beveled effects
- ❌ No emoji icons — Lucide only
- ❌ No pure-white page canvas (`#FFFFFF` pages) — use `#EDF3F8`/`#F8FAFC`
- ❌ No left-border active navigation — use filled primary-soft pill
- ❌ No uniform card grids — use mixed bento sizes
- ❌ No bare person tables without avatars
- ❌ No decorative use of Signal Cyan (`#0EA5C4`)
- ❌ No WhatsApp branding or claims

---

## REUSABLE UI COMPONENTS (src/components/ui/)

All from shadcn/ui, DO NOT reinvent or create custom versions:

| Component | Import | Usage |
|---|---|---|
| `Card` | `@/components/ui/card` | All panel containers |
| `Badge` | `@/components/ui/badge` | Status pills |
| `Button` | `@/components/ui/button` | All actions |
| `Input` | `@/components/ui/input` | Text inputs |
| `Table` | `@/components/ui/table` | All data tables |
| `Avatar` | `@/components/ui/avatar` | Person rows |
| `Dialog` | `@/components/ui/dialog` | Modals |
| `Select` | `@/components/ui/select` | Dropdowns |
| `Switch` | `@/components/ui/switch` | Toggles |
| `Progress` | `@/components/ui/progress` | Progress bars |
| `Tabs` | `@/components/ui/tabs` | Tab navigation |
| `Skeleton` | `@/components/ui/skeleton` | Loading states |

### Table Usage Pattern
```tsx
<div className="overflow-x-auto rounded-xl border border-slate-200/80">
  <Table>
    <TableHeader className="bg-[#F6F9FC]">
      <TableRow>
        <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Column</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id} className="hover:bg-slate-50/60 transition-colors">
          <TableCell className="text-xs text-slate-700 p-3.5">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 text-[10px] bg-[#DCEBF4] text-[#1B6C93] font-bold">
                <AvatarFallback>{row.initials}</AvatarFallback>
              </Avatar>
              {row.name}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Badge Usage Pattern
```tsx
// Success
<Badge className="bg-[#DDF5EC] text-[#17A673] hover:bg-[#DDF5EC] border-none font-bold text-[11px]">Terminé</Badge>
// Warning
<Badge className="bg-[#FCF0DC] text-[#E8A33D] hover:bg-[#FCF0DC] border-none font-bold text-[11px]">En cours</Badge>
// Danger
<Badge className="bg-[#FCE4E2] text-[#E5544B] hover:bg-[#FCE4E2] border-none font-bold text-[11px]">Bloqué</Badge>
// Neutral
<Badge variant="neutral" className="text-slate-500 font-bold text-[11px]">À faire</Badge>
```

### Card Usage Pattern
```tsx
<Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-[var(--shadow-sos-raised)]">
  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-4">
    <h3 className="text-sm font-bold text-[#16212B]">Section Title</h3>
    <Button variant="ghost" size="sm" className="text-xs text-[#2487B8]">Action</Button>
  </div>
  {/* content */}
</Card>
```

---

## LAYOUT STRUCTURE

### Page Layout
```
App Shell:
  Sidebar (260px floating white, `data-sidebar-scroll` scroll behavior)
    └─ Logo, School name, Role badge
    └─ Nav items (active = filled primary-soft pill, NOT left border)
    └─ Sign out
  Main (flex-1)
    └─ TopBar (sticky, school name + search + date + notifications + user)
    └─ Content area (p-6, bg-[#EDF3F8] or #F8FAFC)
         └─ Page views rendered here (max-w-[1600px] mx-auto)
```

### Bento Grid Pattern (mixed sizes)
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Hero card - 2/3 width */}
  <Card className="lg:col-span-2 ..."> ... </Card>
  {/* Side panel - 1/3 width */}
  <div className="space-y-4"> ... </div>
</div>
```

---

## DOCKER WORKFLOW

### Local Build & Run
```powershell
# From project root (schoolos-app/)
docker compose build               # builds BOTH app and migrate images
docker compose build app           # build only app image
docker compose build migrate       # build only migrate image (separate!)
docker compose up -d               # start all services
docker compose up -d --force-recreate --no-deps app  # restart only app container

# Check logs
docker compose logs app --tail 30
docker compose logs migrate --tail 20

# Verify DB tables
docker compose exec db psql -U schoolos -d schoolos -c "\dt"

# Test HTTP response
curl http://localhost:3000/fr/dashboard/settings/migration
```

### Remote Deployment (Gloxoss server: 43.157.17.129)
```powershell
# 1. Package changed files
tar -czf my-fix.tar.gz "src/path/to/changed/file.tsx" "src/another/file.ts"

# 2. Upload to server
scp -i "C:\Users\oussama\.gemini\antigravity\scratch\mypc.pem" -o StrictHostKeyChecking=no my-fix.tar.gz ubuntu@43.157.17.129:/home/ubuntu/schoolos-english-center-project-fully/schoolos-app/

# 3. SSH, extract, rebuild app container
ssh -i "C:\Users\oussama\.gemini\antigravity\scratch\mypc.pem" -o StrictHostKeyChecking=no ubuntu@43.157.17.129 "cd /home/ubuntu/schoolos-english-center-project-fully/schoolos-app && tar -xzf my-fix.tar.gz && rm my-fix.tar.gz && docker compose up -d --build --force-recreate --no-deps app"
```

### CRITICAL Migration Rules
- `docker compose build app` does NOT rebuild `migrate` — they are SEPARATE images
- After any schema change: build BOTH `app` AND `migrate` explicitly
- Verify migrations via real DB check, not just tsc
- Never trust `npx tsc --noEmit` alone for migration verification

---

## TEST ACCOUNTS (password: Admin123! for all)
| Email | Role | Tenant |
|---|---|---|
| `y.elamrani@atlas.ma` | school_admin | Atlas |
| `admin@schoolos.ma` | school_admin | SchoolOS |
| `superadmin@schoolos.ma` | super_admin | cross-tenant |

---

## SCHOOLOS PAGE ARCHITECTURE RULES

### Every Feature Page
1. **Header**: Title (h1, `text-2xl font-extrabold text-[#16212B]`) + subtitle + 1-2 CTA buttons
2. **Stat tiles**: 2-5 KPI cards (`grid grid-cols-2 lg:grid-cols-4 gap-4`)
3. **Main workspace**: Bento grid (mixed sizes, never uniform)
4. **Tables**: Always with `bg-[#F6F9FC]` headers, avatars for person rows, pill badges for status
5. **Loading state**: `<Skeleton>` matching final layout, NO full-page spinners
6. **Empty state**: Explain why + permitted first action
7. **Error state**: Actionable message + retry

### Page Route → View Mapping
```
/dashboard/settings               → SettingsView (src/features/settings/ui/settings-view.tsx)
/dashboard/settings/migration     → MigrationReadinessCenterView (pf-01-migration-readiness-view.tsx)
/dashboard/settings/policies      → PoliciesView (policies-view.tsx)
/dashboard/settings/users         → UsersView (users-roles-view.tsx)
/dashboard/settings/security      → SecurityView (security-sessions-view.tsx)
/dashboard/settings/providers     → ProvidersView (providers-view.tsx)
/dashboard/settings/accounting-defaults → AccountingDefaultsView
/dashboard/settings/translations  → TranslationsView
/dashboard/settings/jobs          → JobsAuditView
/dashboard/settings/entitlements  → EntitlementsCatalogView
```

---

## CURRENT PAGE BUILD PIPELINE

### Reference Design Files
All page reference images and specs live at:
```
D:\game\SchoolOS_All_Pages_Organized\SchoolOS_All_Pages\
  01_01_platform_foundations\        <- Batch 1: Settings/PF pages
    01_pf_01_migration_readiness_center\
      image.png                      <- Reference UI screenshot
      prompt.json                    <- Page spec (required components, data rules)
      README.md
    02_pf_02_settings_workspace\
    ...
  02_02_entitlements_admissions_students\  <- Batch 2
  ...
done\                               <- Completed pages (copied here for verification)
```

### Build Process for Each Page
1. Read `image.png` (reference design screenshot)
2. Read `prompt.json` (page spec: required components, data rules, interaction rules)
3. Read current built view file (`src/features/<domain>/ui/<name>-view.tsx`)
4. Run audit: identify missing sections, wrong components, design violations
5. Rebuild view matching reference exactly using native `@/components/ui/*` primitives
6. Add API route wiring (`fetch` in `useEffect` or server action)
7. Add security/capability guards to API route
8. Run `npx tsc --noEmit` → verify 0 errors
9. Run `docker compose build app` → verify build success
10. Test HTTP response on `/fr/dashboard/...`

---

## PERMISSIONS REGISTRY (src/libs/api/permissions.ts)

```ts
PERMISSIONS = {
  'settings.read': 'Voir les paramètres',
  'settings.organization.manage': 'Modifier les paramètres d\'organisation',
  'settings.security.manage': 'Modifier les paramètres de sécurité',
  'students.read': 'Voir les élèves',
  'students.create': 'Créer des élèves',
  'students.import': 'Importer des élèves',
  'teachers.read': 'Voir les enseignants',
  'academics.read': 'Voir la structure académique',
  'academics.manage': 'Gérer la structure académique',
  'attendance.read': 'Voir les présences',
  'attendance.manage': 'Gérer les présences',
  'finance.read': 'Voir les finances',
  'finance.manage': 'Gérer les finances',
  'finance.approve': 'Approuver les opérations financières',
  'users.read': 'Voir les utilisateurs',
  'users.manage': 'Gérer les utilisateurs',
  'audit.read': 'Consulter les journaux d\'audit',
  // ... more in permissions.ts
}
```

---

## OPEN SECURITY GAPS (do not close without owner approval)

1. **Account lockout half-built**: `failedLoginCount`/`lockedUntil` columns exist, `POST /api/users/unlock` exists — but NOTHING increments counter on failed login. Fix: wire Better Auth `databaseHooks` callback on failed credential sign-in.
2. **Static/mock views**: Several pages still have hardcoded data arrays instead of real API calls — document in AGENT-HANDOFF.md if you find new ones.

---

## AGENT DISCIPLINE RULES

- **Never `cd`** into directories. Always use absolute paths in all commands.
- **Never run both `app` and `migrate` build with a single `docker compose build`** — verify the output confirms both images built.
- **Never trust `tsc --noEmit` alone** — always also do `docker compose build app` and real HTTP test.
- **Never invent business rules** not stated in docs — stop and ask.
- **Never put database logic in page components** — pages compose domain feature components only.
- **Never create custom UI components** when a native `@/components/ui/*` primitive exists — reuse.
- **Never use static mock arrays** in feature views for final flows — use fetch + state.
- **Always `recordAudit()`** on every mutation (create/update/delete).
- **Always filter by `tenantId`** in every Drizzle query on tenant-owned tables.
- **Always run `npx tsc --noEmit`** and verify exit code 0 before marking any task done.
- **Always update `AGENT-HANDOFF.md`** and `CHANGELOG.md` after completing meaningful work.

---

## SCHOOLOS/SCHOOLOS PRODUCT CONTEXT

SchoolOS is a Moroccan school management SaaS for K-12 schools and language centers. Core modules:

- **Platform / Settings**: School identity, CNDP compliance, branches, academic policies, user roles, security, providers, accounting defaults
- **Students**: Admissions pipeline, student profiles, guardians/households, class promotions, transfers, bulk import
- **Academics**: Class structure, subjects, timetable, teacher assignment
- **Attendance**: Daily register, excuse management, flag detection, audit
- **Finance**: Invoices, payments, fees structures, credit notes, accounting ledger
- **Communication**: SMS reminders, announcements, messaging (simulation only — no real carrier)
- **HR**: Staff profiles, leave management, payroll
- **Reports & Analytics**: Dashboard KPIs, annual summaries, exam results

Data is always:
- Moroccan realistic: names (+212 phones, MAD currency, French labels)
- Tenant-scoped (multi-school platform)
- Trilingual (French primary, Arabic RTL mirrored, English)
- Tabular numerals for financial/count data

---

## HOW TO PROCEED WHEN RECEIVING A TASK

1. Read all 4 mandatory docs above first (CLAUDE.md, AGENT-HANDOFF.md, ARCHITECTURE.md, MIGRATION-NOTES.md).
2. Read the reference page spec (prompt.json + image.png from the done/ folder).
3. Read the current built view file.
4. Identify gaps using the audit JSON format (sections missing, design violations, wrong data, API wiring needed).
5. Implement changes surgically — match existing patterns, don't reinvent.
6. Verify: tsc → docker build → HTTP test.
7. Update AGENT-HANDOFF.md + CHANGELOG.md.
