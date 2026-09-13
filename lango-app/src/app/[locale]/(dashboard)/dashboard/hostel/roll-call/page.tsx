import { RollCallView } from '@/features/hostel/ui/roll-call-view';
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
