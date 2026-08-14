import { StreamsView } from '@/features/academics/ui/streams-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function StreamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StreamsView locale={locale} />;
}
