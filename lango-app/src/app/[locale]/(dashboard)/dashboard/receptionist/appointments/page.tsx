import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionAppointmentsView } from '@/features/reception/ui/reception-appointments-view';

export default async function ReceptionistAppointmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['receptionist', 'school_admin', 'super_admin'],
    requiredCapability: 'reception.appointment.manage',
  });
  return <ReceptionAppointmentsView />;
}
