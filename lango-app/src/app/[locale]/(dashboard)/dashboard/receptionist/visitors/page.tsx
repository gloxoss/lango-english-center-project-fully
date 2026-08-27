import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionVisitorsView } from '@/features/reception/ui/reception-visitors-view';

export default async function ReceptionistVisitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'reception.visitor.manage' });
  return <ReceptionVisitorsView />;
}
