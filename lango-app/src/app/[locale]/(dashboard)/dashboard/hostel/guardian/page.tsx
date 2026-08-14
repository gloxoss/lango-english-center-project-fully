import { GuardianMeView } from '@/features/hostel/ui/guardian-me-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function GuardianMePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <GuardianMeView />;
}
