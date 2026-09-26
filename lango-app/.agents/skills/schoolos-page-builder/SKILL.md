---
name: schoolos-page-builder
description: End-to-end framework for building, structuring, and auditing production-grade dashboard and portal pages in SchoolOS/AtlasFleet. Enforces 100% real dynamic data (no mock fallbacks), multi-tenant isolation, CNDP Law 09-08 security, Next.js App Router architecture, modular components, and intuitive UX for non-technical school staff.
version: 1.0.0
category: architecture-and-design
tags: [schoolos, nextjs, app-router, fullstack, ui-ux, ponytail, karpathy, security, audit]
---

# SchoolOS & AtlasFleet Page Builder & Implementation Framework

> **Mission**: Build, refactor, and audit dashboard and portal pages that are **100% dynamic (real data), strictly secure, scalable, modular, and exceptionally intuitive for non-technical users** (school directors, secretaries, teachers, accountants, fleet managers).

---

## 🏛️ Guiding Philosophies

This skill synthesizes four foundational engineering disciplines:
1. **`/ponytail` (Lazy Senior Dev Discipline)**: Reach for the simplest code that actually works. Native HTML/CSS and platform features before third-party libraries. Zero speculative bloat, zero unrequested abstractions. Boring, robust code over clever hacks.
2. **`/karpathy-guidelines` (Surgical & Goal-Driven Execution)**: Think before coding. Touch only what you must. State tradeoffs and assumptions explicitly. Define verifiable success criteria (clean TypeScript compilation, automated unit/parity test suites) and loop until verified.
3. **`/nextjs-app-structure` (App Router 2026 Standards)**: Server-First rendering. Every route consists of a thin Server Component wrapper (`page.tsx`) handling route guards and metadata, delegating to a feature-scoped Client Island (`*-view.tsx`). Feature-first directory structure (`features/<domain>/{models,services,ui}`).
4. **`/atlasfleet-brand-adapter` (Moroccan Institutional Design System)**: Moroccan regulatory compliance (Law 09-08 CNDP, /20 grading, MAD currency, GSM-7 SMS), high-contrast accessible palettes (WCAG AA), and tactile micro-interactions designed for non-technical operators.

---

## 🧭 The 6 Non-Negotiable Pillars

Every page built or audited MUST satisfy all six criteria:

```
                  ┌────────────────────────────────────────────────────────┐
                  │            THE SCHOOLOS 6-PILLAR AUDIT                 │
                  └────────────────────────────────────────────────────────┘
                                              │
         ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
         ▼                  ▼                 ▼                 ▼                  ▼
  1. REAL DYNAMIC    2. MULTI-TENANT    3. APP ROUTER    4. MODULAR &       5. NON-TECH UX &
     DATA ONLY          SECURITY           STRUCTURE        REUSABLE           TACTILE DESIGN
  (No Mock Fallback) (Law 09-08 CNDP)   (Server+Client)  (Design Primitives) (Contextual Empties)
```

---

### Pillar 1: 100% Dynamic Real Data (Zero Mocks / Zero Fake Fallbacks)

- ❌ **STRICTLY BANNED**:
  - Initializing component state with hardcoded demo data arrays (`DEFAULT_DEMO_PERSONNEL`, `MOCK_ITEMS`, `DUMMY_STUDENTS`).
  - Showing simulated items when the database table has 0 records.
  - "Design Exploration" or prototype badges on production surfaces.
- ✅ **MANDATORY**:
  - Every table, list, card, and counter must fetch from real backend APIs connected to PostgreSQL / Drizzle ORM.
  - When the database has 0 rows, render an explicit, helpful **Contextual Empty State** explaining how to create the first record.
  - All counters and KPIs must reflect live SQL count/aggregate values, not static integers.

---

### Pillar 2: Security, Tenancy & Law 09-08 Compliance

- **Multi-Tenant Invariant**: Every query mutating or fetching tenant data MUST enforce `eq(table.tenantId, ctx.tenantId)`.
- **3-Tier Protection Pipeline**:
  ```
  Page Guard (requireServerPage) ──► API Route Guard (requireRequestContext) ──► Tenancy & Capability (requireTenant + requireCapability)
  ```
