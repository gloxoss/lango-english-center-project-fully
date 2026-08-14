import { HostelPoliciesView } from '@/features/hostel/ui/hostel-policies-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HostelPoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <HostelPoliciesView />;
}
