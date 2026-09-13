import { TonightView } from '@/features/hostel/ui/tonight-view';
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
