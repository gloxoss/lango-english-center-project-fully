import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.resolve(__dirname, '../src/app/[locale]/(dashboard)/dashboard/workforce');

const pages = [
  {
    path: 'page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollHub } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollHub />
    </main>
  );
}
`
  },
  {
    path: 'advances/page.tsx',
    content: `import { SalaryAdvancesView } from '@/features/workforce/ui/salary-advances-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceSalaryAdvancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.advances.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <SalaryAdvancesView />
    </main>
  );
}
`
  },
  {
    path: 'awards/page.tsx',
    content: `import { AwardsRecognitionClient } from '@/features/workforce/ui/awards-recognition-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceAwardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.awards.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <AwardsRecognitionClient />
    </main>
  );
}
`
  },
  {
    path: 'leave/page.tsx',
    content: `import { LeaveManagementClient } from '@/features/workforce/ui/leave-management-client';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function WorkforceLeavePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.leave.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <LeaveManagementClient />
    </main>
  );
}
`
  },
  {
    path: 'timeclock/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { TimeClockKiosk } from '@/features/workforce/ui/time-clock-kiosk';

export const metadata = {
  title: 'Pointeuse Employés & Staff — SchoolOS',
  description: 'Borne de pointage par badge QR pour les entrées et sorties du personnel.',
};

export default async function TimeClockPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale} className="mx-auto max-w-4xl px-4 py-8">
      <TimeClockKiosk />
    </main>
  );
}
`
  },
  {
    path: 'payroll/runs/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollRuns } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollRuns />
    </main>
  );
}
`
  },
  {
    path: 'payroll/runs/[id]/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollRunDetail } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollRunDetail id={id} />
    </main>
  );
}
`
  },
  {
    path: 'payroll/adjustments/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="adjustments" />
    </main>
  );
}
`
  },
  {
    path: 'payroll/assignments/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="assignments" />
    </main>
  );
}
`
  },
  {
    path: 'payroll/components/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="components" />
    </main>
  );
}
`
  },
  {
    path: 'payroll/payments/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollPayments } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollPayments />
    </main>
  );
}
`
  },
  {
    path: 'payroll/payslips/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollPayslips } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollPayslips />
    </main>
  );
}
`
  },
  {
    path: 'payroll/regulations/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="regulations" />
    </main>
  );
}
`
  },
  {
    path: 'payroll/settings/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="settings" />
    </main>
  );
}
`
  },
  {
    path: 'payroll/structures/page.tsx',
    content: `import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="structures" />
    </main>
  );
}
`
  }
];

for (const p of pages) {
  const fullPath = path.join(basePath, p.path);
  fs.writeFileSync(fullPath, p.content, 'utf-8');
  console.log(`Updated: ${p.path}`);
}
