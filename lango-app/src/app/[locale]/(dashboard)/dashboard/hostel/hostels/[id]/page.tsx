import { HostelDetailView } from '@/features/hostel/ui/hostel-detail-view';
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
