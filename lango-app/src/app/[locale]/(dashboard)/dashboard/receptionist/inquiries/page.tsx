import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionInquiriesView } from '@/features/reception/ui/reception-inquiries-view';

export default async function ReceptionistInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['receptionist', 'school_admin', 'super_admin'],
    requiredCapability: 'reception.inquiry.manage',
  });
  return <ReceptionInquiriesView />;
}
