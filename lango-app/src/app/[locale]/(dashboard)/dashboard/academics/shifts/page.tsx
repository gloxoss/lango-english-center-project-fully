import { ShiftsView } from '@/features/academics/ui/shifts-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ShiftsView locale={locale} />;
}
