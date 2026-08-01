import { ShiftsView } from '@/features/academics/ui/shifts-view';

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ShiftsView locale={locale} />;
}