- **Sensitive PII Masking (Law 09-08 CNDP)**:
  - Personal identification numbers (CIN), social security (CNSS), health insurance (AMO), bank details (RIB), and salary numbers MUST be redacted on read unless the caller possesses the specific `*.sensitive.read` capability.
  - Audit trails must be automatically appended via `employee_employment_events` or `audit_logs`.
- **Destructive Safeguards**: Destructive actions (offboarding, deletion, archive, status revoking) require explicit confirmation dialogs with mandatory rationale fields.

---

### Pillar 3: Next.js App Router Architecture

- **Server-First Pattern**:
  - `src/app/[locale]/(dashboard)/dashboard/<domain>/page.tsx`:
    - Must be a Server Component (no `'use client'`).
    - Enforces authentication & capability via `await requireServerPage(locale, { requiredCapability: '...' })`.
    - Handles RTL/LTR direction based on locale (`locale === 'ar' ? 'rtl' : 'ltr'`).
    - Sets descriptive page metadata (`title`, `description`).
    - Renders the feature's dedicated Client Component from `features/<domain>/ui/`.
- **Root Page Redirects**:
  - Section root index pages (e.g. `/dashboard/hr/page.tsx`, `/dashboard/inventory/page.tsx`) must either cleanly redirect to the main overview sub-page (e.g. `redirect('/dashboard/hr/overview')`) or render the comprehensive dashboard.
- **Strict Parity**:
  - The `requiredCapability` in `page.tsx` must match the permission declared in `portal-manifest.ts` to satisfy automated nav-guard parity tests.

---

### Pillar 4: Modular & Reusable Component Architecture

- **Directory Layout**:
  ```
  src/
    app/[locale]/(dashboard)/dashboard/<module>/
      ├── page.tsx                       # Root redirect or landing
      ├── <sub-route>/
      │     └── page.tsx                 # Server wrapper
    features/<module>/
      ├── model/
      │     └── types.ts                 # Shared TypeScript interfaces & Zod schemas
      ├── models/
      │     └── <module>-schema.ts       # Drizzle ORM database schema
      ├── services/
      │     ├── <module>-service.ts      # Pure business logic & DB queries
      │     └── __tests__/               # Vitest unit & integration tests
      └── ui/
            ├── <sub-route>-view.tsx     # Client view implementation
            └── components/              # Modular sub-components
  ```
- **Design System Primitives**:
  - Exclusively use official UI primitives (`@/components/ui/card`, `badge`, `button`, `input`, `select`, `dialog`, `avatar`).
  - Zero arbitrary ad-hoc inline styles. Use Tailwind tokens with semantic classes.

---

### Pillar 5: Ergonomics & UX for Non-Technical Users

School staff are busy educators and administrators, not programmers. The UI must be foolproof:

1. **Dual Contextual Empty States**:
   - **Filtered Zero-State**: When a search or status filter yields no results:
     - Search icon (`Search`).
     - Title: *"Aucun résultat trouvé"*.
     - Action: Immediate *"Réinitialiser les filtres"* button.
   - **Database Zero-State**: When the database genuinely contains no records:
     - Domain icon (e.g. `Users`, `BookOpen`, `Package`).
     - Title: *"Aucun élément enregistré"*.
     - Description: Clear pedagogical explanation.
     - Action: Prominent primary button pointing to the creation form (e.g. *"Nouveau dossier"*).
2. **Search & Filter Usability**:
   - Search inputs MUST have an inline clear button (`X`) when text is typed.
   - Dynamic *"Réinitialiser"* link only appears when filters or search queries are active.
   - Dropdown selections must have plain language labels (e.g. *"Tous les statuts"* rather than technical enum values).
3. **Tactile Feedback & Visual Affordance**:
   - Interactive table rows: Hover highlight (`hover:bg-slate-50/80`), subtle row chevron (`ChevronRight`) appearing on hover to indicate clickability.
   - Buttons: Tactile press feedback (`active:scale-[0.98] transition-all`).
   - Loading states: Centered spinner (`Loader2`) with localized text (`tCommon('loading')`).
   - Table footers: Helpful hint explaining click action and displaying the total record count.

---

### Pillar 6: Brand & Visual Craft (AtlasFleet / SchoolOS Tokens)

