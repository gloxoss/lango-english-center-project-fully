import { GradesView } from '@/features/parent/ui/GradesView';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ParentGradesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <GradesView />;
}
