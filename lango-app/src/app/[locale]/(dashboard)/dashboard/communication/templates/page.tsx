import { requireServerPage } from '@/libs/api/page-guard';
import { SmsTemplatesView } from '@/features/communication/ui/sms-templates-view';

export default async function SmsTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SmsTemplatesView />;
}
