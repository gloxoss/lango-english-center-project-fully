import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.resolve(__dirname, '../src/app/[locale]/(dashboard)/dashboard/portals/guard');

const pages = [
  {
    path: 'page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardHomeView } from '@/features/guard/ui/guard-home-view';

export default async function GuardPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: the page reads the viewer's own active shift, so a role that
  // can never hold one (school_admin, super_admin) is redirected like every
  // other role portal rather than shown a kiosk that 403s on load.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.portal.use' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardHomeView />
    </main>
  );
}
`
  },
  {
    path: 'config/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardConfigView } from '@/features/guard/ui/guard-config-view';

export default async function GuardConfigPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.gates.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardConfigView />
    </main>
  );
}
`
  },
  {
    path: 'emergency/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardEmergencyView } from '@/features/guard/ui/guard-emergency-view';

export default async function GuardEmergencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.portal.use' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardEmergencyView />
    </main>
  );
}
`
  },
  {
    path: 'incidents/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardIncidentsView } from '@/features/guard/ui/guard-incidents-view';

export default async function GuardIncidentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.incidents.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardIncidentsView />
    </main>
  );
}
`
  },
  {
    path: 'pickups/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardPickupsView } from '@/features/guard/ui/guard-pickups-view';

export default async function GuardPickupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active gate, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.pickup.release' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardPickupsView />
    </main>
  );
}
`
  },
  {
    path: 'scanner/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardKioskShell } from '@/features/guard/ui/guard-kiosk-shell';

export default async function GuardScannerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active shift, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.portal.use' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardKioskShell />
    </main>
  );
}
`
  },
  {
    path: 'visitors/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { GuardVisitorsView } from '@/features/guard/ui/guard-visitors-view';

export default async function GuardVisitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active gate, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.visitors.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardVisitorsView />
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
console.log('All 7 Guard server page routes updated with RTL support.');
