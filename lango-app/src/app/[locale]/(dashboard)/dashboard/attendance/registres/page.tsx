import { RegistresHistoriqueView } from '@/features/attendance/ui/registres-historique-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function RegistresHistoriquePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'attendance.read' });
  return <RegistresHistoriqueView />;
}
