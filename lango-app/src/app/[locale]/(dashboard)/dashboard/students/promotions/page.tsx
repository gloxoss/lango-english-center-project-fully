import { PromotionsView } from '@/features/students/ui/promotions-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <PromotionsView />;
}
