import { requireServerPage } from '@/libs/api/page-guard';
import { ReceptionPickupsView } from '@/features/reception/ui/reception-pickups-view';

export default async function ReceptionistPickupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Page is reachable by the receptionist, but the release actions stay locked
  // behind reception.pickup.release (default-deny) — the view renders a graceful
  // forbidden state. Explicit authorization grants open the path.
  await requireServerPage(locale, { requiredCapability: 'reception.portal.use' });
  return <ReceptionPickupsView />;
}
