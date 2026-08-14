import { requireServerPage } from '@/libs/api/page-guard';
import { SmsRemindersView } from '@/features/communication/ui/sms-reminders-view';

export default async function SmsRemindersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SmsRemindersView />;
}
