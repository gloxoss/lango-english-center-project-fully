import { requireLibrarySelfPage } from '@/features/library/ui/page-guard';
import { LibrarySelfServiceClient } from '@/features/library/ui/library-self-service-client';

export default async function LibrarySelfServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireLibrarySelfPage(locale);
  return <LibrarySelfServiceClient />;
}
