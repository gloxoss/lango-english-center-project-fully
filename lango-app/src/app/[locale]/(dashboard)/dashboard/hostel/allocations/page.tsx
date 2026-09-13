import { AllocationWorkspaceView } from '@/features/hostel/ui/allocation-workspace-view';
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
