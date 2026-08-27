import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionInquiriesView } from '@/features/reception/ui/reception-inquiries-view';

export default async function ReceptionistInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'reception.inquiry.manage' });
  return <ReceptionInquiriesView />;
}
