import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionHandoffsView } from '@/features/reception/ui/reception-handoffs-view';

export default async function ReceptionistHandoffsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['receptionist', 'school_admin', 'super_admin'],
    requiredCapability: 'reception.handoff.manage',
  });
  return <ReceptionHandoffsView />;
}
