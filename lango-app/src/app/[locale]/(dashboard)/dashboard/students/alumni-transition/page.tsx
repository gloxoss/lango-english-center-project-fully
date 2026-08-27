import { BulkAlumniTransitionView } from '@/features/students/ui/bulk-alumni-transition-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AlumniTransitionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'students.update' });
  return <BulkAlumniTransitionView locale={locale} />;
}
