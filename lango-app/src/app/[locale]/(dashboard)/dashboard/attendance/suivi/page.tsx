import { SuiviAlertesView } from '@/features/attendance/ui/suivi-alertes-view';
import { requireServerPage } from '@/libs/api/page-guard';

// "Suivi & alertes" — the operational page. Signalements and Audit & Alertes
// used to answer this question in two halves on two pages; this is the one
// surface, and it reads the same APIs those pages already read.
export default async function SuiviAlertesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.read' });
  return <SuiviAlertesView />;
}
