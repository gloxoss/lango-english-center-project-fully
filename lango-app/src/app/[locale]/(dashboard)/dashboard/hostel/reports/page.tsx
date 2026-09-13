import { HostelReportsView } from '@/features/hostel/ui/hostel-reports-view';
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
