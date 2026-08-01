import { ParentsGuardiansView } from '@/features/students/ui/parents-guardians-view';

export default async function ParentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ParentsGuardiansView locale={locale} />;
}