- **Color Tokens**:
  - Primary Brand Teal/Blue: `#2487B8` (hover: `#1C6D96`).
  - Mint Accent (KPI surfaces): `#D1F5E8` with dark ink `#16212B`.
  - Background Canvas: `#F8FAFC` (slate-50) or pure white for elevated cards.
  - Border System: `border border-slate-200/80` with gentle `shadow-2xs`.
  - Border Radius: Consistent `rounded-2xl` on cards, `rounded-xl` on interactive inputs and buttons.
- **Typography & Accessibility**:
  - Headings: Bold, dark ink (`#16212B`), tracking tight.
  - Subtitles: Clean slate-500 (`text-sm text-slate-500`).
  - Numbers & Matricules: Font mono (`font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-md`).
  - Contrast: Strictly WCAG AA compliant (minimum 4.5:1 text contrast).

---

## 🛠️ Implementation Blueprint

When creating or refactoring a SchoolOS page, execute this exact template structure:

### 1. Server Page Wrapper (`src/app/[locale]/(dashboard)/dashboard/.../page.tsx`)

```tsx
import { requireServerPage } from '@/libs/api/page-guard';
import { ResourceView } from '@/features/resource/ui/resource-view';

export const metadata = {
  title: 'Titre de la Page — SchoolOS',
  description: 'Description claire de la fonction de la page.',
};

export default async function ResourcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'resource.manage' });
  const isRtl = locale === 'ar';

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ResourceView />
    </main>
  );
}
```

### 2. Client View (`src/features/.../ui/resource-view.tsx`)

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, X, RotateCcw, Loader2, ChevronRight, AlertCircle } from 'lucide-react';

export function ResourceView() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('Resource');
  const tCommon = useTranslations('Common');

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const isFiltered = search.trim().length > 0 || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/resource?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      const json = await res.json();
      if (json.success) setItems(json.data);
      else setError(json.error?.message ?? tCommon('loadError'));
    } catch {
      setError(tCommon('networkError'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, tCommon]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header with Title and Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => router.push(`/${locale}/dashboard/resource/new`)}
          className="cursor-pointer bg-[#2487B8] hover:bg-[#1C6D96] text-white shadow-xs active:scale-[0.98] transition-all rounded-xl font-medium"
        >
          <Plus className="me-2 h-4 w-4" /> {t('btnNew')}
        </Button>
      </div>

      {/* Main Container */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="ps-9 pe-8 rounded-xl border-slate-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-slate-500 gap-1.5 h-9 rounded-xl">
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{error}</p>}
        </div>

        {/* Content Table / Empty State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#2487B8]" />
            <span className="text-xs text-slate-400">{tCommon('loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
            <p className="font-semibold text-slate-700">{isFiltered ? t('noFilterMatch') : t('emptyState')}</p>
            {isFiltered ? (
              <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-xl text-xs">Réinitialiser les filtres</Button>
            ) : (
              <Button onClick={() => router.push(`/${locale}/dashboard/resource/new`)} className="rounded-xl text-xs bg-[#2487B8] text-white">
                <Plus className="me-1.5 h-3.5 w-3.5" /> {t('btnNew')}
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-start text-sm">
            {/* Table implementation */}
          </table>
        )}
      </Card>
    </div>
  );
}
```

---

## 🔍 The Audit & Verification Playbook

When auditing any page or subsystem:

1. **Verify Database Reality**:
   - Grep for `useState` initializations in the view. Reject any hardcoded mock record arrays.
   - Confirm the API route performs real `db.select()` / `db.insert()` queries with `eq(table.tenantId, tenantId)`.
2. **Verify Navigation & Page Guard Parity**:
   - Run `npx vitest run src/libs/api/__tests__/nav-page-guard-parity.test.ts`.
   - Ensure `page.tsx` required capability matches the portal manifest declaration.
3. **Verify Type Safety & Compilation**:
   - Run `npx tsc --noEmit`. Fix any typing regressions immediately.
4. **Verify Domain Test Suite**:
   - Run `npx vitest run src/features/<domain>`. All unit, security guard, and lifecycle tests must pass.
5. **Verify Non-Tech UX Flow**:
   - Test empty states with 0 database records.
   - Test search filter with clear `X` button and `RotateCcw` reset button.
   - Ensure all buttons give tactile feedback (`active:scale-[0.98]`).
