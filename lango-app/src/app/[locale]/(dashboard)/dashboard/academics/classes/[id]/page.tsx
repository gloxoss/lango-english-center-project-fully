import { ClassDetail360View } from '@/features/academics/ui/class-detail-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ClassDetail360View id={id} locale={locale} />;
}
