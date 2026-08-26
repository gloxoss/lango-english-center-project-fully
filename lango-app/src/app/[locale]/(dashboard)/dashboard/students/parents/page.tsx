import { ParentsGuardiansView } from '@/features/students/ui/parents-guardians-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ParentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guardians.read' });
  return <ParentsGuardiansView locale={locale} />;
}
