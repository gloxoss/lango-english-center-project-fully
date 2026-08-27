import { AdmissionRequestsView } from '@/features/students/ui/admission-requests-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AdmissionRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'admissions.manage' });
  return <AdmissionRequestsView />;
}
