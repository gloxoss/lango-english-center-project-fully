import { AllocationDetailView } from '@/features/hostel/ui/allocation-detail-view';
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
