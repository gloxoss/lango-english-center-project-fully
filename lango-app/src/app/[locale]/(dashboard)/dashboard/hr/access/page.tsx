import { AccessLifecycleView } from '@/features/hr/ui/access-lifecycle-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function HrAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AccessLifecycleView />;
}
