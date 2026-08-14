import { ResidentMeView } from '@/features/hostel/ui/resident-me-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ResidentMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['student'] });
  return <ResidentMeView />;
}
