import { AllocationWorkspaceView } from '@/features/hostel/ui/allocation-workspace-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'hostel.allocation.manage' });
  return <AllocationWorkspaceView />;
}
