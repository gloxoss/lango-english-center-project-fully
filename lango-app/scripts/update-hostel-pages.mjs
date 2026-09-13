import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.resolve(__dirname, '../src/app/[locale]/(dashboard)/dashboard/hostel');

const pages = [
  {
    path: 'page.tsx',
    content: `import { TonightView } from '@/features/hostel/ui/tonight-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <TonightView />
    </main>
  );
}
`
  },
  {
    path: 'allocations/page.tsx',
    content: `import { AllocationWorkspaceView } from '@/features/hostel/ui/allocation-workspace-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelAllocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.allocation.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AllocationWorkspaceView />
    </main>
  );
}
`
  },
  {
    path: 'allocations/[id]/page.tsx',
    content: `import { AllocationDetailView } from '@/features/hostel/ui/allocation-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AllocationDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.allocation.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AllocationDetailView allocationId={id} />
    </main>
  );
}
`
  },
  {
    path: 'applications/page.tsx',
    content: `import { AllocationWorkspaceView } from '@/features/hostel/ui/allocation-workspace-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.allocation.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AllocationWorkspaceView />
    </main>
  );
}
`
  },
  {
    path: 'board/page.tsx',
    content: `import { BedBoardView } from '@/features/hostel/ui/bed-board-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function BedBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <BedBoardView />
    </main>
  );
}
`
  },
  {
    path: 'categories/page.tsx',
    content: `import { CategoriesView } from '@/features/hostel/ui/categories-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <CategoriesView />
    </main>
  );
}
`
  },
  {
    path: 'guardian/page.tsx',
    content: `import { GuardianMeView } from '@/features/hostel/ui/guardian-me-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function GuardianMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardianMeView />
    </main>
  );
}
`
  },
  {
    path: 'hostels/page.tsx',
    content: `import { HostelsView } from '@/features/hostel/ui/hostels-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <HostelsView />
    </main>
  );
}
`
  },
  {
    path: 'hostels/[id]/page.tsx',
    content: `import { HostelDetailView } from '@/features/hostel/ui/hostel-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <HostelDetailView hostelId={id} />
    </main>
  );
}
`
  },
  {
    path: 'leave-passes/page.tsx',
    content: `import { LeavePassesView } from '@/features/hostel/ui/leave-passes-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LeavePassesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.supervision.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LeavePassesView />
    </main>
  );
}
`
  },
  {
    path: 'me/page.tsx',
    content: `import { ResidentMeView } from '@/features/hostel/ui/resident-me-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ResidentMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['student'] });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ResidentMeView />
    </main>
  );
}
`
  },
  {
    path: 'policies/page.tsx',
    content: `import { HostelPoliciesView } from '@/features/hostel/ui/hostel-policies-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.policies.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <HostelPoliciesView />
    </main>
  );
}
`
  },
  {
    path: 'reports/page.tsx',
    content: `import { HostelReportsView } from '@/features/hostel/ui/hostel-reports-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.read' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <HostelReportsView />
    </main>
  );
}
`
  },
  {
    path: 'roll-call/page.tsx',
    content: `import { RollCallView } from '@/features/hostel/ui/roll-call-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function RollCallPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.supervision.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <RollCallView />
    </main>
  );
}
`
  },
  {
    path: 'rooms/page.tsx',
    content: `import { RoomsBedsView } from '@/features/hostel/ui/rooms-beds-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function RoomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <RoomsBedsView />
    </main>
  );
}
`
  },
  {
    path: 'zones/page.tsx',
    content: `import { ZonesView } from '@/features/hostel/ui/zones-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ZonesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <ZonesView />
    </main>
  );
}
`
  }
];

for (const p of pages) {
  const fullPath = path.join(basePath, p.path);
  fs.writeFileSync(fullPath, p.content, 'utf-8');
  console.log(`Updated ${p.path}`);
}
console.log('All 16 Hostel server page routes updated with RTL support.');
