import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionHomeView } from '@/features/reception/ui/reception-home-view';

export default async function ReceptionistHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['receptionist', 'school_admin', 'super_admin'],
    requiredCapability: 'reception.portal.use',
  });
  return <ReceptionHomeView />;
}
